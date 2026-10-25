// packages/core-engine/src/unmask/rehydrate.ts
// Geri çözme: LLM yanıtındaki etiketleri ve ikiz adları bulur, özgün değerle değiştirir ve ekleri özgün
// varlığın ses profiline göre yeniden çeker. Kasanın tamamını değil, yalnız gerekli izdüşümü (UnmaskView) okur.

import { foldKey, trUpper, isLetter, isUppercaseContext } from '../text/turkish';
import { rehydrateSuffix, parseSuffix } from '../morphology/morphology';
import { findAmounts, formatTrNumber } from '../fuzz/amount';
import {
  tokenKey, CATEGORY_SPECS, ROLE_TOKEN_LABELS,
  type AmountStyle, type Confidence, type EntityId, type GroupId, type MaskingSessionVault, type PhonProfile, type TokenVariant,
  type UnmaskIssue, type UnmaskReplacement, type UnmaskResult,
} from '../types/contracts';

export interface UnmaskEntity {
  readonly id: EntityId;
  readonly tokens: readonly string[];
  readonly canonical: string;
  readonly phon: PhonProfile;
  readonly givenCanonical?: string;
  readonly phonGiven?: PhonProfile;
  readonly twin?: { readonly full: string; readonly given?: string; readonly surname?: string };
}
export interface UnmaskGroup { readonly id: GroupId; readonly token: string; readonly value: string; readonly phon: PhonProfile; readonly twinValue?: string }
export interface UnmaskView {
  readonly entities: readonly UnmaskEntity[];
  readonly groups: readonly UnmaskGroup[];
  readonly amounts?: { readonly k: number; readonly pairs: ReadonlyArray<{ readonly fuzzed: string; readonly original: string }> };
}

/** Kasadan geri çözme izdüşümü. Yalnız MASK durumundaki varlıklar ve verilmiş etiketler dahil edilir. */
export function toUnmaskView(v: MaskingSessionVault): UnmaskView {
  const entities: UnmaskEntity[] = [];
  for (const e of v.entities.values()) {
    if (e.status !== 'MASK' && e.issuedTokens.length === 0) continue;
    entities.push({
      id: e.id, tokens: [...new Set([e.token, ...e.issuedTokens])], canonical: e.canonical, phon: e.phon,
      ...(e.givenCanonical !== undefined ? { givenCanonical: e.givenCanonical } : {}),
      ...(e.phonGiven !== undefined ? { phonGiven: e.phonGiven } : {}),
      ...(e.twin !== undefined ? { twin: { full: e.twin.full, ...(e.twin.given ? { given: e.twin.given } : {}), ...(e.twin.surname ? { surname: e.twin.surname } : {}) } } : {}),
    });
  }
  const groups: UnmaskGroup[] = [...v.groups.values()].map((g) => ({
    id: g.id, token: g.token, value: g.value, phon: g.phon, ...(g.twinValue !== undefined ? { twinValue: g.twinValue } : {}),
  }));
  return v.amountScale ? { entities, groups, amounts: { k: v.amountScale.k, pairs: v.amountScale.pairs } } : { entities, groups };
}

type Target =
  | { kind: 'E'; e: UnmaskEntity; part: 'FULL' | 'GIVEN' }
  | { kind: 'G'; g: UnmaskGroup }
  | { kind: 'A'; value: number; style: AmountStyle }
  | null;
interface Hit { start: number; end: number; matched: string; variant: TokenVariant; target: Target }

const BRACKET_RE = /\\?\[\s*([\p{L}\p{N}_ .\\-]{2,48}?)\s*\\?\]/gu;   // [DAVACI_1], [Davacı 1], \[DAVACI\_1\]
const BARE_RE = /\p{L}+(?:\\?_[\p{L}\p{N}]+)+/gu;                      // DAVACI_1 (köşeli işaret düşmüş)
const TWIN_RE = /《\s*([^》\n]{1,80}?)\s*》/gu;                          // 《Kaan Korkmaz》
const LEFTOVER_RE = /\[[A-ZÇĞİÖŞÜ]+(?:_[A-ZÇĞİÖŞÜ0-9]+)+\]|《|》/gu;
/** Bilinen etiket gövdeleri (katlanmış). Kasada olmayan ama bu gövdeyi taşıyan etiket = LLM'in uydurduğu etiket. */
const KNOWN_LABELS: ReadonlySet<string> = new Set(
  [...Object.values(CATEGORY_SPECS).map((c) => c.tokenLabel), ...Object.values(ROLE_TOKEN_LABELS), 'SOYAD', 'AD'].map((l) => tokenKey(l)));
const looksLikeOurToken = (key: string): boolean => {
  const m = key.match(/^(.+)_([0-9]+|[A-Z]{1,2})$/);
  return !!m && KNOWN_LABELS.has(m[1]!);
};

