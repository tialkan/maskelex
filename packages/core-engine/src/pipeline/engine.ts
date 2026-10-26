// packages/core-engine/src/pipeline/engine.ts
// MaskingEngineApi bileşimi (MASTER 3.0.1). Faz-0 sürümü: Katman 1-2 başvuru dedektörleri, isteğe bağlı NerPort,
// etiket modu, düz metin girişi ve .txt dışa aktarım. Belge codec'leri (A3), eşbağ (A2), ikiz modu (A2),
// tutar ölçekleme (A1) ve kasa deposu (A5) F2'de bu dosyadaki portlara bağlanır.
//
// Tasarım: analiz bulguları (matchesByDoc) değişmez ham veridir. Kullanıcı komutları ayrı bir "geçersiz kılma"
// katmanında tutulur ve her çağrıda kümeler bu ikisinden yeniden türetilir. Böylece komutlar tutarlı ve geri
// alınabilir kalır, kasa kilitliyken verilmiş etiketler korunur.

import { detectAll, toContract } from '../detectors/deterministic/reference';
import { merge } from './merge';
import { allocateTokens, buildMaskEdits, type MaskMention } from './maskText';
import { leakAudit } from './leakAudit';
import { profileOf, refineWithEvidence } from '../morphology/morphology';
import { foldKey, isLetter, trLower, trUpper } from '../text/turkish';
import { toUnmaskView, unmask as unmaskText } from '../unmask/rehydrate';
import { encryptVault, decryptVault } from '../vault/crypto';
import { createNameRuleDetector, genderOf } from '../names/ruleDetector';
import { findAmounts, formatTrNumber, parseTrNumber, pickScale } from '../fuzz/amount';
import { numberToWordsJoined } from '../text/numberWords';
import { BUILT_IN_TEMPLATES, fillTemplate } from './templates';
import { makeTwinPicker, type TwinLexiconEntry } from '../twins/twins';
import twinData from '../names/data/twin-lexicon.json';
import {
  CATEGORY_SPECS, CONFIDENCE_RANK, DEFAULT_MASKING_OPTIONS, spansOverlap,
  type AnalysisResult, type DocumentId, type DocumentInput, type DocWarning, type EncryptedVaultFile, type EntityCategory,
  type EntityCluster, type EntityCommand, type EntityId, type EntityMatch, type EntityStatus, type ExportRequest, type GroupToken,
  type LegalRole, type MaskedOutput, type MaskelexError, type MaskingEngineApi, type MaskingOptions, type MaskingSessionVault,
  type MentionForm, type MentionId, type TwinName, type NameRuleDetectorPort, type DocumentAST, type DocumentCodec, type NerPort, type NerStatus, type ProtectedSpan, type RandomSource, type ResolvedMention,
  type ReviewItem, type SessionInfo, type TextEdit, type TextSpan, type UnmaskResult, type VaultDocument, type WipeReason,
} from '../types/contracts';

export interface EnginePorts {
  readonly rng: RandomSource;
  readonly now: () => number;
  /** Verilmezse NER kapalı sayılır (yalnız Katman 1-2). */
  readonly ner?: NerPort;
  /** Verilmezse kural tabanlı dedektör (3.3.4) kullanılır. */
  readonly names?: NameRuleDetectorPort;
  /** Belge codec'leri (document-parsers). Verilmezse yalnız metin girişi ve .txt çıktı. */
  readonly codecs?: readonly DocumentCodec[];
}

const fail = (code: MaskelexError['code'], message: string): MaskelexError => ({ code, message });
const NER_DISABLED: NerStatus = { state: 'DISABLED', progress: 0 };
const APOSTROPHES = "'’";

interface DocState { readonly meta: VaultDocument; readonly text: string; readonly ast: DocumentAST | null; matches: EntityMatch[]; prot: ProtectedSpan[]; analyzed: boolean }
interface Overrides {
  status: Map<string, EntityStatus>;
  role: Map<string, LegalRole>;
  category: Map<string, EntityCategory>;
  canonical: Map<string, string>;
  /** kaynak anahtar → hedef anahtar */
  mergedInto: Map<string, string>;
  removedMentions: Set<MentionId>;
  manual: EntityMatch[];
  unprotected: Array<{ docId: DocumentId; span: TextSpan }>;
  /** Kullanıcının onayladığı sızıntı bulguları (kaynak aralığı) */
  ackedLeaks: Array<{ docId: DocumentId; span: TextSpan }>;
}
interface Session {
  sessionId: string; createdAt: number; expiresAt: number; options: MaskingOptions; locked: boolean;
  docs: Map<DocumentId, DocState>;
  ov: Overrides;
  /** küme anahtarı → kalıcı varlık kimliği */
  idByKey: Map<string, EntityId>;
  /** varlık kimliği → panoya çıkmış etiketler */
  issued: Map<EntityId, string[]>;
  /** kilitliyken son verilen etiketler */
  lockedTokens: Map<EntityId, string>;
  counters: Record<string, number>;
  /** İçe aktarılmış kasa: belge yoksa geri çözme bununla yapılır. */
  imported: MaskingSessionVault | null;
  /** SCALE kipinde gizli ölçek (MASTER 3.2.3). Yalnız bellekte ve şifreli kasada durur. */
  amountK: number | null;
  /** Fonetik İkiz (MASTER 3.4.5): varlık → ikiz, gerçek soyadı (katlanmış) → ikiz soyadı. Oturum boyunca sabittir. */
  twins: Map<EntityId, TwinName>;
  twinSurnames: Map<string, string>;
  lastDocId: DocumentId | null;
  seq: number;
}

