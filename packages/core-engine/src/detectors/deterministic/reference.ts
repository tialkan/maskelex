// packages/core-engine/src/detectors/deterministic/reference.ts (başvuru uygulaması)
// Katman 1 (sağlamalı kimlikler, iletişim, plaka) ve Katman 2'nin numara tarafı (dosya no, tapu, yevmiye).
// Lookbehind YOK: sınırlar leftBoundary/rightBoundary ile denetlenir.

import { judgeSignatures } from '../../names/judgeSignatures';
import { isValidTckn, isValidVkn, mersisKind, isValidTrIban, cardNetwork } from '../../validators/checksums';
import { leftBoundary, rightBoundary, isAlnum, isDigit, lowerView, trLower } from '../../text/turkish';
import { findDockets, classifyDockets } from '../../legal/citation';
import type { DocumentId, EntityCategory, EntityMatch, MentionId, ProtectedSpan } from '../../types/contracts';

export type Cat = 'TCKN' | 'YKN' | 'VKN' | 'MERSIS' | 'IBAN' | 'KART' | 'TELEFON' | 'EPOSTA' | 'PLAKA'
  | 'DOSYA_NO' | 'TAPU' | 'YEVMIYE' | 'DOGUM_TARIHI' | 'PASAPORT' | 'TUTAR' | 'OZEL';
export interface Raw {
  start: number; end: number; category: Cat; ruleId: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'; normalized?: string; flags?: string[];
}
export interface Protected { start: number; end: number; reason: 'ICTIHAT_KUNYESI' | 'KANUN_ATFI'; ruleId: string; ownCaseSuspect: boolean }

// Bağlam pencereleri HER ZAMAN Türkçe küçük harfe çevrilir; desenler küçük harfli ve /i bayraksızdır.
const ctxLeft = (t: string, s: number, n = 40): string => trLower(t.slice(Math.max(0, s - n), s));
const ctxRight = (t: string, e: number, n = 40): string => trLower(t.slice(e, e + n));
const digitsOnly = (s: string): string => s.replace(/[^0-9]/g, '');

// ---------- Kanun atıfları (KORUNAN; plaka ve tutar yanlış pozitiflerini keser) ----------
export const LAW_ABBR = ['TBK', 'TMK', 'TCK', 'HMK', 'CMK', 'TTK', 'İİK', 'IIK', 'VUK', 'GVK', 'KVK', 'KVKK', 'AY', 'AYM', 'İYUK', 'IYUK',
  'BK', 'MK', 'SGK', 'KHK', 'AAÜT', 'AAUT', 'TKHK', 'FSEK', 'SMK', 'KMK', 'DMK', 'ÖTV', 'KDV', 'HD', 'CD', 'HGK', 'CGK', 'BAM', 'BİM'];
const LAW_REF_RE = new RegExp(
  '([0-9]{3,4})\\s+sayılı(?:\\s+[\\p{Lu}][\\p{L}\\.]*){0,5}' +                       // 6098 sayılı Türk Borçlar Kanunu
  '|(?:' + [...LAW_ABBR].sort((a, b) => b.length - a.length).join('|') + ')(?:\\s*(?:m\\.|md\\.|madde|maddesi|\'?nin|\'?nın|\'?un|\'?ün)\\s*[0-9]+(?:\\/[0-9]+)?(?:\\.\\s?(?:madde|maddesi|fıkra|bent))?)?' +
  '|[0-9]{3,4}\\s*S\\.\\s?K\\.', 'gu');

export function findLawRefs(text: string): Protected[] {
  const out: Protected[] = [];
  for (const m of text.matchAll(LAW_REF_RE)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isAlnum)) continue;   // "AYŞE" içindeki "AY" kanun değildir
    if (/^[0-9]/.test(m[0]) && /[\/0-9]/.test(text[s - 1] ?? '')) continue; // dosya numarasının son kısmı kanun değildir
    if (/^[\p{Lu}]+$/u.test(m[0]) && !LAW_ABBR.includes(m[0])) continue;
    out.push({ start: s, end: e, reason: 'KANUN_ATFI', ruleId: 'L2.KANUN', ownCaseSuspect: false });
  }
  return out;
}

