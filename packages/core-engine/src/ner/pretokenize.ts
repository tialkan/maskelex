// packages/core-engine/src/ner/pretokenize.ts (MASTER 3.3.3/1)
// BERT BasicTokenizer ile uyumlu ön belirteçleme. Ofsetler kelime düzeyinde bizde tutulur.
export interface Word { readonly start: number; readonly end: number; readonly text: string }

export function pretokenize(text: string): Word[] {
  const out: Word[] = [];
  for (const m of text.matchAll(/[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu)) out.push({ start: m.index!, end: m.index! + m[0].length, text: m[0] });
  return out;
}
