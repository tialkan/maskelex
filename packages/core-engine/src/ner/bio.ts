// packages/core-engine/src/ner/bio.ts (MASTER 3.3.3/5-8)
// Kelime etiketlerinden varlık aralıkları ve sözleşme bulguları.
import { foldKey } from '../text/turkish';
import type { Confidence, DocumentId, EntityCategory, EntityMatch } from '../types/contracts';
import type { Word } from './pretokenize';

export type NerLabel = 'PER' | 'ORG' | 'LOC';
export interface WordTag { readonly tag: 'O' | `B-${NerLabel}` | `I-${NerLabel}`; readonly score: number }
export interface NerSpan { readonly start: number; readonly end: number; readonly label: NerLabel; readonly score: number; readonly suffix?: string }

const PUNCT = /^[^\p{L}\p{N}]$/u;
const TITLES = new Set(['av', 'dr', 'sayın', 'sn', 'prof', 'doç'].map(foldKey));

export function mergeBio(text: string, words: readonly Word[], tags: readonly WordTag[]): NerSpan[] {
  const spans: NerSpan[] = [];
  let cur: { label: NerLabel; from: number; to: number; scores: number[] } | null = null;
  const flush = (): void => {
    if (!cur) return;
    let { from, to } = cur;
    // 6) Baştaki ve sondaki noktalama ile unvanlar atılır
    while (from < to && (PUNCT.test(words[from]!.text) || TITLES.has(foldKey(words[from]!.text)))) from++;
    while (to > from && PUNCT.test(words[to - 1]!.text)) to--;
    // Kesme işareti + küçük harf: varlık kesmeden önce biter, ek kanıt olarak kaydedilir
    let suffix: string | undefined;
    for (let k = from; k < to; k++) {
      if (/^['’]$/.test(words[k]!.text) && k + 1 < to && /^\p{Ll}/u.test(words[k + 1]!.text)) { suffix = words[k + 1]!.text; to = k; break; }
    }
    if (to > from) {
      const sc = cur.scores.reduce((a, b) => a + b, 0) / cur.scores.length;
      spans.push({ start: words[from]!.start, end: words[to - 1]!.end, label: cur.label, score: sc, ...(suffix ? { suffix } : {}) });
    }
    cur = null;
  };
  for (let i = 0; i < words.length; i++) {
    const t = tags[i]!;
    if (t.tag === 'O') { flush(); continue; }
    const [bi, label] = t.tag.split('-') as ['B' | 'I', NerLabel];
    const newline = cur !== null && text.slice(words[i - 1]!.end, words[i]!.start).includes('\n');
    // 5) I-X önceki kelime aynı türdeyse ve araya satır sonu girmiyorsa devam eder; değilse B-X gibi
    if (bi === 'B' || !cur || cur.label !== label || newline) { flush(); cur = { label, from: i, to: i + 1, scores: [t.score] }; }
    else { cur.to = i + 1; cur.scores.push(t.score); }
  }
  flush();
  return spans;
}

const PUBLIC_HEADS = new Set(['Bakanlığı', 'Belediyesi', 'Müdürlüğü', 'Başkanlığı', 'Valiliği', 'Kaymakamlığı', 'Kurumu', 'Hazinesi', 'Rektörlüğü'].map(foldKey));
const COURT_HEADS = new Set(['Mahkemesi', 'Dairesi', 'Başsavcılığı', 'Hakimliği'].map(foldKey));

/** 7-8) Etiket eşleme ve güven. LOC bulgu üretmez; mahkeme adları atılır. */
export function toMatches(text: string, docId: DocumentId, spans: readonly NerSpan[], isKnownName: (w: string) => boolean): EntityMatch[] {
  const out: EntityMatch[] = [];
  spans.forEach((s, n) => {
    if (s.label === 'LOC') return;
    const surface = text.slice(s.start, s.end);
    const last = foldKey(surface.split(/\s+/).at(-1) ?? '');
    let category: EntityCategory;
    if (s.label === 'PER') category = 'KISI';
    else if (COURT_HEADS.has(last)) return;
    else category = PUBLIC_HEADS.has(last) ? 'KURUM' : 'SIRKET';
    const rank: Confidence[] = ['LOW', 'MEDIUM', 'HIGH'];
    let r = s.score >= 0.9 ? 2 : s.score >= 0.7 ? 1 : 0;
    const before = text.slice(Math.max(0, s.start - 3), s.start);
    const sentenceInitial = s.start === 0 || /[.!?:]\s*$|\n\s*$/.test(before);
    if (category === 'KISI' && sentenceInitial && !/\s/.test(surface) && !isKnownName(surface)) r = Math.max(0, r - 1);
    out.push({
      id: `NER-${n + 1}`, docId, span: { start: s.start, end: s.end }, text: surface, category, layer: 'L3_NER',
      confidence: rank[r]!, score: s.score, ruleId: `L3.NER.${s.label}`, normalized: foldKey(surface),
      flags: sentenceInitial ? ['SENTENCE_INITIAL'] : [],
    });
  });
  return out;
}
