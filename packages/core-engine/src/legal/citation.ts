// packages/core-engine/src/legal/citation.ts
// Esas/Karar numaralarını "yüksek mahkeme künyesi (KORU)" / "yerel dosya (MASKELE)" / "kendi dosyası olabilir (İNCELE)"
// olarak sınıflandırır. Pencere: eşleşmenin (veya künye zincirinin) solunda ve sağında 60 karakter.
// Tüm işaret desenleri küçük harfli yazılır ve lowerView() üzerinde çalışır (Türkçe İ/ı sorunu).
// Lookbehind YASAK (eski WebKit). Sınır ve örtüşme denetimleri kodla yapılır.

import { lowerView, isAlnum, isDigit, isLetter } from '../text/turkish';

export type CitationVerdict = 'PROTECT' | 'MASK' | 'REVIEW';
export interface DocketMatch { readonly start: number; readonly end: number; readonly year: number; readonly no: number }
export interface DocketDecision {
  readonly match: DocketMatch;
  readonly verdict: CitationVerdict;
  readonly confidence: 'HIGH' | 'MEDIUM';
  readonly reason: string;
  readonly groupId: number;
}

export const WINDOW = 60;

/** Yüksek mahkeme / emsal işaretleri (bulunursa KORU). */
export const HIGH_COURT_RE = new RegExp([
  'yargıtay', 'yarg\\.', 'y\\.\\s?\\d{1,2}\\.\\s?(?:hd|cd|h\\.d\\.|c\\.d\\.)',
  '\\d{1,2}\\.\\s?(?:hd|cd|h\\.d\\.|c\\.d\\.)', '\\d{1,2}\\.\\s?(?:hukuk|ceza)\\s+dairesi',
  'hgk', 'h\\.g\\.k\\.', 'hukuk\\s+genel\\s+kurulu', 'cgk', 'c\\.g\\.k\\.', 'ceza\\s+genel\\s+kurulu',
  'y?ibk', 'içtihad[ıi]\\s+birleştirme', 'danıştay', 'dan\\.', '\\d{1,2}\\.\\s?d\\.(?=\\s|,)', 'iddk', 'vddk',
  'idari\\s+dava\\s+daireleri', 'vergi\\s+dava\\s+daireleri', 'anayasa\\s+mahkemesi', 'aym', 'aihm',
  'avrupa\\s+insan\\s+hakları\\s+mahkemesi', 'uyuşmazlık\\s+mahkemesi', 'bölge\\s+adliye\\s+mahkemesi', 'bam',
  'bölge\\s+idare\\s+mahkemesi', 'bim', '\\d{1,2}\\.\\s?idd', 'b\\.\\s?no', 'başvuru\\s+no',
].join('|'), 'gu');
/** Yerel mahkeme / icra / savcılık / noter işaretleri (bulunursa MASKELE). */
export const LOCAL_COURT_RE = new RegExp([
  'asliye', 'sulh', 'ağır\\s+ceza', 'aile\\s+mahkemesi', 'iş\\s+mahkemesi', 'tüketici\\s+mahkemesi',
  'kadastro\\s+mahkemesi', 'fikri\\s+ve\\s+sınai', 'icra\\s+(?:dairesi|müdürlüğü|hukuk|ceza)', 'icra',
  'çocuk\\s+mahkemesi', 'idare\\s+mahkemesi', 'vergi\\s+mahkemesi', 'başsavcılığı', 'savcılığı',
  'noterliği', 'arabuluculuk', 'hakimliği', 'hâkimliği', 'talimat', 'muhabere',
].join('|'), 'gu');
/** Avukatın kendi dosyasına işaret eden ifadeler (yüksek mahkemede olsa bile İNCELE). */
export const OWN_CASE_RE = /dosyamız|davamız|müvekkil|tarafımız|temyiz\s+(?:eden|edilen|incelemesi|başvurusu)|istinaf\s+(?:eden|edilen|incelemesi|başvurusu)|ilamı\s+ile\s+(?:onan|bozul)|onanarak|bozularak|gönderil(?:en|miş)|incelemededir|derdest/u;
/** Emsal göstergesi: kendi-dosya şüphesini geçersiz kılar. */
export const PRECEDENT_RE = /emsal|içtihat|aynı\s+yönde|benzer|bkz\.|kararında(?:\s+de)?\s+belirtildiği|sayılı\s+kararı(?:nda)?|uyarınca/u;

