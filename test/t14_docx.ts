import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { createEngine } from '../packages/core-engine/src/pipeline/engine';
import { seededRandom } from '../packages/core-engine/src/testing/index';
import { CODECS, readDocxSync, zipDeterministic } from '../packages/document-parsers/src/index';

const enc = new TextEncoder(), dec = new TextDecoder();
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const p = (inner: string, jc = 'both'): string => `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>${inner}</w:p>`;
const r = (t: string, rPr = ''): string => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const body = [
  p(r('ANKARA NÖBETÇİ ASLİYE HUKUK MAHKEMESİ\'NE', '<w:b/>'), 'center'),
  p(r('DAVACI : ') + r('Ayşe ', '<w:b/>') + r('Kaya', '<w:b/><w:i/>') + r(' (T.C. Kimlik No: 10000000146)')),
  p(r('Davacı Kaya\'nın ') + '<w:del><w:r><w:delText>gizli silinmiş Mehmet Öz</w:delText></w:r></w:del>' + r('talebi') + '<w:r><w:tab/></w:r>' + r('yerindedir.')),
  p('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPERLINK "x" </w:instrText></w:r>' + r('bağlantı')),
].join('');
const docx = zipDeterministic([
  ['[Content_Types].xml', enc.encode('<Types/>')],
  ['word/document.xml', enc.encode(`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`)],
  ['word/comments.xml', enc.encode(`<w:comments ${W}><w:comment><w:p>${r('Ayşe Kaya ile görüş')}</w:p></w:comment></w:comments>`)],
  ['word/header1.xml', enc.encode(`<w:hdr ${W}/>`)],
  ['docProps/core.xml', enc.encode('<cp:coreProperties><dc:creator>Av. Gizli Yazar</dc:creator></cp:coreProperties>')],
]);

async function main(): Promise<void> {
  const ast = readDocxSync(docx);
  assert.equal(ast.text, "ANKARA NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE\nDAVACI : Ayşe Kaya (T.C. Kimlik No: 10000000146)\nDavacı Kaya'nın talebi\tyerindedir.\nbağlantı");
  assert.deepEqual(ast.warnings.map((w) => w.code).sort(), ['COMMENTS_PRESENT', 'HEADER_FOOTER_TEXT', 'TRACKED_CHANGES']);

  let t = 0;
  const eng = createEngine({ rng: seededRandom(3), now: () => ++t, codecs: CODECS });
  await eng.createSession();
  const { docId } = await eng.loadDocument({ kind: 'file', fileName: 'Kaya dilekçe.docx', bytes: docx });
  await eng.analyze(docId, () => {});
  const f = await eng.exportFile({ source: 'MASKED', docId, format: 'docx' });
  assert.match(f.fileName, /^maskeli-[0-9a-f]{4}\.docx$/);
  const z = unzipSync(f.bytes);
  assert.ok(!z['word/comments.xml'] && !z['word/header1.xml']);
  const all = Object.values(z).map((b) => dec.decode(b)).join('\n');
  for (const secret of ['Kaya', 'Ayşe', '10000000146', 'Gizli Yazar', 'Mehmet Öz']) assert.ok(!all.includes(secret), secret);
  const back = readDocxSync(f.bytes);
  assert.equal(back.text, "[KURUM_1]'e\nDAVACI : [DAVACI_1] (T.C. Kimlik No: [TCKN_1])\nDavacı [DAVACI_1]'in talebi\tyerindedir.\nbağlantı");
  // Biçim korunur: başlık kalın ve ortalı, etiket kalın (adın ilk parçasının biçimi)
  assert.ok(back.marks.some((m) => m.style.bold && back.text.slice(m.span.start, m.span.end).includes('[DAVACI_1]')));
  assert.equal(back.blocks[0]!.kind === 'paragraph' && back.blocks[0]!.style.align, 'center');
  // Belirleyici çıktı
  assert.deepEqual((await eng.exportFile({ source: 'MASKED', docId, format: 'docx' })).bytes, f.bytes);

  const out = await eng.exportFile({ source: 'UNMASKED', format: 'docx', text: "Ayşe Kaya'ya tebliğ edildi.\nSaygılarımla." });
  assert.equal(readDocxSync(out.bytes).text, "Ayşe Kaya'ya tebliğ edildi.\nSaygılarımla.");
  console.log('t14 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
