// packages/core-engine/src/names/ruleDetector.ts
// Kural tabanlı ad, şirket ve kurum dedektörü (MASTER 3.3.4). Model olmadan çalışır; NER'in yedeğidir.
// Bu sürüm: K1 (rol ipucu), K2/K3 (unvan), K5 (baş harf), K6 (şirket), K7 (kurum) ve dışlamalar.
// K4 (ad sözlüğü) ve K8 (soyadı sözlüğü + kesme): names/data (kaynak: scripts/build-name-lexicon.mjs).
// Kurallar: lookbehind yok (R-02), /i yok, bağlam lowerView üzerinde (R-03).

import { judgeSignatures } from './judgeSignatures';
import givenData from './data/given-names.json';
import surnameData from './data/surnames.json';
import { foldKey, leftBoundary, lowerView, rightBoundary } from '../text/turkish';
import {
  ROLE_CUES, type Confidence, type DetectContext, type EntityCategory, type EntityMatch, type LegalRole, type NameRuleDetectorPort,
} from '../types/contracts';

const IL = ['adana','adıyaman','afyonkarahisar','ağrı','amasya','ankara','antalya','artvin','aydın','balıkesir','bilecik','bingöl','bitlis',
  'bolu','burdur','bursa','çanakkale','çankırı','çorum','denizli','diyarbakır','edirne','elazığ','erzincan','erzurum','eskişehir','gaziantep',
  'giresun','gümüşhane','hakkari','hatay','ısparta','mersin','istanbul','izmir','kars','kastamonu','kayseri','kırklareli','kırşehir','kocaeli',
  'konya','kütahya','malatya','manisa','kahramanmaraş','mardin','muğla','muş','nevşehir','niğde','ordu','rize','sakarya','samsun','siirt',
  'sinop','sivas','tekirdağ','tokat','trabzon','tunceli','şanlıurfa','uşak','van','yozgat','zonguldak','aksaray','bayburt','karaman',
  'kırıkkale','batman','şırnak','bartın','ardahan','iğdır','yalova','karabük','kilis','osmaniye','düzce','ısparta','isparta'];
const MISC = ['ocak','şubat','mart','nisan','mayıs','haziran','temmuz','ağustos','eylül','ekim','kasım','aralık',
  'pazartesi','salı','çarşamba','perşembe','cuma','cumartesi','pazar',
  'türkiye','cumhuriyeti','cumhuriyet','t.c','tc','davacı','davalı','vekili','vekil','konu','açıklamalar','sonuç','istem','talep','deliller',
  'hukuki','sebepler','mahkemesi','mahkemesine','mahkemesi\'ne','dairesi','hukuk','ceza','asliye','sulh','icra','ağır','bölge','adliye','idare',
  'yargıtay','danıştay','anayasa','kanunu','kanun','yönetmeliği','tüzüğü','başsavcılığı','savcılığı','noterliği','dosya','no','esas','karar',
  'tarih','sayı','adres','tel','iban','mersis','vkn','tckn','kimlik','sayın','sn','av','dr','bey','hanım','ve','ile','mah','cad','sok','bulvarı',
  'mahallesi','caddesi','sokak','sokağı','apt','daire','kat','ilçesi','ili','merkez','yukarıda','aşağıda','gereği','gereğinin','arz','ederim',
  'saygılarımla','ek','ekler','vekaletname','dilekçe','ihtarname','ilgili','muhatap','keşide','eden'];
const EXCLUDED: ReadonlySet<string> = new Set([...IL, ...MISC].map(foldKey));

const COMPANY_TYPES = ['Anonim Şirketi', 'Limited Şirketi', 'Kollektif Şirketi', 'Komandit Şirketi', 'Adi Ortaklığı', 'Kooperatifi',
  'Koll. Şti.', 'Kom. Şti.', 'Ltd. Şti.', 'LTD. ŞTİ.', 'A.Ş.', 'Holding', 'HOLDİNG', 'Vakfı', 'Derneği', 'Koop.', 'Şti.', 'ŞTİ.', 'AŞ'];
