// packages/document-parsers/src/ast/remap.ts
// Metin düzenlemelerinden sonra [start, end) aralıklarını yeniden eşleyen tek kaynak.
// UDF startOffset/length, DOCX run sınırları ve arayüz vurguları hep bu işlevle güncellenir.

import type { TextEdit } from '@maskelex/core-engine/types';

export class EditError extends Error {}

/** Ön koşullar: boş olmayan aralık, çakışma yok, satır sonu ve yer tutucu (￼, ​) içermez. */
export function normalizeEdits(text: string, edits: readonly TextEdit[]): TextEdit[] {
  const sorted = [...edits].sort((a, b) => a.span.start - b.span.start);
  let prevEnd = -1;
  for (const e of sorted) {
    const { start, end } = e.span;
    if (!(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= text.length && start < end))
      throw new EditError(`Geçersiz aralık [${start},${end})`);
    if (start < prevEnd) throw new EditError(`Çakışan düzenleme [${start},${end})`);
    const slice = text.slice(start, end);
    if (/[\n\r￼​]/.test(slice) || /[\n\r]/.test(e.replacement))
      throw new EditError(`Düzenleme paragraf sınırını veya yer tutucuyu aşıyor [${start},${end})`);
    prevEnd = end;
  }
  return sorted;
}

export function applyEditsToText(text: string, edits: readonly TextEdit[]): string {
  const sorted = normalizeEdits(text, edits);
  let out = '';
  let cursor = 0;
  for (const e of sorted) { out += text.slice(cursor, e.span.start) + e.replacement; cursor = e.span.end; }
  return out + text.slice(cursor);
}

/** Konum eşleyici. Kural (çapa kuralı): bir düzenlemenin yeni metnini, düzenlemenin İLK karakterini içeren
 *  öğe sahiplenir. Düzenleme içine düşen her nokta, düzenlemenin yeni bitişine (b') eşlenir. Böylece:
 *  - düzenlemeyi tamamen kapsayan öğe büyür/küçülür,
 *  - düzenleme içinde başlayan öğe, değişen kısmı kaybeder,
 *  - tamamen içeride kalan öğenin uzunluğu 0 olur (silinir).
 *  İşlev monotondur: p ≤ q ⇒ map(p) ≤ map(q). Kardeş öğeler bitişik kalır. */
export function makePointMapper(edits: readonly TextEdit[]): (p: number) => number {
  const n = edits.length;
  const a = edits.map((e) => e.span.start);
  const b = edits.map((e) => e.span.end);
  const cum: number[] = new Array(n + 1).fill(0);  // cum[i]: ilk i düzenlemenin toplam uzunluk farkı
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i]! + edits[i]!.replacement.length - (b[i]! - a[i]!);
  return (p: number): number => {
    // b[i] > p olan ilk i (ikili arama)
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (b[mid]! > p) hi = mid; else lo = mid + 1; }
    const i = lo;
    if (i < n && a[i]! < p) return a[i]! + cum[i]! + edits[i]!.replacement.length; // düzenleme içi → b'
    return p + cum[i]!;
  };
}

export interface RangeRef { start: number; length: number }
/** Bir aralığı eşler; uzunluk 0 olursa null döner (öğe silinmeli). */
export function remapRange(map: (p: number) => number, r: RangeRef): RangeRef | null {
  const s = map(r.start);
  const e = map(r.start + r.length);
  return e - s > 0 ? { start: s, length: e - s } : null;
}
