// packages/document-parsers/src/docx/codec.ts
import type { DocumentCodec } from '@maskelex/core-engine/types';
import { isZip } from '../udf/zip';
import { readDocxSync } from './reader';
import { writeDocx } from './writer';
import { applyEditsToAst } from '../ast/remapAst';

export const docxCodec: DocumentCodec = {
  format: 'docx',
  sniff: (bytes, name) => /\.(docx|docm)$/.test(name.toLocaleLowerCase('tr-TR')) && isZip(bytes),
  read: async (bytes) => readDocxSync(bytes),
  applyEdits: applyEditsToAst,
  // Her iki amaçta da temiz üretim: özgün paket kopyalanmaz.
  write: async (ast) => writeDocx(ast),
};
