import assert from 'node:assert/strict';
import { unmask, type UnmaskView } from '../packages/core-engine/src/unmask/rehydrate';
import { profileOf } from '../packages/core-engine/src/morphology/morphology';
import { findAmounts, scaleAmounts, pickScale, parseTrNumber, formatTrNumber } from '../packages/core-engine/src/fuzz/amount';
import { tokenKey, type RandomSource } from '../packages/core-engine/src/types/contracts';
import { applyEditsToText } from '../packages/document-parsers/src/ast/remap';

assert.equal(tokenKey('[Davacı_1]'), 'DAVACI_1');
assert.equal(tokenKey('\\[DAVACI\\_1\\]'), 'DAVACI_1');
assert.equal(tokenKey('[ŞIRKET_A]'), 'SIRKET_A');

const view: UnmaskView = {
  entities: [
    { id: 'E-0001', tokens: ['[DAVACI_1]', '[KİŞİ_1]'], canonical: 'Ayşe Kaya', phon: profileOf('Ayşe Kaya'), givenCanonical: 'Ayşe', phonGiven: profileOf('Ayşe'), twin: { full: 'Seda Tuna', given: 'Seda', surname: 'Tuna' } },
    { id: 'E-0002', tokens: ['[DAVALI_1]'], canonical: 'Ahmet Yılmaz', phon: profileOf('Ahmet Yılmaz'), givenCanonical: 'Ahmet', phonGiven: profileOf('Ahmet'), twin: { full: 'Kaan Korkmaz', given: 'Kaan', surname: 'Korkmaz' } },
    { id: 'E-0003', tokens: ['[ŞİRKET_A]'], canonical: 'XYZ İnşaat Ltd. Şti.', phon: profileOf('XYZ İnşaat Ltd. Şti.') },
    { id: 'E-0004', tokens: ['[TCKN_1]'], canonical: '10000000146', phon: profileOf('10000000146') },
    { id: 'E-0005', tokens: ['[DOSYA_NO_1]'], canonical: '2024/892', phon: profileOf('2024/892') },
  ],
  groups: [{ id: 'G-01', token: '[SOYAD_1]', value: 'Yılmaz', phon: profileOf('Yılmaz') }],
};

const llm = `Davacı [DAVACI_1]'in talebi yerindedir. [DAVALI_1]'e ihtarname gönderilmiş, [ŞİRKET_A]'ya ödeme yapılmamıştır.
[DAVACI_1]’nın TC kimlik numarası [TCKN_1]'dir. Dosya [DOSYA_NO_1]'de görülmektedir.
**[Davacı_1]** ile \\[DAVALI\\_1\\] arasında; DAVACI_1 ise beyanda bulunmuştur. [DAVACI_3] belirsizdir. Sayın [SOYAD_1]'e bildirildi. [bkz. ek 1]
DAVACI : [DAVACI_1]`;
const r = unmask(llm, view);
console.log(r.text);
assert.ok(r.text.includes("Davacı Ayşe Kaya'nın talebi"));
assert.ok(r.text.includes("Ahmet Yılmaz'a ihtarname"));
assert.ok(r.text.includes("XYZ İnşaat Ltd. Şti.'ne ödeme"));
assert.ok(r.text.includes("Ayşe Kaya’nın TC kimlik numarası 10000000146'dır"));
assert.ok(r.text.includes("2024/892'de görülmektedir"));
assert.ok(r.text.includes('**Ayşe Kaya** ile Ahmet Yılmaz arasında; Ayşe Kaya ise'));
assert.ok(r.text.includes("Sayın Yılmaz'a bildirildi. [bkz. ek 1]"));     // sıradan köşeli parantez dokunulmaz
assert.ok(r.text.endsWith('DAVACI : AYŞE KAYA'));
assert.equal(r.issues.filter((i) => i.kind === 'UNKNOWN_TOKEN').length, 1);
assert.ok(r.issues.some((i) => i.kind === 'GROUP_TOKEN'));
assert.equal(r.stats.suffixCorrections, 5);
// Çıktı aralıkları çıktı metniyle tutarlı olmalı
for (const rep of r.replacements) assert.equal(r.text.slice(rep.outSpan.start, rep.outSpan.end), rep.restored);

// Fonetik İkiz modu
const r2 = unmask(`《Seda Tuna》'nın talebi; 《Kaan Korkmaz》'a karşı. Seda Hanım ve Kaan Bey uzlaşamamıştır. Korkmaz'ın beyanı.`, view);
assert.equal(r2.text, "Ayşe Kaya'nın talebi; Ahmet Yılmaz'a karşı. Ayşe Hanım ve Ahmet Bey uzlaşamamıştır. Ahmet Yılmaz'ın beyanı.");
assert.equal(r2.stats.twinsFound, 5);

// Tutar şaşırtma: oran korunur, birebir eşleşen geri alınır, türetilmiş olan yalnız önerilir
const src = 'Asıl alacak 125.000,00 TL (yüzyirmibeşbin Türk Lirası) ve 10.000 TL vekalet ücreti.';
const hits = findAmounts(src);
assert.equal(hits.length, 2);
assert.equal(hits[0]!.words?.text, 'yüzyirmibeşbin');
const k = 1.2;
const edits = scaleAmounts(hits, k);
assert.deepEqual(edits.map((e) => e.replacement), ['150.000,00', 'yüzellibin', '12.000']);
assert.equal(applyEditsToText(src, edits), 'Asıl alacak 150.000,00 TL (yüzellibin Türk Lirası) ve 12.000 TL vekalet ücreti.');
const pairs = edits.filter((e) => /\d/.test(e.replacement)).map((e) => ({ fuzzed: e.replacement, original: src.slice(e.span.start, e.span.end) }));
const r3 = unmask('Asıl alacak 150.000,00 TL; %9 faizi 13.500,00 TL eder. Harç 615,40 TL. Davacı [DAVACI_1]', { ...view, amounts: { k, pairs } });
assert.equal(r3.text, 'Asıl alacak 125.000,00 TL; %9 faizi 13.500,00 TL eder. Harç 615,40 TL. Davacı Ayşe Kaya');   // otomatik bölme YOK
assert.deepEqual(r3.issues.filter((i) => i.kind === 'AMOUNT_DERIVED').map((i) => i.suggestion), ['11.250,00', '512,83']);
for (const rep of r3.replacements) assert.equal(r3.text.slice(rep.outSpan.start, rep.outSpan.end), rep.restored);
assert.equal(formatTrNumber(parseTrNumber('1.250.000').value, parseTrNumber('1.250.000').style), '1.250.000');
const rng: RandomSource = { nextUint32: () => 0, nextFloat: () => Math.random() };
for (let i = 0; i < 1000; i++) { const s = pickScale(rng); assert.ok(s >= 0.8 && s <= 1.25 && (s < 0.95 || s > 1.05)); }
console.log('t7 OK');