// ---------- Katman 1 ----------
export function detectIban(text: string): Raw[] {
  const out: Raw[] = [];
  const re = /TR\s?[0-9]{2}(?:\s?[0-9]{4}){5}\s?[0-9]{2}/gi;
  for (const m of text.matchAll(re)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e)) continue;
    const norm = m[0].replace(/\s/g, '').toUpperCase();
    if (isValidTrIban(norm)) out.push({ start: s, end: e, category: 'IBAN', ruleId: 'L1.IBAN', confidence: 'HIGH', normalized: norm });
    else if (/iban/.test(ctxLeft(text, s, 30))) out.push({ start: s, end: e, category: 'IBAN', ruleId: 'L1.IBAN.SAGLAMASIZ', confidence: 'MEDIUM', normalized: norm, flags: ['NEEDS_REVIEW'] });
  }
  return out;
}

export function detectTcknYkn(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[0-9]{11}/g)) {
    const s = m.index!, e = s + 11;
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isAlnum)) continue;   // "AYŞE" içindeki "AY" kanun değildir
    if (!isValidTckn(m[0])) continue;
    out.push({ start: s, end: e, category: m[0].startsWith('99') ? 'YKN' : 'TCKN', ruleId: 'L1.TCKN', confidence: 'HIGH', normalized: m[0] });
  }
  // Boşluklu yazım yalnız bağlamla: "T.C. Kimlik No: 100 000 001 46"
  for (const m of text.matchAll(/[0-9]{3}\s[0-9]{3}\s[0-9]{3}\s[0-9]{2}/g)) {
    const s = m.index!, e = s + m[0].length, d = digitsOnly(m[0]);
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isAlnum)) continue;   // "AYŞE" içindeki "AY" kanun değildir
    if (isValidTckn(d) && /kimlik|t\.?\s?c\.?|tckn/.test(ctxLeft(text, s, 30)))
      out.push({ start: s, end: e, category: d.startsWith('99') ? 'YKN' : 'TCKN', ruleId: 'L1.TCKN.BOSLUKLU', confidence: 'HIGH', normalized: d });
  }
  return out;
}

const VKN_CTX = /vergi|v\.?\s?k\.?\s?n|v\.\s?d\.|vd\s*[:.]/;
export function detectVkn(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[0-9]{10}/g)) {
    const s = m.index!, e = s + 10;
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isAlnum)) continue;   // "AYŞE" içindeki "AY" kanun değildir
    if (!isValidVkn(m[0])) continue;
    const ctx = VKN_CTX.test(ctxLeft(text, s));
    if (!ctx && /^5[0-9]/.test(m[0])) continue;                    // bağlamsız 5xx… → telefon dedektörüne bırak
    out.push({ start: s, end: e, category: 'VKN', ruleId: ctx ? 'L1.VKN' : 'L1.VKN.BAGLAMSIZ', confidence: ctx ? 'HIGH' : 'MEDIUM', normalized: m[0] });
  }
  return out;
}

/** 13-19 haneli, 4'lü gruplu olabilen sayılar: MERSİS (16) önce, sonra Luhn ile kart. */
export function detectMersisAndCards(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[0-9](?:[ -]?[0-9]){12,18}/g)) {
    const s = m.index!, e = s + m[0].length, d = digitsOnly(m[0]);
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isAlnum)) continue;   // "AYŞE" içindeki "AY" kanun değildir
    if (/[0-9] [0-9]{2} [0-9]{2}$/.test(m[0]) && /^0?5/.test(d)) continue;  // telefon biçimi
    const mk = d.length === 16 ? mersisKind(d) : null;
    if (mk) {
      const ctx = /mersis/.test(ctxLeft(text, s));
      out.push({ start: s, end: e, category: 'MERSIS', ruleId: `L1.MERSIS.${mk}`, confidence: ctx ? 'HIGH' : 'MEDIUM', normalized: d });
      continue;
    }
    const net = cardNetwork(d);
    if (net && (net !== 'DIGER' || /kart/.test(ctxLeft(text, s))))
      out.push({ start: s, end: e, category: 'KART', ruleId: `L1.KART.${net}`, confidence: net === 'DIGER' ? 'MEDIUM' : 'HIGH', normalized: d });
  }
  return out;
}

