// packages/document-parsers/src/docx/writer.ts
// AST → temiz DOCX (MASTER 3.5.8). Özgün paket ASLA kopyalanmaz; üst veri yazılmaz; zaman damgaları sabit.
import type { DocumentAST, ParagraphBlock, RunStyle } from '@maskelex/core-engine/types';
import { zipDeterministic } from '../udf/zip';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const JC = { left: 'left', center: 'center', right: 'right', justify: 'both' } as const;

function runXml(text: string, st: RunStyle): string {
  const rPr = [st.bold ? '<w:b/>' : '', st.italic ? '<w:i/>' : '', st.underline ? '<w:u w:val="single"/>' : '',
    st.family ? `<w:rFonts w:ascii="${esc(st.family)}" w:hAnsi="${esc(st.family)}" w:cs="${esc(st.family)}"/>` : '',
    st.sizePt ? `<w:sz w:val="${Math.round(st.sizePt * 2)}"/>` : ''].join('');
  const parts = text.replace(/\uFFFC/g, '[GÖRSEL]').split(/(\t|\u2028)/);
  const body = parts.map((p) => (p === '\t' ? '<w:tab/>' : p === '\u2028' ? '<w:br/>' : p ? `<w:t xml:space="preserve">${esc(p)}</w:t>` : '')).join('');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${body}</w:r>`;
}

function paragraphXml(ast: DocumentAST, start: number, end: number, b: ParagraphBlock | undefined): string {
  const st = b?.style;
  const pPr = [st?.heading ? `<w:pStyle w:val="Heading${Math.min(st.heading, 3)}"/>` : '', `<w:jc w:val="${JC[st?.align ?? 'justify']}"/>`].join('');
  // Biçim parçalarına göre böl
  const cuts = new Set([start, end]);
  for (const m of ast.marks) if (m.span.end > start && m.span.start < end) { cuts.add(Math.max(start, m.span.start)); cuts.add(Math.min(end, m.span.end)); }
  const pts = [...cuts].sort((x, y) => x - y);
  let runs = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i]!, e = pts[i + 1]!;
    const style = ast.marks.filter((m) => m.span.start <= s && m.span.end >= e).reduce<RunStyle>((acc, m) => ({ ...acc, ...m.style }), {});
    runs += runXml(ast.text.slice(s, e), style);
  }
  return `<w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p>`;
}

export function writeDocx(ast: DocumentAST): Uint8Array {
  const enc = new TextEncoder();
  const paraBlocks = ast.blocks.filter((b): b is ParagraphBlock => b.kind === 'paragraph');
  let body = '', pos = 0;
  for (const line of ast.text.split('\n')) {
    const start = pos, end = pos + line.length;
    body += paragraphXml(ast, start, end, paraBlocks.find((b) => b.span.start === start));
    pos = end + 1;
  }
  const sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>'],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}${sect}</w:body></w:document>`],
    ['word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1, 2, 3].map((n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="${30 - n * 2}"/></w:rPr></w:style>`).join('')}</w:styles>`],
    ['word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${W}/>`],
    ['docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Belge</dc:title></cp:coreProperties>'],
    ['docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>MaskeLex</Application></Properties>'],
  ];
  return zipDeterministic(files.map(([n, s]) => [n, enc.encode(s)] as const));
}
