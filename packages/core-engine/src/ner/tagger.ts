// packages/core-engine/src/ner/tagger.ts
// Model bağımsız etiketleme hattı (MASTER 3.3.3): ön belirteçleme → alt belirteç sayımı → pencereler →
// model → kelime etiketi (ilk alt belirteç) → örtüşmede kenara en uzak pencere → BIO birleştirme.
// ner.worker.ts bunu Transformers.js ile besler; testler sahte model ile besler.
import { pretokenize } from './pretokenize';
import { bestWindowFor, makeWindows } from './windows';
import { mergeBio, type NerLabel, type NerSpan, type WordTag } from './bio';

export interface TokenizerLike {
  /** Kelimenin alt belirteç kimlikleri (özel belirteçler olmadan). */
  encodeWord(word: string): readonly number[];
  readonly clsId: number;
  readonly sepId: number;
}
export interface ModelLike {
  /** [CLS] ... [SEP] dizisi için her konumda etiket olasılıkları (softmax). */
  run(ids: readonly number[]): Promise<ReadonlyArray<readonly number[]>>;
  readonly id2label: Readonly<Record<number, string>>;
}

const asTag = (label: string): WordTag['tag'] => {
  const m = /^([BI])-(PER|ORG|LOC)$/.exec(label);
  return m ? (`${m[1]}-${m[2]}` as `${'B' | 'I'}-${NerLabel}`) : 'O';
};

export async function tagText(text: string, tok: TokenizerLike, model: ModelLike,
  onWindow?: (done: number, total: number, spans: NerSpan[]) => void, isAborted?: () => boolean): Promise<NerSpan[]> {
  const words = pretokenize(text);
  if (!words.length) return [];
  const cache = new Map<string, readonly number[]>();
  const ids = words.map((w) => cache.get(w.text) ?? (cache.set(w.text, tok.encodeWord(w.text)), cache.get(w.text)!));
  const breaks = new Set<number>();
  for (let i = 0; i < words.length - 1; i++) if (text.slice(words[i]!.end, words[i + 1]!.start).includes('\n')) breaks.add(i);
  const windows = makeWindows(ids.map((x) => x.length), breaks);
  const perWindow: Array<Map<number, WordTag>> = [];
  for (let wi = 0; wi < windows.length; wi++) {
    if (isAborted?.()) return [];
    const w = windows[wi]!;
    const seq = [tok.clsId];
    const firstPos = new Map<number, number>();
    for (let k = w.from; k < w.to; k++) { firstPos.set(k, seq.length); seq.push(...(ids[k]!.length ? ids[k]! : [tok.sepId])); }
    seq.push(tok.sepId);
    const probs = await model.run(seq);
    const tags = new Map<number, WordTag>();
    for (const [k, pos] of firstPos) {
      const p = probs[pos]!;
      let best = 0;
      for (let j = 1; j < p.length; j++) if (p[j]! > p[best]!) best = j;
      tags.set(k, { tag: asTag(model.id2label[best] ?? 'O'), score: p[best]! });
    }
    perWindow.push(tags);
    if (onWindow) {
      // İlerleme: bu pencerede kesinleşen kelimelerle geçici aralıklar
      const partial = words.slice(0, w.to).map((_, k) => perWindow[bestWindowFor(k, windows.slice(0, wi + 1))]?.get(k) ?? { tag: 'O' as const, score: 0 });
      onWindow(wi + 1, windows.length, mergeBio(text, words.slice(0, w.to), partial));
    }
  }
  const final = words.map((_, k) => perWindow[bestWindowFor(k, windows)]!.get(k)!);
  return mergeBio(text, words, final);
}
