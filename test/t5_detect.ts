import assert from 'node:assert/strict';
import { detectAll } from '../packages/core-engine/src/detectors/deterministic/reference';
import { makeTckn, makeVkn, makeTrIban } from '../packages/core-engine/src/validators/checksums';

const tc = makeTckn('123456789');           // sentetik
const vkn = makeVkn('987654321');
const iban = makeTrIban('00062', '0000123456789012');
const spacedIban = iban.replace(/^(.{4})(.{4})(.{4})(.{4})(.{4})(.{4})(.{2})$/, '$1 $2 $3 $4 $5 $6 $7');
const mersis = '0' + vkn + '00015';
const sample = `ANKARA 4. ASLİYE TİCARET MAHKEMESİ'NE
DOSYA NO : 2024/892 E.
DAVACI : Ahmet Yılmaz (T.C. Kimlik No: ${tc}) Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/ANKARA
VEKİLİ : Av. Mehmet Demir, Tel: 0532 123 45 67, e-posta mehmet.demir@ornekhukuk.av.tr, KEP: mdemir@hs01.kep.tr
DAVALI : XYZ İnşaat Ltd. Şti. (VKN: ${vkn}, MERSİS No: ${mersis})
IBAN: ${spacedIban}
Kart: 4111 1111 1111 1111
AÇIKLAMALAR: 34 ABC 123 plakalı araç ile 06 B 1234 plakalı araç çarpışmıştır. Davacı 1985 doğumlu olup DOĞUM TARİHİ: 12.03.1985'tir.
6098 sayılı TBK m. 49 ve 5237 S.K. ile TBK 72 uyarınca; Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı emsal kararında da belirtildiği üzere.
Taşınmaz 123 ada 45 parsel sayılı yerdedir. Beyoğlu 12. Noterliği'nin 05123 yevmiye numaralı ihtarnamesi.
Dava değeri 125.000,00 TL (yüzyirmibeşbin Türk Lirası). Sicil 12345678901 değil, 12345678900 ve 1234567890 sayıları.
Bilgi için 444 1 444 ve 0850 123 45 67 numaraları.`;

const { raws, protectedSpans } = detectAll(sample, 2026);
const got = raws.map((r) => `${r.category}:${sample.slice(r.start, r.end)}:${r.confidence}`);
console.log(got.join('\n'));
console.log('KORUNAN:', protectedSpans.map((p) => sample.slice(p.start, p.end)).join(' | '));

const has = (cat: string, txt: string): boolean => raws.some((r) => r.category === cat && sample.slice(r.start, r.end) === txt);
assert.ok(raws.some((r) => r.category === 'DOSYA_NO' && sample.slice(r.start, r.end) === '2024/892' && r.confidence === 'HIGH'));
assert.ok(raws.some((r) => r.category === 'MERSIS' && r.confidence === 'HIGH'));
assert.ok(has('TCKN', tc));
assert.ok(has('TELEFON', '0532 123 45 67'));
assert.ok(has('EPOSTA', 'mehmet.demir@ornekhukuk.av.tr'));
assert.ok(has('EPOSTA', 'mdemir@hs01.kep.tr'));
assert.ok(has('VKN', vkn));
assert.ok(has('MERSIS', mersis));
assert.ok(has('IBAN', spacedIban));
assert.ok(has('KART', '4111 1111 1111 1111'));
assert.ok(has('PLAKA', '34 ABC 123'));
assert.ok(has('PLAKA', '06 B 1234'));
assert.ok(has('DOGUM_TARIHI', '12.03.1985'));
assert.ok(has('DOGUM_TARIHI', '1985'));
assert.ok(has('TAPU', '123 ada 45 parsel sayılı'));
assert.ok(has('YEVMIYE', '05123'));
// Yanlış pozitif olmamalı
assert.ok(!raws.some((r) => sample.slice(r.start, r.end).includes('2022/4110')));     // içtihat
assert.ok(!raws.some((r) => sample.slice(r.start, r.end).includes('TBK')));           // kanun
assert.ok(!raws.some((r) => r.category === 'TCKN' && sample.slice(r.start, r.end) === '12345678901'));   // sağlamasız 11 hane (ilk 10'u geçerli olsa da)
assert.ok(!raws.some((r) => sample.slice(r.start, r.end).startsWith('0850')));        // kurumsal hat
assert.ok(protectedSpans.some((p) => sample.slice(p.start, p.end) === '2022/4110'));
assert.ok(protectedSpans.some((p) => sample.slice(p.start, p.end).startsWith('6098 sayılı')));
console.log('t5 OK');