const emptyOverrides = (): Overrides => ({
  status: new Map(), role: new Map(), category: new Map(), canonical: new Map(), mergedInto: new Map(),
  removedMentions: new Set(), manual: [], unprotected: [], ackedLeaks: [],
});

const hex = (rng: RandomSource, words: number): string =>
  Array.from({ length: words }, () => rng.nextUint32().toString(16).padStart(8, '0')).join('');

/** "AHMET YILMAZ" → "Ahmet Yılmaz" (Türkçeye duyarlı başlık biçimi, 3.0.5) */
const titleCase = (s: string): string => s.split(/\s+/).filter(Boolean)
  .map((w) => trUpper(w.slice(0, 1)) + trLower(w.slice(1))).join(' ');
const isAllUpper = (s: string): boolean => s === trUpper(s) && s !== trLower(s);

function suffixAfter(text: string, end: number): ResolvedMention['suffix'] {
  const ap = text[end];
  if (!ap || !APOSTROPHES.includes(ap)) return undefined;
  let j = end + 1;
  while (j < text.length && isLetter(text[j])) j++;
  if (j === end + 1) return undefined;
  return { span: { start: end + 1, end: j }, apostrophe: ap, text: text.slice(end + 1, j) };
}

function applyEdits(text: string, edits: readonly TextEdit[]): { text: string; spans: TextSpan[] } {
  const sorted = [...edits].sort((a, b) => a.span.start - b.span.start);
  let out = '';
  let cursor = 0;
  const spans: TextSpan[] = [];
  for (const e of sorted) {
    if (e.span.start < cursor) throw fail('E_EDIT_INVALID', 'Çakışan düzenleme.');
    out += text.slice(cursor, e.span.start);
    spans.push({ start: out.length, end: out.length + e.replacement.length });
    out += e.replacement;
    cursor = e.span.end;
  }
  return { text: out + text.slice(cursor), spans };
}

const TWIN_LEXICON = (twinData as { entries: TwinLexiconEntry[] }).entries;

/** Tutarlar (MASTER 3.2.3). Rakamla tutar ve hemen ardındaki yazıyla tutar aynı değere (aynı varlığa) bağlanır. */
function amountMatches(text: string, docId: DocumentId, nextId: () => MentionId): EntityMatch[] {
  const out: EntityMatch[] = [];
  for (const h of findAmounts(text)) {
    const normalized = `TUTAR:${h.value}`;
    const base = { docId, category: 'TUTAR' as const, layer: 'L1_CHECKSUM' as const, confidence: 'HIGH' as const, score: 0.95, normalized, flags: [] };
    out.push({ ...base, id: nextId(), span: h.span, text: text.slice(h.span.start, h.span.end), ruleId: 'L1.TUTAR' });
    if (h.words) out.push({ ...base, id: nextId(), span: h.words.span, text: h.words.text, ruleId: 'L1.TUTAR_YAZI' });
  }
  return out;
}

/** Tam adı bulunmuş kişilerin soyadı tek başına geçtiğinde ("Yılmaz'ın") aynı kişiye bağlar.
 *  Aynı soyadı birden çok kişide varsa bağlamaz: sızıntı denetimi yakalar, grup etiketi (A2) F2'de gelir. */
function propagateSurnames(text: string, matches: EntityMatch[], prot: readonly ProtectedSpan[], nextId: () => MentionId): EntityMatch[] {
  const owners = new Map<string, Set<string>>();
  for (const m of matches) {
    if (m.category !== 'KISI') continue;
    const words = m.text.split(/\s+/).filter(Boolean);
    if (words.length < 2) continue;
    const sur = foldKey(words.at(-1)!);
    (owners.get(sur) ?? owners.set(sur, new Set()).get(sur)!).add(m.normalized ?? foldKey(m.text));
  }
  // Tek sözcüklü kişi bulgusu ("Davacı Kaya'nın") bilinen tek bir kişinin soyadıysa o kişiye bağlanır.
  const out = matches.map((m) => {
    if (m.category !== 'KISI' || /\s/.test(m.text.trim())) return m;
    const own = owners.get(foldKey(m.text));
    return own && own.size === 1 ? { ...m, normalized: [...own][0]! } : m;
  });
  const busy = (st: number, en: number): boolean => out.some((m) => st < m.span.end && m.span.start < en)
    || prot.some((p) => st < p.span.end && p.span.start < en);
  for (const w of text.matchAll(/\p{L}+/gu)) {
    const word = w[0], st = w.index!, en = st + word.length;
    if (word[0] === trLower(word[0]!)) continue;
    const own = owners.get(foldKey(word));
    if (!own || own.size !== 1 || busy(st, en)) continue;
    out.push({ id: nextId(), docId: matches[0]!.docId, span: { start: st, end: en }, text: word, category: 'KISI', layer: 'L3_RULE',
      confidence: 'MEDIUM', score: 0.7, ruleId: 'L3.RULE.SOYAD_ESLEME', normalized: [...own][0]!, flags: [] });
  }
  return out;
}

