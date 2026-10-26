// packages/document-parsers/src/ast/remapAst.ts
// Düzenlemelerden sonra AST'nin tüm aralıklarını (paragraf blokları, biçim parçaları, yer tutucular) yeniden eşler.
import type { Block, DocumentAST, TextEdit } from '@maskelex/core-engine/types';
import { applyEditsToText, makePointMapper, normalizeEdits } from './remap';

export function applyEditsToAst(ast: DocumentAST, edits: readonly TextEdit[]): DocumentAST {
  const sorted = normalizeEdits(ast.text, edits);
  const map = makePointMapper(sorted);
  const span = (s: { start: number; end: number }): { start: number; end: number } => ({ start: map(s.start), end: map(s.end) });
  const block = (b: Block): Block => b.kind === 'paragraph'
    ? { ...b, span: span(b.span) }
    : { ...b, span: span(b.span), rows: b.rows.map((r) => ({ cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map(block) })) })) };
  return {
    ...ast,
    text: applyEditsToText(ast.text, sorted),
    blocks: ast.blocks.map(block),
    marks: ast.marks.map((m) => ({ ...m, span: span(m.span) })).filter((m) => m.span.end > m.span.start),
    placeholders: ast.placeholders.map((p) => ({ ...p, offset: map(p.offset) })),
  };
}