export function detectPhones(text: string): Raw[] {
  const out: Raw[] = [];
  const re = /(?:(?:\+|00)90[\s.-]?)?\(?0?[\s.-]?\(?([2-5][0-9]{2})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{2})[\s.-]?([0-9]{2})/g;
  for (const m of text.matchAll(re)) {
    let s = m.index!; const e = s + m[0].length;
    while (text[s] === ' ' || text[s] === '(') s++;
    const raw = text.slice(s, e);
    if (!leftBoundary(text, s, (c) => isAlnum(c) || c === '+' || c === '/') || !rightBoundary(text, e, isDigit)) continue;
    const prefixed = /^(?:\+|00)90|^0/.test(raw);
    const area = m[1]!;
    const ctx = /tel|gsm|cep|telefon|faks|fax/.test(ctxLeft(text, s, 25));
    if (!prefixed && !ctx) continue;                         // çıplak 10 hane yalnız bağlamla
    if (!/^[2345]/.test(area)) continue;
    out.push({ start: s, end: e, category: 'TELEFON', ruleId: area.startsWith('5') ? 'L1.TEL.GSM' : 'L1.TEL.SABIT', confidence: 'HIGH', normalized: '0' + area + m[2] + m[3] + m[4] });
  }
  return out;
}

export function detectEmails(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[A-Za-z]{2,}/gu)) {
    const s = m.index!, e = s + m[0].length;
    out.push({ start: s, end: e, category: 'EPOSTA', ruleId: /\.kep\.tr$/i.test(m[0]) ? 'L1.KEP' : 'L1.EPOSTA', confidence: 'HIGH' });
  }
  return out;
}

const PLATE_LAW_BLOCK = new Set(LAW_ABBR.filter((x) => /^[A-PR-VYZ]+$/.test(x)).concat(['E', 'K', 'S', 'T', 'MD', 'NO', 'SK']));
export function detectPlates(text: string): Raw[] {
  const out: Raw[] = [];
  const re = /(0[1-9]|[1-7][0-9]|8[01]) ?([A-PR-VYZ]{1,3}) ?([0-9]{2,5})/g;
  for (const m of text.matchAll(re)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e)) continue;
    const L = m[2]!.length, D = m[3]!.length;
    const ok = (L === 1 && D >= 4 && D <= 5) || (L === 2 && D >= 3 && D <= 4) || (L === 3 && D >= 2 && D <= 3);
    if (!ok || PLATE_LAW_BLOCK.has(m[2]!)) continue;
    const left = ctxLeft(text, s, 25), right = ctxRight(text, e, 15);
    if (/(sayılı|s\.\s?k\.|kanun\p{L}*|m\.|md\.|madde\p{L}*|fıkra\p{L}*|bent\p{L}*)\s*$/u.test(left)) continue;
    if (/^\s*(\.|sayılı|s\.\s?k|md\.|m\.|madde)/u.test(right)) continue;
    const pos = /plaka|araç|aracın|aracı|otomobil|kamyon|motosiklet|taşıt/.test(ctxLeft(text, s, 40) + ctxRight(text, e, 40));
    out.push({ start: s, end: e, category: 'PLAKA', ruleId: 'L1.PLAKA', confidence: pos ? 'HIGH' : 'MEDIUM', normalized: m[1] + ' ' + m[2] + ' ' + m[3] });
  }
  return out;
}

