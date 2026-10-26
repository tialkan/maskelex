// packages/core-engine/src/ner/windows.ts (MASTER 3.3.3/3-4)
// Kelimeleri en çok `max` alt belirteçlik pencerelere doldurur; ardışık pencereler `overlap` alt belirteç örtüşür.
// Pencere sonu mümkünse paragraf sonuna (kelimeler arasında '\n') çekilir.
export interface Window { readonly from: number; readonly to: number }   // kelime indeksleri [from, to)

export function makeWindows(counts: readonly number[], breaksAfter: ReadonlySet<number>, max = 510, overlap = 128): Window[] {
  const out: Window[] = [];
  const n = counts.length;
  let from = 0;
  while (from < n) {
    let to = from, used = 0;
    while (to < n && used + Math.max(1, counts[to]!) <= max) { used += Math.max(1, counts[to]!); to++; }
    if (to === from) to = from + 1;                        // tek kelime bile sığmıyorsa tek başına
    if (to < n) {
      // Paragraf sonuna çek: son yarıda bir paragraf sonu varsa orada bitir
      for (let k = to - 1; k > from + (to - from) / 2; k--) if (breaksAfter.has(k)) { to = k + 1; break; }
    }
    out.push({ from, to });
    if (to >= n) break;
    // Örtüşme: sondan geriye `overlap` alt belirteç kadar kelime
    let back = to, o = 0;
    while (back > from + 1 && o + Math.max(1, counts[back - 1]!) <= overlap) { back--; o += Math.max(1, counts[back]!); }
    from = back > from ? back : to;
  }
  return out;
}

/** Örtüşen bölgede bir kelime için kenara en uzak penceredeki tahmini seçer. */
export function bestWindowFor(word: number, windows: readonly Window[]): number {
  let best = -1, bestDist = -1;
  windows.forEach((w, i) => {
    if (word < w.from || word >= w.to) return;
    const d = Math.min(word - w.from, w.to - 1 - word);
    if (d > bestDist) { bestDist = d; best = i; }
  });
  return best;
}