const YEAR_MIN = 1950;
/** "2024/892", "2024 / 892". Tarih parçaları elenir. */
export function findDockets(text: string, currentYear = new Date().getFullYear()): DocketMatch[] {
  const out: DocketMatch[] = [];
  const re = /([12][0-9]{3})\s?\/\s?([0-9]{1,7})/g;
  for (const m of text.matchAll(re)) {
    const start = m.index!, end = start + m[0].length;
    const year = Number(m[1]), no = Number(m[2]);
    if (year < YEAR_MIN || year > currentYear + 1 || no === 0) continue;
    const before = text.slice(Math.max(0, start - 3), start);
    const after = text.slice(end, end + 3);
    if (/[0-9]$/.test(before) || /^[0-9]/.test(after)) continue;   // sayı içinde
    if (/[0-9]{1,2}[./]\s?$/.test(before)) continue;               // 12/2024/... veya 12.2024/...
    if (/^\s?[./-]\s?[0-9]/.test(after)) continue;                 // 2024/03/12 tarih
    out.push({ start, end, year, no });
  }
  return out;
}

interface Hit { start: number; end: number }
/** view üzerinde [from, to) aralığında işaret arar; sol sınır zorunlu, kısa kısaltmalarda sağ sınır da. */
function hits(re: RegExp, view: string, from: number, to: number): Hit[] {
  const out: Hit[] = [];
  re.lastIndex = 0;
  for (const m of view.slice(from, to).matchAll(re)) {
    const s = from + m.index!, e = s + m[0].length;
    const startsWithDigit = /^[0-9]/.test(m[0]);
    if (s > 0 && (startsWithDigit ? isDigit(view[s - 1]) : isAlnum(view[s - 1]))) continue;
    if (/^\p{L}{2,4}$/u.test(m[0]) && e < view.length && isLetter(view[e])) continue;   // "bam" ≠ "bamya"
    out.push({ start: s, end: e });
  }
  return out;
}

/** Künye zinciri: aralarında yalnız ayraç/etiket/tarih bulunan ardışık numaralar tek grup olur. */
const CHAIN_GAP = /^\s*(?:e\.|k\.|esas|karar|e:|k:|no|sayılı|ve|,|;|-|t\.|tarih(?:li)?|[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{4}|\s)*\s*$/u;

export function classifyDockets(text: string, dockets: readonly DocketMatch[]): DocketDecision[] {
  const view = lowerView(text);
  const groups: DocketMatch[][] = [];
  for (const d of dockets) {
    const g = groups[groups.length - 1];
    const last = g?.[g.length - 1];
    if (g && last && d.start - last.end <= 30 && CHAIN_GAP.test(view.slice(last.end, d.start))) g.push(d);
    else groups.push([d]);
  }
  const out: DocketDecision[] = [];
  groups.forEach((g, gi) => {
    const first = g[0]!, last = g[g.length - 1]!;
    const lStart = Math.max(0, first.start - WINDOW);
    const rEnd = Math.min(text.length, last.end + WINDOW);
    // Yüksek mahkeme işaretiyle örtüşen yerel işaret atılır ("Bölge İdare Mahkemesi" içindeki "İdare Mahkemesi").
    const outside = (xs: Hit[], hs: Hit[]): Hit[] => xs.filter((x) => !hs.some((h) => x.start < h.end && h.start < x.end));
    const hl = hits(HIGH_COURT_RE, view, lStart, first.start), ll = outside(hits(LOCAL_COURT_RE, view, lStart, first.start), hl);
    const hr = hits(HIGH_COURT_RE, view, last.end, rEnd), lr = outside(hits(LOCAL_COURT_RE, view, last.end, rEnd), hr);
    const nearestLeft = (xs: Hit[]): number => (xs.length ? first.start - Math.max(...xs.map((h) => h.end)) : Infinity);
    const nearestRight = (xs: Hit[]): number => (xs.length ? Math.min(...xs.map((h) => h.start)) - last.end : Infinity);
    const dHigh = nearestLeft(hl), dLocal = nearestLeft(ll);
    let verdict: CitationVerdict, confidence: 'HIGH' | 'MEDIUM', reason: string;
    if (dHigh < dLocal) { verdict = 'PROTECT'; confidence = 'HIGH'; reason = 'solda yüksek mahkeme işareti'; }
    else if (dLocal < Infinity) { verdict = 'MASK'; confidence = 'HIGH'; reason = 'solda yerel mahkeme işareti'; }
    else if (nearestRight(hr) < nearestRight(lr)) { verdict = 'PROTECT'; confidence = 'MEDIUM'; reason = 'sağda yüksek mahkeme işareti'; }
    else if (nearestRight(lr) < Infinity) { verdict = 'MASK'; confidence = 'MEDIUM'; reason = 'sağda yerel işaret'; }
    else { verdict = 'MASK'; confidence = 'MEDIUM'; reason = 'işaret yok: gizlilik yönünde varsayılan'; }
    if (verdict === 'PROTECT') {
      const ctx = view.slice(lStart, rEnd);
      if (OWN_CASE_RE.test(ctx) && !PRECEDENT_RE.test(ctx)) { verdict = 'REVIEW'; reason += '; kendi dosyası olabilir'; }
    }
    for (const d of g) out.push({ match: d, verdict, confidence, reason, groupId: gi });
  });
  return out;
}
