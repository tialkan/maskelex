// packages/core-engine/src/pipeline/merge.ts
// Bulgu birleştirme: korunan aralık önceliği, sonra katman, güven, uzunluk ve skor sırasıyla açgözlü seçim.

import { CONFIDENCE_RANK, LAYER_PRIORITY, spansOverlap, type EntityMatch, type ProtectedSpan } from '../types/contracts';

export function merge(matches: readonly EntityMatch[], prot: readonly ProtectedSpan[]): EntityMatch[] {
  const live = matches.filter((m) => m.layer === 'MANUAL'
    || !prot.some((p) => p.docId === m.docId && spansOverlap(p.span, m.span)));
  const len = (m: EntityMatch): number => m.span.end - m.span.start;
  const ordered = [...live].sort((a, b) => LAYER_PRIORITY[b.layer] - LAYER_PRIORITY[a.layer]
    || CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
    || len(b) - len(a) || b.score - a.score || a.span.start - b.span.start);
  const kept: EntityMatch[] = [];
  for (const m of ordered)
    if (!kept.some((k) => k.docId === m.docId && spansOverlap(k.span, m.span))) kept.push(m);
  return kept.sort((a, b) => a.span.start - b.span.start);
}