export function detectBirthDates(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  const re = /(?:doğum\s+tarihi|doğ\.\s?tar\.?|d\.\s?t\.)\s*[:]?\s*([0-3]?[0-9][./-][01]?[0-9][./-](?:19|20)[0-9]{2})/gu;
  for (const m of view.matchAll(re)) {
    const s = m.index! + m[0].lastIndexOf(m[1]!), e = s + m[1]!.length;
    out.push({ start: s, end: e, category: 'DOGUM_TARIHI', ruleId: 'L1.DOGUM', confidence: 'HIGH' });
  }
  for (const m of view.matchAll(/((?:19|20)[0-9]{2})\s+doğumlu/gu)) {
    out.push({ start: m.index!, end: m.index! + 4, category: 'DOGUM_TARIHI', ruleId: 'L1.DOGUM.YIL', confidence: 'HIGH' });
  }
  return out;
}

// ---------- Katman 2: numara tarafı ----------
export function detectDocketsAndCitations(text: string, currentYear: number): { raws: Raw[]; protectedSpans: Protected[] } {
  const raws: Raw[] = [], protectedSpans: Protected[] = [];
  for (const d of classifyDockets(text, findDockets(text, currentYear))) {
    const { start, end } = d.match;
    if (d.verdict === 'MASK') raws.push({ start, end, category: 'DOSYA_NO', ruleId: 'L2.DOSYA', confidence: d.confidence });
    else protectedSpans.push({ start, end, reason: 'ICTIHAT_KUNYESI', ruleId: 'L2.ICTIHAT', ownCaseSuspect: d.verdict === 'REVIEW' });
  }
  return { raws, protectedSpans };
}

export function detectLandRecords(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  const res = [
    /[0-9]{1,6}\s*ada\s*,?\s*(?:ve\s+)?[0-9]{1,5}\s*parsel(?:\s*(?:sayılı|numaralı|nolu))?/gu,
    /ada\s*(?:no|numarası)?\s*[:.]?\s*[0-9]{1,6}\s*,?\s*(?:ve\s+)?parsel\s*(?:no|numarası)?\s*[:.]?\s*[0-9]{1,5}/gu,
  ];
  for (const re of res) for (const m of view.matchAll(re)) {
    const s = m.index!, e = s + m[0].length;
    if (out.some((o) => s < o.end && o.start < e)) continue;
    out.push({ start: s, end: e, category: 'TAPU', ruleId: 'L2.TAPU', confidence: 'HIGH' });
  }
  return out;
}

export function detectNotaryJournal(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  for (const m of view.matchAll(/yevmiye\s*(?:no|numarası|numaralı|nolu|sayılı)?\s*[:.]?\s*([0-9]{1,7})/gu)) {
    const s = m.index! + m[0].lastIndexOf(m[1]!); out.push({ start: s, end: s + m[1]!.length, category: 'YEVMIYE', ruleId: 'L2.YEVMIYE', confidence: 'HIGH' });
  }
  for (const m of view.matchAll(/([0-9]{1,7})\s+yevmiye\s*(?:no|numaralı|nolu|sayılı)/gu)) {
    out.push({ start: m.index!, end: m.index! + m[1]!.length, category: 'YEVMIYE', ruleId: 'L2.YEVMIYE', confidence: 'HIGH' });
  }
  return out;
}

/** Belirgin evrak numaraları ve sağlık bilgisi ifadeleri. */
export function detectSensitiveDetails(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  const patterns: Array<[RegExp, Cat, string]> = [
    [/\be\.\s*[0-9]{4,12}(?![0-9/])/gu, 'DOSYA_NO', 'L1.EVRAK_NO'],
    [/[0-9]{3,}\/[0-9]{2,}(?:\.[0-9]{1,})?(?:\/[0-9]{3,})+(?=\s+sayılı)/gu, 'DOSYA_NO', 'L1.EVRAK_NO'],
    [/(?:sağlık\s+(?:problemi|problemleri|sorunu|sorunları|durumu|sorunundan|problemlerinden)|(?:hastalık|hastalıkları|rahatsızlık|rahatsızlığı|teşhis|tanı|tedavi|ameliyat|psikiyatrik)\s*(?:nedeniyle|sebebiyle))/gu, 'OZEL', 'L1.SAGLIK'],
  ];
  for (const [re, category, ruleId] of patterns) for (const m of view.matchAll(re)) {
    const start = m.index!, end = start + m[0].length;
    if (leftBoundary(view, start) && rightBoundary(view, end, isAlnum)) out.push({ start, end, category, ruleId, confidence: 'HIGH' });
  }
  return out;
}