const SECTOR = new Set(['San.', 'Tic.', 'İnş.', 'Paz.', 'İth.', 'İhr.', 'Taah.', 'Turz.', 'Ltd.', 've', '&', 'SAN.', 'TİC.', 'İNŞ.', 'LTD.', 'VE']);
const INSTITUTION_HEADS = ['Genel Müdürlüğü', 'Bakanlığı', 'Belediyesi', 'Başkanlığı', 'Müdürlüğü', 'Valiliği', 'Kaymakamlığı', 'Üniversitesi',
  'Kurumu', 'Kurulu', 'Müsteşarlığı', 'Rektörlüğü', 'Mahkemesi', 'Dairesi'];
const INSTITUTION_ABBREVIATIONS = ['MEB', 'YÖK', 'SGK', 'TÜİK', 'TBMM', 'ÖSYM', 'RTÜK', 'HSK', 'UYAP'];
const HON_BEFORE: ReadonlyArray<readonly [string, EntityMatch['honorificBefore'] & string]> = [['sayın', 'sayın'], ['sn.', 'sn.'], ['bayan', 'bayan'], ['bay', 'bay']];
const HON_AFTER: ReadonlyArray<readonly [string, EntityMatch['honorificAfter'] & string]> = [['beyefendi', 'beyefendi'], ['hanımefendi', 'hanımefendi'], ['bey', 'bey'], ['hanım', 'hanım']];

/** Ad belirteci: "Ahmet" ya da "AHMET". Kesme işaretinden önce durur. */
const NAME_TOKEN = /^(\p{Lu}\p{Ll}+|\p{Lu}{2,})(?![\p{L}\p{N}])/u;
const isNameWord = (w: string): boolean => NAME_TOKEN.test(w) && !EXCLUDED.has(foldKey(w));

/** Sözlükler büyük/küçük harf ve Türkçe karakter katlanmış anahtarla sorgulanır ("YILMAZ" = "Yılmaz"). */
const GIVEN: ReadonlyMap<string, 'E' | 'K' | 'U'> = new Map(Object.entries(givenData.names as Record<string, 'E' | 'K' | 'U'>).map(([n, g]) => [foldKey(n), g]));
const SURNAMES: ReadonlySet<string> = new Set((surnameData.names as string[]).map(foldKey));
export const isGivenName = (w: string): boolean => GIVEN.has(foldKey(w));
export const isSurname = (w: string): boolean => SURNAMES.has(foldKey(w));
export const genderOf = (given: string): 'E' | 'K' | 'U' => GIVEN.get(foldKey(given)) ?? 'U';

interface Hit { start: number; end: number; category: EntityCategory; confidence: Confidence; rule: string; role?: LegalRole;
  honorificBefore?: EntityMatch['honorificBefore']; honorificAfter?: EntityMatch['honorificAfter']; prio: number }

/** pos'tan başlayan, satır içi tek boşluklarla ayrılmış en çok max ad belirteci. */
function readNames(text: string, pos: number, max: number): { start: number; end: number; words: string[] } | null {
  const words: string[] = [];
  let i = pos, start = -1, end = -1;
  while (words.length < max) {
    const m = text.slice(i).match(NAME_TOKEN);
    if (!m || !isNameWord(m[1]!)) break;
    if (start < 0) start = i;
    words.push(m[1]!); end = i + m[1]!.length;
    let j = end;
    while (text[j] === ' ' || text[j] === '\t') j++;
    if (j === end) break;
    i = j;
  }
  return words.length ? { start, end, words } : null;
}
const skipSpaces = (text: string, i: number): number => { while (text[i] === ' ' || text[i] === '\t') i++; return i; };
const startsWithAt = (text: string, i: number, s: string): boolean => text.startsWith(s, i) && rightBoundary(text, i + s.length, (c) => /\p{L}/u.test(c));

