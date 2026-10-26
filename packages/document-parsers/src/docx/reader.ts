// packages/document-parsers/src/docx/reader.ts
// DOCX → DocumentAST (MASTER 3.5.7). saxes ile akış halinde okur; DOMParser kullanmaz (Worker'da yoktur).
// Bu sürüm: paragraf, hizalama, başlık, liste, biçim parçası (b/i/u/yazı tipi/boyut), tablo (hücre paragrafları
// düz akışa eklenir), silinmiş metin ve alan kodları hariç, görsel yer tutucusu, dipnotlar (isteğe bağlı).
// docProps/* okunmaz.
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import type { Alignment, DocWarning, DocumentAST, InlineMark, ParagraphBlock, Placeholder, RunStyle } from '@maskelex/core-engine/types';
import { unzipLimited } from '../udf/zip';

export class DocxFormatError extends Error {}
const dec = new TextDecoder('utf-8');
const JC: Readonly<Record<string, Alignment>> = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' };
const on = (t: SaxesTagPlain): boolean => { const v = t.attributes['w:val']; return v === undefined || !['0', 'false', 'none'].includes(v); };

interface Parsed { text: string; blocks: ParagraphBlock[]; marks: InlineMark[]; placeholders: Placeholder[]; tracked: boolean; images: boolean }

function parsePart(xml: string, base: number): Parsed {
  const out: Parsed = { text: '', blocks: [], marks: [], placeholders: [], tracked: false, images: false };
  const p = new SaxesParser({ xmlns: false });
  let pStart = -1, align: Alignment = 'justify', heading: 1 | 2 | 3 | 4 | 5 | 6 | undefined, list = false;
  let run: { start: number; style: { -readonly [K in keyof RunStyle]: RunStyle[K] } } | null = null;
  let inRPr = false, inT = false, del = 0, instr = false, drawing = 0;
  const pos = (): number => base + out.text.length;
  const add = (s: string): void => { out.text += s; };
  p.on('opentag', (t) => {
    switch (t.name) {
      case 'w:p': pStart = pos(); align = 'justify'; heading = undefined; list = false; break;
      case 'w:jc': if (t.attributes['w:val'] && JC[t.attributes['w:val']]) align = JC[t.attributes['w:val']]!; break;
      case 'w:pStyle': { const m = /^(?:Heading|Baslik|Başlık)([1-6])$/i.exec(t.attributes['w:val'] ?? ''); if (m) heading = Number(m[1]) as 1; break; }
      case 'w:numPr': list = true; break;
      case 'w:r': run = { start: pos(), style: {} }; break;
      case 'w:rPr': inRPr = true; break;
      case 'w:b': if (inRPr && run && on(t)) run.style.bold = true; break;
      case 'w:i': if (inRPr && run && on(t)) run.style.italic = true; break;
      case 'w:u': if (inRPr && run && on(t)) run.style.underline = true; break;
      case 'w:rFonts': if (inRPr && run && t.attributes['w:ascii']) run.style.family = t.attributes['w:ascii']; break;
      case 'w:sz': if (inRPr && run && t.attributes['w:val']) run.style.sizePt = Number(t.attributes['w:val']) / 2; break;
      case 'w:t': if (!del && !instr) inT = true; break;
      case 'w:del': del++; out.tracked = true; break;
      case 'w:ins': out.tracked = true; break;
      case 'w:instrText': instr = true; break;
      case 'w:tab': if (!del && !inRPr) add('\t'); break;
      case 'w:noBreakHyphen': if (!del) add('-'); break;
      case 'w:br': case 'w:cr': if (!del) add('\u2028'); break;
      case 'w:drawing': case 'w:pict': case 'w:object':
        if (drawing++ === 0 && !del) { out.placeholders.push({ offset: pos(), char: '\uFFFC', kind: 'IMAGE' }); add('\uFFFC'); out.images = true; }
        break;
    }
  });
  p.on('text', (s) => { if (inT && !drawing) add(s); });
  p.on('closetag', (t) => {
    switch (t.name) {
      case 'w:t': inT = false; break;
      case 'w:instrText': instr = false; break;
      case 'w:rPr': inRPr = false; break;
      case 'w:del': del--; break;
      case 'w:drawing': case 'w:pict': case 'w:object': drawing--; break;
      case 'w:r':
        if (run && pos() > run.start && Object.keys(run.style).length) out.marks.push({ span: { start: run.start, end: pos() }, style: run.style });
        run = null; break;
      case 'w:p': {
        const style = { align: heading ? 'center' as const : align, ...(heading ? { heading } : {}), ...(list ? { list: { kind: 'bullet' as const, level: 0 } } : {}) };
        out.blocks.push({ kind: 'paragraph', span: { start: pStart, end: pos() }, style });
        add('\n'); pStart = -1; break;
      }
    }
  });
  p.write(xml).close();
  return out;
}

export interface DocxReadOptions { readonly includeFootnotes: boolean }

export function readDocxSync(bytes: Uint8Array, opts: DocxReadOptions = { includeFootnotes: true }): DocumentAST {
  const zip = unzipLimited(bytes);
  const main = zip['word/document.xml'];
  if (!main) throw new DocxFormatError('word/document.xml yok');
  const doc = parsePart(dec.decode(main), 0);
  const warnings: DocWarning[] = [];
  let text = doc.text;
  const blocks = [...doc.blocks], marks = [...doc.marks], placeholders = [...doc.placeholders];
  if (opts.includeFootnotes) {
    for (const part of ['word/footnotes.xml', 'word/endnotes.xml']) {
      const raw = zip[part];
      if (!raw) continue;
      const fn = parsePart(dec.decode(raw), text.length + '[Dipnotlar]\n'.length);
      if (!fn.text.trim()) continue;
      blocks.push({ kind: 'paragraph', span: { start: text.length, end: text.length + 11 }, style: { align: 'left' } });
      text += '[Dipnotlar]\n' + fn.text;
      blocks.push(...fn.blocks); marks.push(...fn.marks); placeholders.push(...fn.placeholders);
    }
  }
  if (doc.tracked) warnings.push({ code: 'TRACKED_CHANGES', message: 'İzlenen değişiklikler var: silinmiş metin alınmadı, eklenen metin alındı.' });
  if (doc.images) warnings.push({ code: 'IMAGES_PRESENT', message: 'Belgedeki görseller taranmaz; çıktıda yerlerine [GÖRSEL] yazılır.' });
  if (zip['word/comments.xml']) warnings.push({ code: 'COMMENTS_PRESENT', message: 'Yorumlar alınmadı ve çıktıya taşınmaz.' });
  if (Object.keys(zip).some((n) => /^word\/(header|footer)\d*\.xml$/.test(n)))
    warnings.push({ code: 'HEADER_FOOTER_TEXT', message: 'Üst ve alt bilgi alınmadı; kişisel veri içeriyorsa elle kontrol edin.' });
  if (zip['word/vbaProject.bin']) warnings.push({ code: 'MACROS_PRESENT', message: 'Makrolar yok sayıldı.' });
  if (text.endsWith('\n')) text = text.slice(0, -1);
  return { format: 'docx', text: text.normalize('NFC') === text ? text : text, blocks, marks, placeholders, warnings };
}
