// packages/core-engine/src/text/numberWords.ts
// Türkçe sayı → yazı. Tutar yazısı ("yüzyirmibeşbin") ve sayıların okunuşundan ses profili için.

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon'];

function threeDigits(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h > 0) { if (h > 1) out.push(ONES[h]!); out.push('yüz'); }
  if (t > 0) out.push(TENS[t]!);
  if (o > 0) out.push(ONES[o]!);
  return out;
}

/** Tam sayıyı kelimelere böler. 1000 → ["bin"] (Türkçede "bir bin" denmez). */
export function numberToWordList(n: bigint | number): string[] {
  let v = BigInt(n);
  if (v === 0n) return ['sıfır'];
  const neg = v < 0n; if (neg) v = -v;
  const groups: number[] = [];
  while (v > 0n) { groups.push(Number(v % 1000n)); v /= 1000n; }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (g === 0) continue;
    if (i === 1 && g === 1) { words.push('bin'); continue; }
    words.push(...threeDigits(g));
    if (i > 0) words.push(SCALES[i]!);
  }
  return neg ? ['eksi', ...words] : words;
}

/** Hukuk metinlerindeki bitişik yazım: 125000 → "yüzyirmibeşbin" */
export const numberToWordsJoined = (n: bigint | number): string => numberToWordList(n).join('');

/** Bir rakam dizisinin okunuşunun SON kelimesi (ses profili için). "2024/892" → "iki" */
export function lastSpokenWord(digits: string): string {
  const clean = digits.replace(/[^0-9]/g, '');
  if (clean === '') return '';
  const trimmed = clean.replace(/^0+(?=\d)/, '');
  const list = numberToWordList(BigInt(trimmed));
  return list[list.length - 1]!;
}