function companyTypeAt(text: string, i: number): string | null {
  for (const t of COMPANY_TYPES) if (startsWithAt(text, i, t)) return t;
  return null;
}

function k6Companies(text: string, out: Hit[]): void {
  for (const t of COMPANY_TYPES) {
    for (let i = text.indexOf(t); i >= 0; i = text.indexOf(t, i + 1)) {
      if (!leftBoundary(text, i) || !startsWithAt(text, i, t)) continue;
      // Sola genişle
      let start = i, n = 0, cursor = i;
      while (n < 10) {
        let j = cursor - 1;
        while (j >= 0 && (text[j] === ' ' || text[j] === '\t')) j--;
        if (j < 0 || j === cursor - 1 && cursor !== i) break;
        let k = j;
        while (k >= 0 && !/\s/.test(text[k]!) && !':,;('.includes(text[k]!)) k--;
        const w = text.slice(k + 1, j + 1);
        if (!w) break;
        const ok = (/^\p{Lu}[\p{L}\p{N}&.\-]*$/u.test(w) || SECTOR.has(w)) && !ROLE_WORDS.has(foldKey(w.replace(/[.:]+$/, ''))) && !HEAD_WORDS.has(w);
        if (!ok) break;
        start = k + 1; cursor = k + 1; n++;
      }
      while (start < i && SECTOR.has(text.slice(start, text.indexOf(' ', start)))) start = text.indexOf(' ', start) + 1;
      if (start === i) continue;
      out.push({ start, end: i + t.length, category: 'SIRKET', confidence: 'HIGH', rule: 'L3.RULE.SIRKET', prio: 5 });
    }
  }
}
const HEAD_WORDS: ReadonlySet<string> = new Set(INSTITUTION_HEADS.map((h) => h.split(' ').at(-1)!));
const ROLE_WORDS: ReadonlySet<string> = new Set(ROLE_CUES.map(([c]) => foldKey(c)).concat(['vekili', 'davaci', 'davali'].map(foldKey)));

function k7Institutions(text: string, out: Hit[]): void {
  const view = lowerView(text);
  for (const h of INSTITUTION_HEADS) {
    const lower = h.toLocaleLowerCase('tr-TR');
    for (let i = view.indexOf(lower); i >= 0; i = view.indexOf(lower, i + 1)) {
      if (!leftBoundary(text, i)) continue;
      const end = i + h.length;
      const suffix = view.slice(end).match(/^(?:n(?:dan|den|dadır|dedir|daki|deki|daki|deki|da|de|ın|in|un|ün|a|e|ı|i|u|ü|ca|ce)|yla|yle)(?![\p{L}\p{N}])/u)?.[0] ?? '';
      if (!suffix && !rightBoundary(text, end, (c) => /\p{L}/u.test(c))) continue;
      let start = i, cursor = i;
      for (let n = 0; n < 5; n++) {
        let j = cursor - 1;
        if (text[j] !== ' ') break;
        while (j >= 0 && text[j] === ' ') j--;
        let k = j;
        while (k >= 0 && /[\p{L}\p{N}.]/u.test(text[k]!)) k--;
        const w = text.slice(k + 1, j + 1);
        if (!/^(\p{Lu}[\p{L}.]*|\p{N}+\.)$/u.test(w)) break;
        start = k + 1; cursor = k + 1;
      }
      if (start === i) continue;
      out.push({ start, end: end + suffix.length, category: 'KURUM', confidence: 'HIGH', rule: 'L3.RULE.KURUM', prio: 3 });
    }
  }
  const abbreviations = new Set(INSTITUTION_ABBREVIATIONS);
  for (const hit of out.filter((h) => h.category === 'KURUM')) {
    const following = text.slice(hit.end).match(/^[ \t]*\(([\p{Lu}]{2,10})\)/u);
    const initials = text.slice(hit.start, hit.end).split(/[ \t]+/).map((w) => w[0]).join('');
    if (following && following[1] === initials.toLocaleUpperCase('tr-TR')) abbreviations.add(following[1]);
  }
  for (const abbr of abbreviations) {
    for (let i = text.indexOf(abbr); i >= 0; i = text.indexOf(abbr, i + 1)) {
      if (leftBoundary(text, i) && rightBoundary(text, i + abbr.length, (c) => /[\p{L}\p{N}]/u.test(c)))
        out.push({ start: i, end: i + abbr.length, category: 'KURUM', confidence: 'HIGH', rule: 'L3.RULE.KURUM_KISALTMA', prio: 3 });
    }
  }
}