/** Hepsini çalıştır; korunan aralıkla örtüşen bulguları at; çakışmaları öncelik/uzunlukla çöz. */
export function detectAll(text: string, currentYear = new Date().getFullYear()): { raws: Raw[]; protectedSpans: Protected[] } {
  const laws = findLawRefs(text);
  const dc = detectDocketsAndCitations(text, currentYear);
  const protectedSpans = [...laws, ...dc.protectedSpans];
  const order: Cat[] = ['OZEL', 'IBAN', 'TCKN', 'YKN', 'MERSIS', 'KART', 'VKN', 'TELEFON', 'EPOSTA', 'TAPU', 'YEVMIYE', 'DOSYA_NO', 'DOGUM_TARIHI', 'PLAKA'];
  const signatures: Raw[] = judgeSignatures(text).flatMap((s) => s.number ? [{ ...s.number, category: 'OZEL' as const, ruleId: 'L1.HAKIM_SICIL', confidence: 'HIGH' as const }] : []);
  const all = [...signatures, ...detectSensitiveDetails(text), ...detectIban(text), ...detectTcknYkn(text), ...detectMersisAndCards(text), ...detectVkn(text), ...detectPhones(text),
    ...detectEmails(text), ...detectLandRecords(text), ...detectNotaryJournal(text), ...dc.raws, ...detectBirthDates(text), ...detectPlates(text)];
  const conf = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  all.sort((a, b) => conf[b.confidence] - conf[a.confidence] || order.indexOf(a.category) - order.indexOf(b.category) || (b.end - b.start) - (a.end - a.start));
  const kept: Raw[] = [];
  for (const r of all) {
    if (protectedSpans.some((p) => r.start < p.end && p.start < r.end)) continue;
    if (kept.some((k) => r.start < k.end && k.start < r.end)) continue;
    kept.push(r);
  }
  return { raws: kept.sort((a, b) => a.start - b.start), protectedSpans };
}

/** Başvuru çıktısını kontrat tiplerine çevirir. Puan: HIGH 0.95, MEDIUM 0.7, LOW 0.4. */
export function toContract(text: string, docId: DocumentId, out: { raws: Raw[]; protectedSpans: Protected[] }, nextId: () => MentionId):
  { matches: EntityMatch[]; protectedSpans: ProtectedSpan[] } {
  const score = { HIGH: 0.95, MEDIUM: 0.7, LOW: 0.4 } as const;
  const matches: EntityMatch[] = out.raws.map((r) => ({
    id: nextId(), docId, span: { start: r.start, end: r.end }, text: text.slice(r.start, r.end),
    category: r.category as EntityCategory, layer: r.ruleId.startsWith('L2') ? 'L2_LEGAL' as const : 'L1_CHECKSUM' as const,
    confidence: r.confidence, score: score[r.confidence], ruleId: r.ruleId,
    ...(r.normalized !== undefined ? { normalized: r.normalized } : {}),
    flags: (r.flags ?? []).filter((f): f is EntityMatch['flags'][number] => f === 'NEEDS_REVIEW'),
  }));
  const protectedSpans: ProtectedSpan[] = out.protectedSpans.map((p) => ({
    docId, span: { start: p.start, end: p.end }, reason: p.reason, ruleId: p.ruleId, ownCaseSuspect: p.ownCaseSuspect,
  }));
  return { matches, protectedSpans };
}
