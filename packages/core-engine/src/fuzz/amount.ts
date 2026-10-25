// packages/core-engine/src/fuzz/amount.ts
// Tutar tespiti, Türkçe biçimli sayı ayrıştırma/biçimleme ve oran korumalı ölçekleme (Tutar Şaşırtma).
// İlke: belgedeki TÜM tutarlar aynı gizli k ile çarpılır; böylece faiz, yüzde ve pay hesapları LLM'de
// orantılı kalır. Geri çözmede yalnız birebir eşleşen ölçekli değer geri alınır; türetilmiş tutar için
// k ile bölünmüş değer yalnız ÖNERİLİR (maktu harç gibi ölçeklenmemiş sabitler bozulmasın diye).

import { numberToWordsJoined } from '../text/numberWords';
import type { AmountHit, AmountStyle, RandomSource, TextEdit } from '../types/contracts';

const CUR = '(?:TL|TRY|₺|Türk\\s+Lirası|USD|ABD\\s+Doları|Dolar|EUR|Euro|Avro|GBP|Sterlin)';
const NUM = '((?:[0-9]{1,3}(?:\\.[0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?)';
const AFTER_RE = new RegExp(NUM + '(?:\\s?(?:,-|\\.-|-))?\\s?(' + CUR + ')', 'gu');   // 125.000,00 TL · 1.250.000.-TL
const BEFORE_RE = new RegExp('(₺|\\$|€|£|USD|EUR|TL)\\s?' + NUM, 'gu');             // ₺125.000 · USD 5.000
const NUMBER_WORDS = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on', 'yirmi', 'otuz', 'kırk',
  'elli', 'altmış', 'yetmiş', 'seksen', 'doksan', 'yüz', 'bin', 'milyon', 'milyar', 'trilyon'];
/** Tutarın hemen ardındaki "(yüzyirmibeşbin Türk Lirası)" içindeki bitişik sayı sözcükleri */
const WORDS_RE = new RegExp('^\\s?\\(((?:' + NUMBER_WORDS.join('|') + ')+)', 'u');

export function parseTrNumber(s: string): { value: number; style: AmountStyle } {
  const [intPart = '', dec = ''] = s.split(',');
  const thousands = intPart.includes('.') ? '.' : '';
  const value = Number(intPart.replace(/\./g, '') + (dec ? '.' + dec : ''));
  return { value, style: { thousands, decimals: dec.length as 0 | 1 | 2 } };
}

export function formatTrNumber(value: number, style: AmountStyle): string {
  const fixed = value.toFixed(style.decimals);
  const [i = '', d] = fixed.split('.');
  const grouped = style.thousands ? i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : i;
  return d ? `${grouped},${d}` : grouped;
}

export function findAmounts(text: string): AmountHit[] {
  const out: AmountHit[] = [];
  const push = (start: number, numText: string, currency: string, tailEnd: number): void => {
    const end = start + numText.length;
    if (out.some((o) => start < o.span.end && o.span.start < end)) return;
    const { value, style } = parseTrNumber(numText);
    const wm = text.slice(tailEnd).match(WORDS_RE);
    const hit: AmountHit = wm
      ? { span: { start, end }, value, style, currency,
          words: { span: { start: tailEnd + wm[0].indexOf(wm[1]!), end: tailEnd + wm[0].indexOf(wm[1]!) + wm[1]!.length }, text: wm[1]! } }
      : { span: { start, end }, value, style, currency };
    out.push(hit);
  };
  for (const m of text.matchAll(AFTER_RE)) push(m.index!, m[1]!, m[2]!, m.index! + m[0].length);
  for (const m of text.matchAll(BEFORE_RE)) push(m.index! + m[0].length - m[2]!.length, m[2]!, m[1]!, m.index! + m[0].length);
  return out.sort((a, b) => a.span.start - b.span.start);
}

/** k ∈ [lo, hi]; [0.95, 1.05] dışlanır (fark edilmeyecek kadar küçük ölçek anlamsızdır). */
export function pickScale(rng: RandomSource, range: readonly [number, number] = [0.8, 1.25]): number {
  const [lo, hi] = range;
  for (;;) {
    const k = Math.round((lo + rng.nextFloat() * (hi - lo)) * 10000) / 10000;
    if (k < 0.95 || k > 1.05) return k;
  }
}

/** Tüm tutarları aynı k ile ölçekler; yazıyla tutar da yeni değere göre yeniden yazılır. */
export function scaleAmounts(hits: readonly AmountHit[], k: number): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const h of hits) {
    const v = h.value * k;
    edits.push({ span: h.span, replacement: formatTrNumber(v, h.style) });
    if (h.words) edits.push({ span: h.words.span, replacement: numberToWordsJoined(Math.round(v)) });
  }
  return edits;
}