export function detectNames(text: string): Hit[] {
  const view = lowerView(text);
  const out: Hit[] = [];
  k6Companies(text, out);
  k7Institutions(text, out);
  for (const signature of judgeSignatures(text)) {
    if (signature.name) out.push({ ...signature.name, category: 'KISI', confidence: 'HIGH', rule: 'L3.RULE.HAKIM_IMZA', role: 'HAKIM', prio: 6 });
  }

  // K1: rol ipucu
  const cues = [...ROLE_CUES].sort((a, b) => b[0].length - a[0].length);
  const taken: Array<[number, number]> = [];
  for (const [cue, role] of cues) {
    for (let i = view.indexOf(cue); i >= 0; i = view.indexOf(cue, i + 1)) {
      const e = i + cue.length;
      if (taken.some(([s, t]) => i < t && s < e)) continue;
      if (!leftBoundary(view, i) || (!cue.endsWith('.') && !rightBoundary(view, e))) continue;
      taken.push([i, e]);
      let p = skipSpaces(text, e);
      if (text[p] === ':') p = skipSpaces(text, p + 1);
      for (const t of ['Av.', 'AV.', 'Dr.', 'DR.']) if (text.startsWith(t, p)) { p = skipSpaces(text, p + t.length); break; }
      const r = readNames(text, p, 4);
      if (!r) continue;
      const after = skipSpaces(text, r.end);
      if (companyTypeAt(text, after) || SECTOR.has(text.slice(after, text.indexOf(' ', after)))) continue;   // şirket: K6
      out.push({ start: r.start, end: r.end, category: 'KISI', confidence: 'HIGH', rule: 'L3.RULE.ROL_IPUCU', role, prio: 4 });
    }
  }

  // K2: unvan önde
  for (const [h, tag] of HON_BEFORE) {
    for (let i = view.indexOf(h); i >= 0; i = view.indexOf(h, i + 1)) {
      if (!leftBoundary(view, i) || (!h.endsWith('.') && !rightBoundary(view, i + h.length))) continue;
      const r = readNames(text, skipSpaces(text, i + h.length), 3);
      if (r && r.start > i + h.length) out.push({ start: r.start, end: r.end, category: 'KISI', confidence: 'MEDIUM', rule: 'L3.RULE.UNVAN_ONDE', honorificBefore: tag, prio: 2 });
    }
  }
  // K3: unvan arkada ("Ahmet Bey", "Ayşe Kaya Hanım")
  for (const [h, tag] of HON_AFTER) {
    for (let i = view.indexOf(h); i >= 0; i = view.indexOf(h, i + 1)) {
      if (!rightBoundary(view, i + h.length) || i < 2 || text[i - 1] !== ' ') continue;
      // geriye doğru 1-3 ad belirteci
      let start = i - 1, words = 0, cursor = i - 1;
      while (words < 3) {
        let k = cursor - 1;
        while (k >= 0 && /\p{L}/u.test(text[k]!)) k--;
        const w = text.slice(k + 1, cursor);
        if (!isNameWord(w)) break;
        start = k + 1; words++;
        if (text[k] !== ' ') break;
        cursor = k;
      }
      if (words) out.push({ start, end: i - 1, category: 'KISI', confidence: 'MEDIUM', rule: 'L3.RULE.UNVAN_ARKADA', honorificAfter: tag, prio: 2 });
    }
  }
  // K4: sözlükteki ad + 1-2 ad belirteci. Ardından gelen sözcük soyadı sözlüğündeyse ORTA, değilse DÜŞÜK
  // (inceleme kuyruğu; "Deniz Kuvvetleri" gibi sıradan sözcük çakışmaları otomatik maskelenmez).
  for (const m of text.matchAll(/\p{Lu}\p{Ll}+|\p{Lu}{3,}/gu)) {
    const s = m.index!;
    if (!leftBoundary(text, s) || !isGivenName(m[0]) || EXCLUDED.has(foldKey(m[0]))) continue;
    const r = readNames(text, s, 3);
    if (!r || r.words.length < 2) continue;
    const rest = r.words.slice(1);
    const known = rest.some(isSurname);
    // Tümü büyük harfli satırlarda (başlıklar) yalnız soyadı sözlüğüyle doğrulanan dizi kabul edilir.
    if (!known && r.words.every((w) => w === w.toLocaleUpperCase('tr-TR'))) continue;
    out.push({ start: r.start, end: r.end, category: 'KISI', confidence: known ? 'MEDIUM' : 'LOW', rule: 'L3.RULE.AD_SOZLUK', prio: 1 });
  }
  // K8: cümle ortasında büyük harfli sözcük + kesme + ek, sözcük soyadı sözlüğünde ("... ile Yılmaz'ın ...")
  for (const m of text.matchAll(/(\p{Lu}\p{Ll}+)['’]\p{Ll}+/gu)) {
    const s = m.index!, w = m[1]!;
    if (!leftBoundary(text, s) || !isSurname(w) || EXCLUDED.has(foldKey(w))) continue;
    const before = text.slice(Math.max(0, s - 3), s);
    if (s === 0 || /[.!?:]\s*$|\n\s*$/.test(before)) continue;      // cümle başı değil
    out.push({ start: s, end: s + w.length, category: 'KISI', confidence: 'LOW', rule: 'L3.RULE.SOYAD_KESME', prio: 0 });
  }
  // K5: baş harf + soyadı ("A. Yılmaz")
  for (const m of text.matchAll(/\p{Lu}\. ?(\p{Lu}\p{Ll}+)/gu)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e) || EXCLUDED.has(foldKey(m[1]!))) continue;
    out.push({ start: s, end: e, category: 'KISI', confidence: 'MEDIUM', rule: 'L3.RULE.BAS_HARF', prio: 1 });
  }

  // Örtüşmeleri öncelik ve uzunlukla çöz
  out.sort((a, b) => b.prio - a.prio || (b.end - b.start) - (a.end - a.start));
  const kept: Hit[] = [];
  for (const h of out) if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  return kept.sort((a, b) => a.start - b.start);
}

export function createNameRuleDetector(): NameRuleDetectorPort {
  return {
    detect(text: string, ctx: DetectContext): EntityMatch[] {
      const score = { HIGH: 0.95, MEDIUM: 0.7, LOW: 0.4 } as const;
      return detectNames(text).map((h, n) => {
        const surface = text.slice(h.start, h.end);
        return {
          id: `RULE-${n + 1}`, docId: ctx.docId, span: { start: h.start, end: h.end }, text: surface, category: h.category,
          layer: 'L3_RULE' as const, confidence: h.confidence, score: score[h.confidence], ruleId: h.rule, normalized: foldKey(surface),
          flags: [], ...(h.role ? { roleHint: h.role } : {}),
          ...(h.honorificBefore ? { honorificBefore: h.honorificBefore } : {}), ...(h.honorificAfter ? { honorificAfter: h.honorificAfter } : {}),
        };
      });
    },
  };
}
