// packages/document-parsers/src/text/plain.ts
// .txt ve .md codec'i: metin olduğu gibi, çıktı UTF-8.
import type { DocumentCodec } from '@maskelex/core-engine/types';
import { applyEditsToText } from '../ast/remap';

const plain = (format: 'txt' | 'md', ext: string): DocumentCodec => ({
  format,
  sniff: (_b, name) => name.toLocaleLowerCase('tr-TR').endsWith(ext),
  async read(bytes) {
    const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '').replace(/\r\n?/g, '\n').normalize('NFC');
    return { format, text, blocks: [], marks: [], placeholders: [], warnings: [] };
  },
  applyEdits: (ast, edits) => ({ ...ast, text: applyEditsToText(ast.text, edits) }),
  async write(ast) { return new TextEncoder().encode(ast.text); },
});
export const txtCodec = plain('txt', '.txt');
export const mdCodec = plain('md', '.md');
