// packages/document-parsers/src/index.ts
export * from './ast/remap';
export * from './udf/contentXml';
export * from './udf/zip';
export { udfCodec, buildContentXml } from './udf/codec';
export { txtCodec, mdCodec } from './text/plain';
export { docxCodec } from './docx/codec';
export { readDocxSync, DocxFormatError } from './docx/reader';
export { writeDocx } from './docx/writer';
export { applyEditsToAst } from './ast/remapAst';
import { udfCodec } from './udf/codec';
import { txtCodec, mdCodec } from './text/plain';
import { docxCodec } from './docx/codec';
/** Codec kaydı: biçim tanıma bu sırayla yapılır. */
export const CODECS = [udfCodec, docxCodec, txtCodec, mdCodec] as const;
