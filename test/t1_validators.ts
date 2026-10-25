import assert from 'node:assert/strict';
import { isValidTckn, isYkn, isValidVkn, mersisKind, isValidTrIban, isValidLuhn, cardNetwork, makeTckn, makeVkn, makeTrIban, mod } from '../packages/core-engine/src/validators/checksums';
import { numberToWordList, numberToWordsJoined, lastSpokenWord } from '../packages/core-engine/src/text/numberWords';
import { foldKey, trLower, trUpper, isUppercaseContext } from '../packages/core-engine/src/text/turkish';

// TCKN
assert.equal(isValidTckn('10000000146'), true);
assert.equal(isValidTckn('10000000145'), false);
assert.equal(isValidTckn('00000000146'), false);
assert.equal(isValidTckn('1000000014'), false);
assert.equal(mod(-29, 10), 1);
// rastgele üretim tutarlılığı
for (let i = 0; i < 2000; i++) {
  const f9 = String(100000000 + Math.floor(Math.random() * 899999999));
  const t = makeTckn(f9);
  assert.equal(isValidTckn(t), true, t);
  // tek hane bozulması yakalanmalı
  const pos = Math.floor(Math.random() * 11);
  const bad = t.slice(0, pos) + String((Number(t[pos]) + 1 + Math.floor(Math.random() * 8)) % 10) + t.slice(pos + 1);
  if (bad[0] !== '0') assert.equal(isValidTckn(bad), false, 'tek hane hatası: ' + t + ' → ' + bad);
}
const ykn = makeTckn('991234567');
assert.equal(isYkn(ykn), true);
console.log('YKN örnek', ykn);

// VKN
assert.equal(isValidVkn('1234567890'), true);
assert.equal(isValidVkn('1234567891'), false);
assert.equal(isValidVkn('0000000019'), true);
for (let i = 0; i < 2000; i++) {
  const f9 = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  assert.equal(isValidVkn(makeVkn(f9)), true);
}
// VKN tek hane hatası tespit oranı
let caught = 0, total = 0;
for (let i = 0; i < 5000; i++) {
  const v = makeVkn(String(Math.floor(Math.random() * 1e9)).padStart(9, '0'));
  const pos = Math.floor(Math.random() * 10);
  const nd = (Number(v[pos]) + 1 + Math.floor(Math.random() * 9)) % 10;
  const bad = v.slice(0, pos) + nd + v.slice(pos + 1);
  if (bad === v) continue;
  total++; if (!isValidVkn(bad)) caught++;
}
console.log('VKN tek hane hata yakalama oranı', (caught / total).toFixed(3));

// MERSİS
const vkn = makeVkn('313055729');
assert.equal(mersisKind('0' + vkn + '00015'), 'TUZEL');
const tc = makeTckn('123456789');
assert.equal(mersisKind(tc + '00015'), 'GERCEK');
assert.equal(mersisKind('0000000000000000'), null);

// IBAN
assert.equal(isValidTrIban('TR330006100519786457841326'), true);
assert.equal(isValidTrIban('TR330006100519786457841327'), false);
assert.equal(isValidTrIban('TR320006100519786457841326'), false);
const gen = makeTrIban('00012', '1234567890123456');
assert.equal(isValidTrIban(gen), true);
console.log('Üretilen IBAN', gen);

// Luhn
assert.equal(isValidLuhn('4111111111111111'), true);
assert.equal(isValidLuhn('4111111111111112'), false);
assert.equal(cardNetwork('4111111111111111'), 'VISA');
assert.equal(cardNetwork('5555555555554444'), 'MASTERCARD');
assert.equal(cardNetwork('378282246310005'), 'AMEX');

// Sayı yazısı
assert.deepEqual(numberToWordList(125000), ['yüz', 'yirmi', 'beş', 'bin']);
assert.equal(numberToWordsJoined(125000), 'yüzyirmibeşbin');
assert.equal(numberToWordsJoined(1000), 'bin');
assert.equal(numberToWordsJoined(1001), 'binbir');
assert.equal(numberToWordsJoined(2000), 'ikibin');
assert.equal(numberToWordsJoined(100), 'yüz');
assert.equal(numberToWordsJoined(1250000), 'birmilyonikiyüzellibin');
assert.equal(numberToWordsJoined(1000000), 'birmilyon');
assert.equal(numberToWordsJoined(0), 'sıfır');
assert.equal(lastSpokenWord('2024/892'), 'iki');
assert.equal(lastSpokenWord('10'), 'on');
assert.equal(lastSpokenWord('40'), 'kırk');
assert.equal(lastSpokenWord('1000'), 'bin');
assert.equal(lastSpokenWord('12345678901'), 'bir');
assert.equal(lastSpokenWord('0123'), 'üç');

// Türkçe metin
assert.equal(foldKey('İSMAİL'), 'ismail');
assert.equal(foldKey('ISMAIL'), 'ismail');
assert.equal(foldKey('Işık'), 'isik');
assert.equal(foldKey('ŞÜKRÜ Öğüt'), 'sukru ogut');
assert.equal(trLower('YILMAZ'), 'yılmaz');
assert.equal(trUpper('ayşe kaya'), 'AYŞE KAYA');
assert.equal(isUppercaseContext('DAVACI : [DAVACI_1]'), true);
assert.equal(isUppercaseContext('Davacı [DAVACI_1] vekili'), false);
console.log('t1 OK');
