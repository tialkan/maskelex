// packages/document-parsers/src/index.ts
export * from './ast/remap';
export * from './udf/contentXml';
export * from './udf/zip';
export { udfCodec, buildContentXml } from './udf/codec';
export { txtCodec, mdCodec } from './text/plain';
import { udfCodec } from './udf/codec';
import { txtCodec, mdCodec } from './text/plain';
/** Codec kaydı: biçim tanıma bu sırayla yapılır. DOCX (3.5.7) A3 tarafından eklenir. */
export const CODECS = [udfCodec, txtCodec, mdCodec] as const;
