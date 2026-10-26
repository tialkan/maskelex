// packages/document-parsers/src/udf/codec.ts
// UYAP UDF codec'i (MASTER 3.5.4, 3.5.5). Bu sürüm:
// - Okuma: metin, ofset birimi denetimi (UTF-16), uyarılar. Biçim parçaları ve bloklar (marks/blocks) A3 tarafından eklenir.
// - Maskeli dışa aktarım: content.xml cerrahi yeniden yazım; documentproperties.xml ve sign.sgn düşürülür.
// - Çözülmüş çıktı: düz paragraflardan yeni UDF (Times New Roman 12, iki yana yaslı). Markdown biçimi (3.5.9) A3'tedir.
import type { DocWarning, DocumentAST, DocumentCodec, TextEdit, WriteOptions } from '@maskelex/core-engine/types';
import { locateCdata, rewriteContentXml, scanOffsetElements, toCdata, validateContentXml, UdfFormatError } from './contentXml';
import { applyEditsToText } from '../ast/remap';
import { isZip, unzipLimited, zipDeterministic } from './zip';

interface UdfSource { readonly xmlRaw: string; readonly others: ReadonlyArray<readonly [string, Uint8Array]>; readonly readOnly: boolean }
const DROPPED = new Set(['documentproperties.xml', 'sign.sgn']);
const enc = new TextEncoder();

function offsetsConsistent(xml: string, textLen: number, from: number): boolean {
  try {
    return scanOffsetElements(xml, from).every((el) => {
      const s = Number(el.startOffset.value), l = Number(el.length.value);
      return Number.isInteger(s) && Number.isInteger(l) && s >= 0 && l >= 0 && s + l <= textLen;
    });
  } catch { return false; }
}

const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Düz metinden yeni content.xml (V-03: boş paragraf sıfır genişlikli boşlukla). */
export function buildContentXml(plain: string): string {
  const paras = plain.replace(/\r\n?/g, '\n').split('\n');
  let text = '', els = '';
  for (const p of paras) {
    const body = (p.length ? p : '​') + '\n';
    els += `<paragraph Alignment="3"><content startOffset="${text.length}" length="${body.length}" family="${escAttr('Times New Roman')}" size="12" /></paragraph>\n`;
    text += body;
  }
  return `<?xml version="1.0" encoding="UTF-8" ?>\n<template format_id="1.8">\n<content>${toCdata(text)}</content>\n`
    + '<properties><pageFormat mediaSizeName="1" leftMargin="70.87" rightMargin="70.87" topMargin="70.87" bottomMargin="70.87" paperOrientation="1" headerFOffset="20.0" footerFOffset="20.0" /></properties>\n'
    + `<elements resolver="hvl-default">\n${els}</elements>\n`
    + '<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>\n</template>';
}

export const udfCodec: DocumentCodec = {
  format: 'udf',
  sniff: (bytes, fileName) => fileName.toLocaleLowerCase('tr-TR').endsWith('.udf') && isZip(bytes),

  async read(bytes) {
    const zip = unzipLimited(bytes);
    const content = zip['content.xml'];
    if (!content) throw new UdfFormatError('content.xml yok');
    const xmlRaw = new TextDecoder('utf-8').decode(content);
    const cd = locateCdata(xmlRaw);
    const warnings: DocWarning[] = [];
    const readOnly = !offsetsConsistent(xmlRaw, cd.text.length, cd.contentCloseStart + '</content>'.length);
    if (readOnly) warnings.push({ code: 'READ_ONLY_FALLBACK', message: 'Biçim bilgisi okunamadı. Metin işlenebilir, maskeli UDF dışa aktarılamaz.' });
    if (zip['sign.sgn']) warnings.push({ code: 'SIGNATURE_PRESENT', message: 'Belgedeki e-imza maskeli dosyada yer almayacak.' });
    if (zip['documentproperties.xml']) warnings.push({ code: 'UYAP_METADATA_PRESENT', message: 'UYAP doğrulama bilgisi maskeli dosyada yer almayacak.' });
    if (xmlRaw.includes('<image')) warnings.push({ code: 'IMAGES_PRESENT', message: 'Belgedeki görseller taranmaz; görsellerde kişisel veri olabilir.' });
    const others = Object.entries(zip).filter(([n]) => n !== 'content.xml');
    const placeholders = [...cd.text.matchAll(/[￼​]/g)].map((m) => ({
      offset: m.index!, char: m[0] as '￼' | '​', kind: m[0] === '￼' ? 'IMAGE' as const : 'EMPTY_PARAGRAPH' as const }));
    const source: UdfSource = { xmlRaw, others, readOnly };
    return { format: 'udf', text: cd.text, blocks: [], marks: [], placeholders, warnings, source: { codec: 'udf', opaque: source } };
  },

  applyEdits(ast: DocumentAST, edits: readonly TextEdit[]): DocumentAST {
    const src = ast.source?.opaque as UdfSource | undefined;
    if (!src || src.readOnly) return { ...ast, text: applyEditsToText(ast.text, edits) };
    const { xml, report } = rewriteContentXml(src.xmlRaw, edits);
    return { ...ast, text: report.newText, source: { codec: 'udf', opaque: { ...src, xmlRaw: xml } } };
  },

  async write(ast: DocumentAST, opts: WriteOptions) {
    if (opts.purpose === 'UNMASKED_OUTPUT') {
      return zipDeterministic([['content.xml', enc.encode(buildContentXml(ast.text))]]);
    }
    const src = ast.source?.opaque as UdfSource | undefined;
    if (!src || src.readOnly) throw new UdfFormatError('Bu belge için maskeli UDF üretilemiyor.');
    if (validateContentXml(src.xmlRaw).length) throw new UdfFormatError('Yeniden yazılan content.xml doğrulanamadı.');
    return zipDeterministic([['content.xml', enc.encode(src.xmlRaw)], ...src.others.filter(([n]) => !DROPPED.has(n))]);
  },
};