export function unmask(input: string, view: UnmaskView): UnmaskResult {
  const text = input.replace(/\r\n?/g, '\n');
  const byToken = new Map<string, UnmaskEntity>();
  for (const e of view.entities) for (const t of e.tokens) byToken.set(tokenKey(t), e);
  const byGroup = new Map(view.groups.map((g) => [tokenKey(g.token), g] as const));
  const twinFull = new Map<string, UnmaskEntity>(), twinGiven = new Map<string, UnmaskEntity>();
  const twinSurname = new Map<string, UnmaskGroup | UnmaskEntity>();
  for (const e of view.entities) if (e.twin) {
    twinFull.set(foldKey(e.twin.full), e);
    if (e.twin.given) twinGiven.set(foldKey(e.twin.given), e);
  }
  for (const e of view.entities) if (e.twin?.surname) {
    const k = foldKey(e.twin.surname);
    const shared = view.groups.find((g) => g.twinValue !== undefined && foldKey(g.twinValue) === k);
    twinSurname.set(k, shared ?? e);   // aynı ikiz soyadını paylaşan aile → grup (özgün ortak soyadı)
  }
  const fromKey = (k: string): Target => {
    const e = byToken.get(k); if (e) return { kind: 'E', e, part: 'FULL' };
    const g = byGroup.get(k); if (g) return { kind: 'G', g };
    return null;
  };
  const fromSurname = (k: string): Target => {
    const s = twinSurname.get(k);
    if (!s) return null;
    return 'token' in s ? { kind: 'G', g: s } : { kind: 'E', e: s, part: 'FULL' };
  };

  // 1) Adayları topla (öncelik: ikiz işaretli > köşeli etiket > çıplak etiket > işaretsiz ikiz)
  const hits: Hit[] = [];
  const free = (s: number, e: number): boolean => !hits.some((h) => s < h.end && h.start < e);
  for (const m of text.matchAll(TWIN_RE)) {
    const k = foldKey(m[1]!);
    const e = twinFull.get(k) ?? twinGiven.get(k);
    const target: Target = e ? { kind: 'E', e, part: twinFull.has(k) ? 'FULL' : 'GIVEN' } : fromSurname(k);
    hits.push({ start: m.index!, end: m.index! + m[0].length, matched: m[0], variant: 'TWIN', target });
  }
  for (const m of text.matchAll(BRACKET_RE)) {
    const s = m.index!, e = s + m[0].length;
    if (!free(s, e)) continue;
    const key = tokenKey(m[1]!);
    const known = byToken.has(key) || byGroup.has(key);
    if (!known && !looksLikeOurToken(key)) continue;   // sıradan köşeli parantez ("[bkz. ek 1]") dokunulmaz
    const exact = known && (byToken.get(key)?.tokens.includes(m[0]) || byGroup.get(key)?.token === m[0]);
    hits.push({ start: s, end: e, matched: m[0], variant: exact ? 'EXACT' : 'NORMALIZED', target: fromKey(key) });
  }
  for (const m of text.matchAll(BARE_RE)) {
    const s = m.index!, e = s + m[0].length;
    const key = tokenKey(m[0]);
    if (!free(s, e) || (!byToken.has(key) && !byGroup.has(key))) continue;
    hits.push({ start: s, end: e, matched: m[0], variant: 'BARE', target: fromKey(key) });
  }
  const wordAt = (s: number, e: number): boolean => !isLetter(text[s - 1]) && !isLetter(text[e]);
  const scanPlain = (needle: string, variant: TokenVariant, target: Target): void => {
    for (let i = text.indexOf(needle); needle && i >= 0; i = text.indexOf(needle, i + 1)) {
      const e = i + needle.length;
      if (wordAt(i, e) && free(i, e)) hits.push({ start: i, end: e, matched: needle, variant, target });
    }
  };
  for (const e of view.entities) if (e.twin) scanPlain(e.twin.full, 'TWIN_BARE', { kind: 'E', e, part: 'FULL' });
  for (const e of view.entities) if (e.twin?.given) scanPlain(e.twin.given, 'TWIN_PART', { kind: 'E', e, part: 'GIVEN' });
  for (const e of view.entities) if (e.twin?.surname) scanPlain(e.twin.surname, 'TWIN_PART', fromSurname(foldKey(e.twin.surname)));
  if (view.amounts) for (const a of findAmounts(text)) {
    if (free(a.span.start, a.span.end))
      hits.push({ start: a.span.start, end: a.span.end, matched: text.slice(a.span.start, a.span.end), variant: 'EXACT', target: { kind: 'A', value: a.value, style: a.style } });
  }
  hits.sort((a, b) => a.start - b.start);
  const pairs = new Map((view.amounts?.pairs ?? []).map((p) => [p.fuzzed, p.original] as const));

  // 2) Çıktıyı kur
  let out = '', cursor = 0, twins = 0, unknown = 0, corrections = 0, amountSuggestions = 0, amountHits = 0;
  const replacements: UnmaskReplacement[] = [], issues: UnmaskIssue[] = [];
  for (const h of hits) {
    out += text.slice(cursor, h.start);
    if (h.target?.kind === 'A') {   // Tutar: birebir eşleşen ölçekli değer geri alınır, diğerine yalnız öneri
      amountHits++;
      const orig = pairs.get(h.matched);
      const outStart = out.length;
      out += orig ?? h.matched;
      if (orig === undefined) {
        amountSuggestions++;
        issues.push({ kind: 'AMOUNT_DERIVED', outSpan: { start: outStart, end: out.length },
          message: 'Bu tutar ölçeklenmiş değerlerden türetilmiş olabilir.', suggestion: formatTrNumber(h.target.value / view.amounts!.k, h.target.style) });
      }
      cursor = h.end; continue;
    }
    let suffixIn: string | undefined, apo = "'", end = h.end;
    const after = text.slice(h.end).match(/^(['’`´]?)(\p{L}+)/u);
    if (after && (after[1] || parseSuffix(after[2]!))) { suffixIn = after[2]!; apo = after[1] || "'"; end = h.end + after[0].length; }
    const outStart = out.length;
    if (h.variant.startsWith('TWIN')) twins++;
    if (!h.target) {
      unknown++;
      out += text.slice(h.start, end);
      issues.push({ kind: 'UNKNOWN_TOKEN', outSpan: { start: outStart, end: out.length }, message: `Kasada karşılığı olmayan etiket: ${h.matched}` });
      replacements.push({ inSpan: { start: h.start, end }, outSpan: { start: outStart, end: out.length }, entityId: null,
        matched: h.matched, restored: text.slice(h.start, end), suffixCorrected: false, variant: h.variant, confidence: 'LOW' });
      cursor = end; continue;
    }
    let base: string, phon: PhonProfile;
    if (h.target.kind === 'E') {
      const useGiven = h.target.part === 'GIVEN' && h.target.e.givenCanonical !== undefined;
      base = useGiven ? h.target.e.givenCanonical! : h.target.e.canonical;
      phon = useGiven && h.target.e.phonGiven ? h.target.e.phonGiven : h.target.e.phon;
    } else {
      base = h.target.g.value; phon = h.target.g.phon;
    }
    const ls = text.lastIndexOf('\n', h.start) + 1, le = text.indexOf('\n', h.end);
    if (isUppercaseContext(text.slice(ls, le < 0 ? text.length : le))) base = trUpper(base);
    let suffixOut: string | undefined, corrected = false, conf: Confidence = h.variant === 'TWIN_PART' ? 'MEDIUM' : 'HIGH';
    if (suffixIn !== undefined) {
      const r = rehydrateSuffix(suffixIn, phon);
      suffixOut = r.suffixOut; corrected = r.changed; if (corrected) corrections++;
      const span = { start: outStart, end: outStart + base.length + apo.length + suffixOut.length };
      if (!r.morphemes) { conf = 'LOW'; issues.push({ kind: 'SUFFIX_UNPARSED', outSpan: span, message: `"${suffixIn}" eki çözümlenemedi; elle denetleyin.` }); }
      else if (phon.confidence === 'LOW') { conf = 'LOW'; issues.push({ kind: 'LOW_PHON_CONFIDENCE', outSpan: span, message: 'Ad yabancı kökenli olabilir; ek uyumunu denetleyin.' }); }
    }
    const restored = suffixOut !== undefined ? base + apo + suffixOut : base;
    out += restored;
    const ids = h.target.kind === 'E' ? { entityId: h.target.e.id } : { entityId: null, groupId: h.target.g.id };
    if (h.target.kind === 'G') issues.push({ kind: 'GROUP_TOKEN', outSpan: { start: outStart, end: out.length }, message: `"${base}" birden çok kişiyi gösterebilir; doğru kişiyi seçin.` });
    replacements.push({ inSpan: { start: h.start, end }, outSpan: { start: outStart, end: out.length }, ...ids, matched: h.matched, restored,
      ...(suffixIn !== undefined ? { suffixIn } : {}), ...(suffixOut !== undefined ? { suffixOut } : {}),
      suffixCorrected: corrected, variant: h.variant, confidence: conf });
    cursor = end;
  }
  out += text.slice(cursor);

  for (const m of out.matchAll(LEFTOVER_RE))
    if (!replacements.some((r) => m.index! >= r.outSpan.start && m.index! < r.outSpan.end))
      issues.push({ kind: 'LEFTOVER_MARKER', outSpan: { start: m.index!, end: m.index! + m[0].length }, message: 'Çözülmemiş işaret kaldı.' });
  return {
    text: out, replacements, issues,
    stats: { tokensFound: hits.length - amountHits, tokensResolved: hits.length - amountHits - unknown, twinsFound: twins, suffixCorrections: corrections, unknownTokens: unknown, amountSuggestions },
  };
}
