import assert from 'node:assert/strict';
import type { TextEdit } from '@maskelex/core-engine/types';
import { makePointMapper, applyEditsToText, remapRange, normalizeEdits, EditError } from '../packages/document-parsers/src/ast/remap';
import { locateCdata, rewriteContentXml, validateContentXml, scanOffsetElements, toCdata, UdfFormatError } from '../packages/document-parsers/src/udf/contentXml';

// ---- Sentetik UDF (alan adları udf-cli README örneğindeki gibi; gerçek dosyalarla ayrıca doğrulanacak) ----
const para = (runs: Array<[string, string]>, start: number): { xml: string; text: string } => {
  let off = start, xml = '<paragraph Alignment="3">', text = '';
  for (const [t, extra] of runs) {
    xml += `<content startOffset="${off}" length="${t.length}" family="Times New Roman" size="12"${extra} />`;
    off += t.length; text += t;
  }
  return { xml: xml + '</paragraph>', text };
};
const p1 = para([['DAVACI : ', ' bold="true"'], ['Ahmet ', ''], ['Yılmaz', ' bold="true"'], [' (TC: 10000000146)\n', '']], 0);
const p2 = para([["Davacı Ahmet Yılmaz'ın talebi, Ankara 4. Asliye Ticaret Mahkemesi 2024/892 E. sayılı dosyada görülmüştür.\n", '']], p1.text.length);
const p3 = para([['Yargıtay 9. HD 2022/4110 E., 2023/1902 K. emsal kararı ]]> özel karakter testi.\n', '']], p1.text.length + p2.text.length);
const fullText = p1.text + p2.text + p3.text;
const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<template format_id="1.8">\n<content>${toCdata(fullText)}</content>\n<properties><pageFormat mediaSizeName="1" leftMargin="42.52" rightMargin="28.35" topMargin="14.17" bottomMargin="14.17" paperOrientation="1" /></properties>\n<elements resolver="hvl-default">\n${p1.xml}\n${p2.xml}\n${p3.xml}\n</elements>\n<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>\n</template>`;

// CDATA okuma ("]]>" kaçışlı)
const cd = locateCdata(xml);
assert.equal(cd.text, fullText);
assert.equal(validateContentXml(xml).length, 0);
assert.equal(scanOffsetElements(xml, cd.contentCloseStart + 10).length, 6);

// Maskeleme düzenlemeleri
const find = (needle: string, from = 0): { start: number; end: number } => {
  const s = fullText.indexOf(needle, from); assert.ok(s >= 0, needle); return { start: s, end: s + needle.length };
};
const nameSpan1 = find('Ahmet Yılmaz');                        // iki run'a yayılıyor (normal + kalın)
const tcSpan = find('10000000146');
const nameSpan2 = find('Ahmet Yılmaz', nameSpan1.end);
const dosya = find('2024/892');
const maskEdits: TextEdit[] = [
  { span: nameSpan1, replacement: '[DAVACI_1]' },
  { span: tcSpan, replacement: '[TCKN_1]' },
  { span: nameSpan2, replacement: '[DAVACI_1]' },
  { span: dosya, replacement: '[DOSYA_NO_1]' },
];
const masked = rewriteContentXml(xml, maskEdits);
assert.equal(validateContentXml(masked.xml).length, 0, JSON.stringify(validateContentXml(masked.xml)));
const mText = locateCdata(masked.xml).text;
assert.ok(mText.includes('DAVACI : [DAVACI_1] (TC: [TCKN_1])'));
assert.ok(mText.includes('2022/4110 E., 2023/1902 K.'));          // içtihat dokunulmadı
assert.ok(mText.includes(']]> özel'));                              // kaçış korundu
assert.equal(masked.report.removedElements, 1);                    // "Yılmaz" kalın run'ı 0'a düştü ve silindi
// Paragraf içi bitişiklik ve toplam uzunluk
const els = scanOffsetElements(masked.xml, locateCdata(masked.xml).contentCloseStart + 10);
let expect = 0;
for (const e of els) { assert.equal(Number(e.startOffset.value), expect); expect += Number(e.length.value); }
assert.equal(expect, mText.length);
// Değişmeyen bayt alanları korunur
assert.ok(masked.xml.includes('<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>'));
assert.ok(masked.xml.startsWith('<?xml version="1.0" encoding="UTF-8" ?>\n<template format_id="1.8">'));

// Geri çözme: maskeli metindeki etiketleri özgün metinle değiştir → metin birebir geri gelmeli
const unmaskEdits: TextEdit[] = [];
const re = /\[(DAVACI_1|TCKN_1|DOSYA_NO_1)\]/g;
const back: Record<string, string> = { DAVACI_1: 'Ahmet Yılmaz', TCKN_1: '10000000146', DOSYA_NO_1: '2024/892' };
for (const m of mText.matchAll(re)) unmaskEdits.push({ span: { start: m.index!, end: m.index! + m[0].length }, replacement: back[m[1]!]! });
const restored = rewriteContentXml(masked.xml, unmaskEdits);
assert.equal(locateCdata(restored.xml).text, fullText);
assert.equal(validateContentXml(restored.xml).length, 0);
// Tek run içindeki varlıklarda ofsetler özgünle birebir aynı; iki run'a yayılan varlıkta biçim birleşir (bilinen sınırlama)
const origEls = scanOffsetElements(xml, cd.contentCloseStart + 10).map((e) => [e.startOffset.value, e.length.value].join(':'));
const restEls = scanOffsetElements(restored.xml, locateCdata(restored.xml).contentCloseStart + 10).map((e) => [e.startOffset.value, e.length.value].join(':'));
console.log('özgün  ', origEls.join(' '));
console.log('geri   ', restEls.join(' '));
assert.deepEqual(restEls.slice(2), origEls.slice(3));

// Eşleyici özellik testi (rastgele)
for (let iter = 0; iter < 3000; iter++) {
  const len = 30 + Math.floor(Math.random() * 60);
  const text = 'x'.repeat(len);
  const edits: TextEdit[] = [];
  let pos = Math.floor(Math.random() * 4);
  while (pos < len - 2 && edits.length < 6) {
    const l = 1 + Math.floor(Math.random() * 6);
    if (pos + l > len) break;
    edits.push({ span: { start: pos, end: pos + l }, replacement: 'y'.repeat(Math.floor(Math.random() * 12)) });
    pos += l + Math.floor(Math.random() * 8);
  }
  const map = makePointMapper(normalizeEdits(text, edits));
  // rastgele bitişik bölümleme: kapsama ve bitişiklik korunmalı
  const cuts = [0, ...Array.from({ length: 5 }, () => Math.floor(Math.random() * len)).sort((a, b) => a - b), len];
  const newLen = applyEditsToText(text, edits).length;
  let cursor = 0, prevEnd = 0;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const r = remapRange(map, { start: cuts[k]!, length: cuts[k + 1]! - cuts[k]! });
    if (!r) continue;
    assert.equal(r.start, prevEnd, 'bitişiklik');
    prevEnd = r.start + r.length; cursor = prevEnd;
  }
  assert.equal(cursor, newLen, 'kapsama');
  for (let p = 0; p < len; p++) assert.ok(map(p) <= map(p + 1), 'monotonluk');
}

// Ön koşul ihlalleri
assert.throws(() => normalizeEdits('abc\ndef', [{ span: { start: 2, end: 5 }, replacement: 'z' }]), EditError);
assert.throws(() => normalizeEdits('abcdef', [{ span: { start: 1, end: 3 }, replacement: 'z' }, { span: { start: 2, end: 4 }, replacement: 'q' }]), EditError);
assert.throws(() => locateCdata('<template><content> <![CDATA[x]]></content></template>'), UdfFormatError);
console.log('t3 OK');