export function createEngine(ports: EnginePorts): MaskingEngineApi {
  let s: Session | null = null;
  const names = ports.names ?? createNameRuleDetector();
  const codecs = ports.codecs ?? [];

  const year = (): number => new Date(ports.now()).getFullYear();
  const info = (x: Session): SessionInfo => ({
    sessionId: x.sessionId, createdAt: x.createdAt, expiresAt: x.expiresAt, locked: x.locked,
    documents: [...x.docs.values()].map((d) => d.meta),
  });
  const nerStatusNow = (): NerStatus => (ports.ner ? ports.ner.status() : NER_DISABLED);

  function wipeNow(): void {
    if (!s) return;
    for (const d of s.docs.values()) { d.matches.length = 0; d.prot.length = 0; }
    s.docs.clear(); s.idByKey.clear(); s.issued.clear(); s.lockedTokens.clear(); s.imported = null;
    s = null;
  }
  function live(): Session {
    if (!s) throw fail('E_NO_SESSION', 'Açık oturum yok.');
    if (ports.now() > s.expiresAt) { wipeNow(); throw fail('E_VAULT_EXPIRED', 'Oturum süresi doldu, eşleşmeler silindi.'); }
    return s;
  }
  function newSession(options: MaskingOptions): Session {
    const createdAt = ports.now();
    return {
      sessionId: hex(ports.rng, 4), createdAt, expiresAt: createdAt + options.sessionTimeoutMinutes * 60_000, options,
      locked: false, docs: new Map(), ov: emptyOverrides(), idByKey: new Map(), issued: new Map(), lockedTokens: new Map(),
      counters: {}, imported: null, amountK: null, twins: new Map(), twinSurnames: new Map(), lastDocId: null, seq: 0,
    };
  }

  /* ───────── Kümeleme: ham bulgular + geçersiz kılmalar → varlıklar ───────── */

  const baseKey = (m: EntityMatch): string => `${m.category}#${m.normalized ?? foldKey(m.text)}`;
  function keyOf(x: Session, m: EntityMatch): string {
    let k = baseKey(m);
    for (let guard = 0; x.ov.mergedInto.has(k) && guard < 64; guard++) k = x.ov.mergedInto.get(k)!;
    return k;
  }
  function liveMatches(x: Session, d: DocState): EntityMatch[] {
    const prot = d.prot.filter((p) => !x.ov.unprotected.some((u) => u.docId === d.meta.id && spansOverlap(u.span, p.span)));
    const manual = x.ov.manual.filter((m) => m.docId === d.meta.id);
    return merge([...d.matches, ...manual], prot).filter((m) => !x.ov.removedMentions.has(m.id));
  }

  interface Derived { entities: EntityCluster[]; mentions: ResolvedMention[]; byDoc: Map<DocumentId, ResolvedMention[]> }

  function derive(x: Session): Derived {
    interface Acc { key: string; first: number; matches: EntityMatch[]; mentions: ResolvedMention[] }
    const acc = new Map<string, Acc>();
    const byDoc = new Map<DocumentId, ResolvedMention[]>();
    let order = 0;
    for (const d of x.docs.values()) {
      if (!d.analyzed) continue;
      const list: ResolvedMention[] = [];
      for (const m of liveMatches(x, d)) {
        const key = keyOf(x, m);
        let a = acc.get(key);
        if (!a) { a = { key, first: order, matches: [], mentions: [] }; acc.set(key, a); }
        order++;
        if (!x.idByKey.has(key)) x.idByKey.set(key, `E-${String(x.idByKey.size + 1).padStart(4, '0')}`);
        const suffix = suffixAfter(d.text, m.span.end);
        const form: MentionForm = CATEGORY_SPECS[m.category].group === 'KISI_KURUM' ? 'FULL' : 'VALUE';
        const rm: ResolvedMention = {
          id: m.id, docId: d.meta.id, entityId: x.idByKey.get(key)!, span: m.span, surface: m.text, form, match: m,
          ...(suffix ? { suffix } : {}),
        };
        a.matches.push(m); a.mentions.push(rm); list.push(rm);
      }
      byDoc.set(d.meta.id, list);
    }

    const opts = x.options;
    const drafts = [...acc.values()].map((a) => {
      const id = x.idByKey.get(a.key)!;
      const head = a.matches[0]!;
      const category = x.ov.category.get(a.key) ?? head.category;
      const best = a.matches.reduce((b, m) => (CONFIDENCE_RANK[m.confidence] > CONFIDENCE_RANK[b.confidence] ? m : b), head);
      const surfaces = [...new Set(a.matches.map((m) => m.text))];
      const role: LegalRole = category === 'KISI'
        ? (x.ov.role.get(a.key) ?? a.matches.find((m) => m.roleHint)?.roleHint ?? 'BELIRSIZ') : 'BELIRSIZ';
      const roleSource: EntityCluster['roleSource'] = x.ov.role.has(a.key) ? 'USER'
        : category === 'KISI' && a.matches.some((m) => m.roleHint) ? 'CUE' : 'DEFAULT';
      let canonical = x.ov.canonical.get(a.key);
      if (canonical === undefined) {
        if (category === 'KISI' || category === 'SIRKET' || category === 'KURUM') {
          const longest = surfaces.reduce((b, t) => (t.length > b.length ? t : b), surfaces[0]!);
          canonical = category === 'KISI' && isAllUpper(longest) ? titleCase(longest) : longest;
        } else canonical = head.text;
      }
      const observedSuffixes = a.mentions.flatMap((m) => (m.suffix ? [m.suffix.text] : []));
      const words = canonical.split(/\s+/).filter(Boolean);
      const nameParts = category === 'KISI' && words.length >= 2
        ? { given: words.slice(0, -1), surnames: words.slice(-1) } : undefined;
      const flagged = a.matches.some((m) => m.flags.some((f) => f.startsWith('AMBIGUOUS_') || f === 'FOREIGN_NAME'));
      const status: EntityStatus = x.ov.status.get(a.key)
        ?? (category === 'TUTAR' ? (opts.amountMode === 'OFF' ? 'KEEP' : 'MASK')
          : best.confidence === 'LOW' || flagged ? 'REVIEW'
          : opts.maskedCategories[category] && CONFIDENCE_RANK[best.confidence] >= CONFIDENCE_RANK[opts.autoSelectMinConfidence] ? 'MASK'
            : 'KEEP');
      const given = nameParts?.given[0];
      return {
        a, id, category, role, roleSource, canonical, surfaces, status, confidence: best.confidence, observedSuffixes, nameParts, given,
        normalized: head.normalized,
      };
    });

    const tokens = allocateTokens(
      drafts.map((d) => ({
        entityId: d.id, category: d.category, role: d.role, firstSeen: d.a.first,
        ...(x.lockedTokens.has(d.id) ? { currentToken: x.lockedTokens.get(d.id)! } : {}),
      })),
      // Kopya: türetme sayaçları kalıcılaştırmaz; sayaç yalnız markIssued ile ilerler.
      { ...x.counters }, x.locked,
    );

    const plain: EntityCluster[] = drafts.map((d) => ({
      id: d.id, category: d.category, role: d.role, roleSource: d.roleSource, token: tokens.get(d.id)!,
      issuedTokens: x.issued.get(d.id) ?? [], canonical: d.canonical, surfaces: d.surfaces,
      mentionIds: d.a.mentions.map((m) => m.id), status: d.status, confidence: d.confidence,
      phon: refineWithEvidence(profileOf(d.canonical), d.observedSuffixes), observedSuffixes: d.observedSuffixes,
      ...(d.normalized !== undefined ? { normalizedValue: d.normalized } : {}),
      ...(d.nameParts ? { nameParts: d.nameParts } : {}),
      ...(d.category === 'KISI' && d.given !== undefined ? { gender: genderOf(d.given) } : {}),
      ...(d.given !== undefined ? { givenCanonical: d.given, phonGiven: profileOf(d.given) } : {}),
    }));
    const entities = x.options.mode === 'TWIN' ? attachTwins(x, plain) : plain;
    return { entities, mentions: [...byDoc.values()].flat(), byDoc };
  }

  /** Kişilere ikiz atar. Aday yoksa ikiz verilmez, varlık etiketle kalır (3.4.5/6). */
  function attachTwins(x: Session, list: EntityCluster[]): EntityCluster[] {
    const reserved = list.filter((e) => e.category === 'KISI').flatMap((e) => e.surfaces);
    for (const t of x.twins.values()) reserved.push(t.full);
    const picker = makeTwinPicker(TWIN_LEXICON, ports.rng, reserved);
    return list.map((e) => {
      if (e.category !== 'KISI' || e.status !== 'MASK' || !e.nameParts) return e;
      let twin = x.twins.get(e.id);
      if (!twin) {
        const surname = e.nameParts.surnames.join(' ');
        const sk = foldKey(surname);
        // Aile tutarlılığı: aynı gerçek soyadı her zaman aynı ikiz soyadı (3.4.5/3)
        const twinSur = x.twinSurnames.get(sk) ?? picker.pick('SOYAD', surname, 'U');
        const twinGiven = twinSur ? picker.pick('AD', e.nameParts.given.at(-1)!, e.gender ?? 'U') : null;
        if (!twinSur || !twinGiven) return e;
        x.twinSurnames.set(sk, twinSur);
        const full = `${twinGiven} ${twinSur}`;
        twin = { full, given: twinGiven, surname: twinSur, display: `《${full}》` };
        x.twins.set(e.id, twin);
      }
      return { ...e, twin };
    });
  }

  function buildVault(x: Session, dv: Derived): MaskingSessionVault {
    if (x.imported && x.docs.size === 0) return x.imported;
    const tokenIndex = new Map<string, EntityId>();
    for (const e of dv.entities) for (const t of [e.token, ...e.issuedTokens]) tokenIndex.set(t, e.id);
    return {
      sessionId: x.sessionId, createdAt: x.createdAt, expiresAt: x.expiresAt, options: x.options,
      documents: [...x.docs.values()].map((d) => d.meta),
      entities: new Map(dv.entities.map((e) => [e.id, e])), mentions: new Map(dv.mentions.map((m) => [m.id, m])),
      groups: new Map<string, GroupToken>(), tokenIndex,
      twinIndex: new Map<string, { readonly entityId?: EntityId; readonly part: 'FULL' | 'GIVEN' | 'SURNAME' }>(dv.entities.flatMap((e) => {
        if (!e.twin) return [];
        const out: Array<[string, { entityId: EntityId; part: 'FULL' | 'GIVEN' | 'SURNAME' }]> = [[foldKey(e.twin.full), { entityId: e.id, part: 'FULL' }]];
        if (e.twin.given) out.push([foldKey(e.twin.given), { entityId: e.id, part: 'GIVEN' }]);
        if (e.twin.surname) out.push([foldKey(e.twin.surname), { entityId: e.id, part: 'SURNAME' }]);
        return out;
      })), counters: { ...x.counters }, locked: x.locked,
      ...(x.options.amountMode === 'SCALE' && x.amountK !== null ? { amountScale: {
        k: x.amountK,
        pairs: dv.entities.filter((e) => e.category === 'TUTAR' && e.status === 'MASK').map((e) => {
          const { value, style } = parseTrNumber(e.canonical);
          return { entityId: e.id, fuzzed: formatTrNumber(value * x.amountK!, style), original: e.canonical };
        }),
      } } : {}),
    };
  }
  /** Ölçek oturum başına bir kez seçilir; sonraki belgeler aynı k ile ölçeklenir (oranlar belgeler arası da korunur). */
  function scaleK(x: Session): number {
    if (x.amountK === null) x.amountK = pickScale(ports.rng, x.options.scaleRange);
    return x.amountK;
  }

  function result(x: Session, docId: DocumentId, phase: AnalysisResult['phase'], timingsMs: Record<string, number>): AnalysisResult {
    const d = x.docs.get(docId);
    if (!d) throw fail('E_NO_SESSION', 'Belge bulunamadı.');
    const dv = derive(x);
    const mentions = dv.byDoc.get(docId) ?? [];
    const ids = new Set(mentions.map((m) => m.entityId));
    const entities = dv.entities.filter((e) => ids.has(e.id));
    const protectedSpans = d.prot.filter((p) => !x.ov.unprotected.some((u) => u.docId === docId && spansOverlap(u.span, p.span)));
    const reviewQueue: ReviewItem[] = [
      ...entities.filter((e) => e.status === 'REVIEW').map((e, i) => ({
        id: `R-L-${i + 1}`, kind: 'LOW_CONFIDENCE' as const, docId, entityId: e.id, message: `${e.token} için onayınız gerekiyor.` })),
      ...protectedSpans.filter((p) => p.ownCaseSuspect).map((p, i) => ({
        id: `R-O-${i + 1}`, kind: 'OWN_CASE_CITATION' as const, docId, span: p.span,
        message: 'Bu künye sizin dosyanıza ait olabilir. Emsal ise korunur, kendi dosyanızsa maskeleyin.' })),
    ];
    return { docId, text: d.text, entities, mentions, groups: [], protectedSpans, reviewQueue, ner: nerStatusNow(), phase, timingsMs };
  }

  const lastDoc = (x: Session): DocumentId => {
    if (!x.lastDocId) throw fail('E_NO_SESSION', 'Henüz belge yok.');
    return x.lastDocId;
  };
  const keyOfEntity = (x: Session, id: EntityId): string => {
    for (const [k, v] of x.idByKey) if (v === id) return k;
    throw fail('E_EDIT_INVALID', 'Varlık bulunamadı.');
  };

  async function masking(docId: DocumentId): Promise<{ out: MaskedOutput; edits: TextEdit[]; doc: DocState }> {
    const x = live();
    const d = x.docs.get(docId);
    if (!d || !d.analyzed) throw fail('E_NO_SESSION', 'Belge henüz analiz edilmedi.');
    const dv = derive(x);
    const byId = new Map(dv.entities.map((e) => [e.id, e]));
    const mentions: MaskMention[] = [];
    for (const m of dv.byDoc.get(docId) ?? []) {
      const e = m.entityId ? byId.get(m.entityId) : undefined;
      if (!e || e.status !== 'MASK') continue;
      if (e.category === 'TUTAR' && x.options.amountMode === 'SCALE') {
        // Oran korumalı ölçek: rakam biçimi korunur, yazıyla tutar yeni değere göre yeniden yazılır.
        const v = parseTrNumber(e.canonical).value * scaleK(x);
        const replacement = m.match.ruleId === 'L1.TUTAR_YAZI' ? numberToWordsJoined(Math.round(v)) : formatTrNumber(v, parseTrNumber(m.surface).style);
        mentions.push({ span: m.span, replacement, kind: 'FUZZ' });
        continue;
      }
      const suffix = m.suffix ? { suffix: { span: m.suffix.span, text: m.suffix.text } } : {};
      if (e.twin) {
        // Tek sözcüklü anma ("Kaya'nın") ikizin karşılık gelen parçasıyla yazılır.
        const w = foldKey(m.surface);
        const part = e.nameParts?.surnames.some((p) => foldKey(p) === w) ? e.twin.surname
          : e.nameParts?.given.some((p) => foldKey(p) === w) ? e.twin.given : e.twin.full;
        mentions.push({ span: m.span, replacement: `《${part}》`, kind: 'TWIN', ...suffix });
        continue;
      }
      mentions.push({ span: m.span, replacement: e.token, kind: 'TOKEN', ...suffix });
    }
    const edits = buildMaskEdits(mentions, x.options.normalizeSuffixesInMaskedText);
    edits.sort((a, b) => a.span.start - b.span.start);
    const { text, spans } = applyEdits(d.text, edits);
    // Bulgu aralıkları maskeli metinden kaynak belgeye çevrilir: arayüz kaynağı vurgular, "Maskele" komutu
    // (ADD_MANUAL) kaynak aralığıyla çalışır. Bulgular etiket dışında olduğundan eşleme birebirdir.
    const toSource = (pos: number): number => {
      let i = -1;
      for (let k = 0; k < spans.length && spans[k]!.end <= pos; k++) i = k;
      return i < 0 ? pos : edits[i]!.span.end + (pos - spans[i]!.end);
    };
    const leakFindings = leakAudit({ docId, masked: text, vault: buildVault(x, dv), tokenSpans: spans, currentYear: year() })
      .map((f) => (f.span ? { ...f, span: { start: toSource(f.span.start), end: toSource(f.span.end) } } : f))
      .filter((f) => !x.ov.ackedLeaks.some((a) => a.docId === docId && f.span && a.span.start === f.span.start && a.span.end === f.span.end));
    const tokenCount = new Set(mentions.map((m) => m.replacement)).size;
    const out: MaskedOutput = { docId, text, tokenCount, leakFindings };
    return { out, edits, doc: d };
  }

  const api: MaskingEngineApi = {
    async createSession(options) {
      wipeNow();
      s = newSession({ ...DEFAULT_MASKING_OPTIONS, ...options });
      return info(s);
    },

    async loadDocument(input: DocumentInput) {
      const x = live();
      let ast: DocumentAST | null = null;
      if (input.kind === 'file') {
        const codec = codecs.find((c) => c.sniff(input.bytes, input.fileName));
        if (!codec) {
          const lower = trLower(input.fileName);
          if (!(lower.endsWith('.txt') || lower.endsWith('.md'))) throw fail('E_UNSUPPORTED_FORMAT', 'Bu dosya biçimi desteklenmiyor.');
        } else {
          try { ast = await codec.read(input.bytes); } catch { throw fail(codec.format === 'udf' ? 'E_UDF_FORMAT' : 'E_UNSUPPORTED_FORMAT', 'Dosya okunamadı.'); }
        }
      }
      const text = (ast ? ast.text : input.kind === 'text' ? input.text : new TextDecoder('utf-8', { fatal: false }).decode(input.bytes)).normalize('NFC');
      if (ast && text !== ast.text) ast = { ...ast, text };
      const id: DocumentId = `D-${String(x.docs.size + 1).padStart(3, '0')}`;
      const format = ast ? ast.format : input.kind === 'file' && trLower(input.fileName).endsWith('.md') ? 'md' : 'txt';
      const meta: VaultDocument = { id, format, displayName: input.kind === 'file' ? input.fileName : `Metin ${x.docs.size + 1}`, charCount: text.length };
      x.docs.set(id, { meta, text, ast, matches: [], prot: [], analyzed: false });
      x.lastDocId = id;
      const warnings: DocWarning[] = [...(ast?.warnings ?? [])];
      return { docId: id, text, warnings };
    },

    async analyze(docId, onUpdate) {
      const x = live();
      const d = x.docs.get(docId);
      if (!d) throw fail('E_NO_SESSION', 'Belge bulunamadı.');
      const t0 = ports.now();
      const nextId = (): MentionId => `M-${String(++x.seq).padStart(6, '0')}`;
      const det = toContract(d.text, docId, detectAll(d.text, year()), nextId);
      const ctx = { docId, currentYear: year(), options: x.options };
      const rules = names.detect(d.text, ctx).map((m) => ({ ...m, id: nextId() }));
      const base = [...det.matches, ...rules, ...amountMatches(d.text, docId, nextId)];
      d.matches = propagateSurnames(d.text, base, det.protectedSpans, nextId); d.prot = det.protectedSpans; d.analyzed = true;
      const timings: Record<string, number> = { deterministic: ports.now() - t0 };
      const ner = ports.ner;
      if (!ner || !x.options.nerEnabled || ner.status().state !== 'READY') {
        const r = result(x, docId, 'COMPLETE', timings);
        onUpdate(r);
        return r;
      }
      onUpdate(result(x, docId, 'DETERMINISTIC', timings));
      const t1 = ports.now();
      const found = await ner.detect(d.text, docId, (e) => {
        d.matches = propagateSurnames(d.text, [...base, ...e.matches.map((m) => ({ ...m, id: nextId() }))], det.protectedSpans, nextId);
        onUpdate(result(x, docId, 'NER_PARTIAL', timings));
      });
      d.matches = propagateSurnames(d.text, [...base, ...found.map((m) => ({ ...m, id: nextId() }))], det.protectedSpans, nextId);
      timings['ner'] = ports.now() - t1;
      const r = result(x, docId, 'COMPLETE', timings);
      onUpdate(r);
      return r;
    },

    async command(cmd: EntityCommand) {
      const x = live();
      const ov = x.ov;
      switch (cmd.type) {
        case 'SET_STATUS': ov.status.set(keyOfEntity(x, cmd.entityId), cmd.status); break;
        case 'SET_ROLE': ov.role.set(keyOfEntity(x, cmd.entityId), cmd.role); break;
        case 'SET_CATEGORY': ov.category.set(keyOfEntity(x, cmd.entityId), cmd.category); break;
        case 'SET_CANONICAL': ov.canonical.set(keyOfEntity(x, cmd.entityId), cmd.canonical.normalize('NFC').trim()); break;
        case 'MERGE': {
          const from = keyOfEntity(x, cmd.sourceId), to = keyOfEntity(x, cmd.targetId);
          if (from !== to) ov.mergedInto.set(from, to);
          break;
        }
        case 'REMOVE_MENTION': ov.removedMentions.add(cmd.mentionId); break;
        case 'ADD_MANUAL': {
          const d = x.docs.get(cmd.docId);
          if (!d || cmd.span.start < 0 || cmd.span.end > d.text.length || cmd.span.start >= cmd.span.end) throw fail('E_EDIT_INVALID', 'Geçersiz seçim.');
          const surface = d.text.slice(cmd.span.start, cmd.span.end);
          const spans: TextSpan[] = [cmd.span];
          if (cmd.applyToAll) {
            for (let i = d.text.indexOf(surface); i >= 0; i = d.text.indexOf(surface, i + 1)) {
              if (i !== cmd.span.start) spans.push({ start: i, end: i + surface.length });
            }
          }
          for (const span of spans) {
            ov.manual.push({
              id: `M-${String(++x.seq).padStart(6, '0')}`, docId: cmd.docId, span, text: surface, category: cmd.category, layer: 'MANUAL',
              confidence: 'HIGH', score: 1, ruleId: 'MANUAL', flags: [], ...(cmd.role ? { roleHint: cmd.role } : {}),
            });
          }
          break;
        }
        case 'UNPROTECT': ov.unprotected.push({ docId: cmd.docId, span: cmd.span }); break;
        case 'SET_OPTIONS': x.options = { ...x.options, ...cmd.patch }; break;
        case 'ACK_LEAK': ov.ackedLeaks.push({ docId: cmd.docId, span: cmd.span }); break;
        case 'DETACH_MENTION': case 'ASSIGN_MENTION': case 'RESOLVE_GROUP':
          throw fail('E_EDIT_INVALID', 'Bu komut eşbağ modülü bağlandığında (F2) etkinleşir.');
      }
      return result(x, lastDoc(x), 'COMPLETE', {});
    },

    async buildMasked(docId, templateId, task) {
      const { out } = await masking(docId);
      const tpl = templateId ? BUILT_IN_TEMPLATES.find((t) => t.id === templateId) : undefined;
      return tpl ? { ...out, withTemplate: fillTemplate(tpl, out.text, task) } : out;
    },

    async markIssued(_docId) {
      const x = live();
      const dv = derive(x);
      for (const e of dv.entities) {
        if (e.status !== 'MASK') continue;
        const list = x.issued.get(e.id) ?? [];
        if (!list.includes(e.token)) x.issued.set(e.id, [...list, e.token]);
        x.lockedTokens.set(e.id, e.token);
        const label = e.token.slice(1, e.token.lastIndexOf('_'));
        const idx = e.token.slice(e.token.lastIndexOf('_') + 1, -1);
        const n = /^[0-9]+$/.test(idx) ? Number(idx) : [...idx].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
        x.counters[label] = Math.max(x.counters[label] ?? 0, n);
      }
      x.locked = true;
      return info(x);
    },

    async unmask(response: string): Promise<UnmaskResult> {
      const x = live();
      return unmaskText(response.normalize('NFC'), toUnmaskView(buildVault(x, derive(x))));
    },

    async exportFile(req: ExportRequest) {
      const x = live();
      const name = `${req.source === 'MASKED' ? 'maskeli' : 'cozulmus'}-${hex(ports.rng, 1).slice(0, 4)}.${req.format}`;
      const mime = req.format === 'udf' ? 'application/octet-stream' : req.format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain;charset=utf-8';
      const codec = codecs.find((c) => c.format === req.format);
      if (req.source === 'MASKED') {
        const { out, edits, doc } = await masking(req.docId ?? lastDoc(x));
        if (out.leakFindings.length) throw fail('E_LEAK_DETECTED', 'Maskelenmemiş bilgi kaldı; önce bulguları giderin.');
        if (req.format === 'txt') return { fileName: name, mime, bytes: new TextEncoder().encode(out.text) };
        if (!codec || !doc.ast || doc.ast.format !== req.format) throw fail('E_UNSUPPORTED_FORMAT', 'Maskeli dosya yalnız kaynak biçiminde üretilir.');
        try {
          return { fileName: name, mime, bytes: await codec.write(codec.applyEdits(doc.ast, edits), { purpose: 'MASKED_EXPORT', fileName: name }) };
        } catch { throw fail(req.format === 'udf' ? 'E_UDF_FORMAT' : 'E_DOCX_FORMAT', 'Maskeli dosya üretilemedi.'); }
      }
      if (req.text === undefined) throw fail('E_EDIT_INVALID', 'Çözülmüş metin eksik.');
      if (req.format === 'txt') return { fileName: name, mime, bytes: new TextEncoder().encode(req.text) };
      if (!codec) throw fail('E_UNSUPPORTED_FORMAT', 'Bu çıktı biçimi bu derlemede yok.');
      const ast: DocumentAST = { format: req.format, text: req.text, blocks: [], marks: [], placeholders: [], warnings: [] };
      return { fileName: name, mime, bytes: await codec.write(ast, { purpose: 'UNMASKED_OUTPUT', fileName: name }) };
    },

    async exportVault(passphrase: string) {
      const x = live();
      const v = buildVault(x, derive(x));
      const plain = new TextEncoder().encode(JSON.stringify(serializeVault(v)));
      const file = await encryptVault(plain, passphrase);
      return new TextEncoder().encode(JSON.stringify(file));
    },

    async importVault(bytes: Uint8Array, passphrase: string) {
      let file: EncryptedVaultFile;
      try { file = JSON.parse(new TextDecoder().decode(bytes)) as EncryptedVaultFile; } catch { throw fail('E_CRYPTO', 'Kasa dosyası okunamadı.'); }
      const plain = await decryptVault(file, passphrase);
      const v = deserializeVault(JSON.parse(new TextDecoder().decode(plain)) as SerializedVault);
      plain.fill(0);
      wipeNow();
      const x = newSession(v.options);
      x.sessionId = v.sessionId; x.locked = v.locked; x.counters = { ...v.counters }; x.imported = v; x.amountK = v.amountScale?.k ?? null;
      s = x;
      return info(x);
    },

    async extendSession() {
      const x = live();
      x.expiresAt = ports.now() + x.options.sessionTimeoutMinutes * 60_000;
      return info(x);
    },

    async wipe(_reason: WipeReason) { wipeNow(); },

    async nerStatus() { return nerStatusNow(); },
  };
  return api;
}

/* ───────── Kasa serileştirme (Map → dizi). Yalnız şifreleme öncesi bellekte kullanılır. ───────── */

interface SerializedVault extends Omit<MaskingSessionVault, 'entities' | 'mentions' | 'groups' | 'tokenIndex' | 'twinIndex'> {
  readonly entities: Array<[string, EntityCluster]>;
  readonly mentions: Array<[string, ResolvedMention]>;
  readonly groups: Array<[string, GroupToken]>;
  readonly tokenIndex: Array<[string, string]>;
  readonly twinIndex: Array<[string, MaskingSessionVault['twinIndex'] extends ReadonlyMap<string, infer V> ? V : never]>;
}
export function serializeVault(v: MaskingSessionVault): SerializedVault {
  return { ...v, entities: [...v.entities], mentions: [...v.mentions], groups: [...v.groups], tokenIndex: [...v.tokenIndex], twinIndex: [...v.twinIndex] };
}
export function deserializeVault(o: SerializedVault): MaskingSessionVault {
  return { ...o, entities: new Map(o.entities), mentions: new Map(o.mentions), groups: new Map(o.groups), tokenIndex: new Map(o.tokenIndex), twinIndex: new Map(o.twinIndex) };
}
