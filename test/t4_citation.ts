import assert from 'node:assert/strict';
import { findDockets, classifyDockets, type CitationVerdict } from '../packages/core-engine/src/legal/citation';

const verdicts = (t: string): Array<[string, CitationVerdict]> =>
  classifyDockets(t, findDockets(t, 2026)).map((d) => [t.slice(d.match.start, d.match.end), d.verdict]);

assert.deepEqual(verdicts('Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı kararında da belirtildiği üzere'),
  [['2022/4110', 'PROTECT'], ['2023/1902', 'PROTECT']]);
assert.deepEqual(verdicts('Ankara 4. Asliye Ticaret Mahkemesi 2024/892 E. sayılı dosyası'), [['2024/892', 'MASK']]);
assert.deepEqual(verdicts('İst. 12. İcra Dairesi 2025/114 E. sayılı takip'), [['2025/114', 'MASK']]);
assert.deepEqual(verdicts("Yargıtay Hukuk Genel Kurulu'nun 12.05.2021 tarih ve 2017/2154 E., 2021/612 K. sayılı kararı emsal niteliktedir."),
  [['2017/2154', 'PROTECT'], ['2021/612', 'PROTECT']]);
assert.deepEqual(verdicts("Ankara BAM 23. HD'nin 2023/456 E. 2024/12 K. sayılı kararı"), [['2023/456', 'PROTECT'], ['2024/12', 'PROTECT']]);
assert.deepEqual(verdicts("Müvekkilimizin dosyası Yargıtay 3. HD'ye gönderilmiş olup 2024/5555 E. sayılı dosya incelemededir."),
  [['2024/5555', 'REVIEW']]);
assert.deepEqual(verdicts("Ankara 4. Asliye Ticaret Mahkemesinin 2024/892 E. sayılı dosyasında verilen ve Yargıtay 11. HD'nin 2025/100 E. sayılı ilamı ile onanan karar"),
  [['2024/892', 'MASK'], ['2025/100', 'REVIEW']]);
assert.deepEqual(verdicts('Danıştay 10. D. 2019/1234 E., 2021/77 K.'), [['2019/1234', 'PROTECT'], ['2021/77', 'PROTECT']]);
assert.deepEqual(verdicts('AYM, B. No: 2018/12345, 12/1/2021'), [['2018/12345', 'PROTECT']]);
assert.deepEqual(verdicts('12/03/2024 tarihli dilekçe ve 2024/03/12 tarihli tutanak'), []);
assert.deepEqual(verdicts("Bakırköy 5. İş Mahkemesi'nin 2023/77 Esas sayılı dosyası"), [['2023/77', 'MASK']]);
assert.deepEqual(verdicts('Ankara Bölge İdare Mahkemesi 2. İDD 2022/10 E.'), [['2022/10', 'PROTECT']]);
assert.deepEqual(verdicts('İstanbul 3. İdare Mahkemesi 2022/10 E.'), [['2022/10', 'MASK']]);
assert.deepEqual(verdicts('dosya no 2024/892 E. olarak kayıtlıdır'), [['2024/892', 'MASK']]);
assert.deepEqual(verdicts('5237 sayılı TCK ve 2024/1 sayılı genelge'), [['2024/1', 'MASK']]);
assert.deepEqual(verdicts('Ankara Batı Cumhuriyet Başsavcılığının 2024/12345 soruşturma sayılı dosyası'), [['2024/12345', 'MASK']]);
assert.deepEqual(verdicts('Ankara 2. Noterliği 2024/55'), [['2024/55', 'MASK']]);
// 60 karakterden uzak işaret dikkate alınmaz
assert.deepEqual(verdicts('Yargıtay ' + 'x'.repeat(70) + ' 2020/1 E.'), [['2020/1', 'MASK']]);
// Büyük harfli başlıklar ve ekli biçimler (JS /i bayrağı İ'yi eşlemez; lowerView ile çözülür)
assert.deepEqual(verdicts('YARGITAY 9. HUKUK DAİRESİ 2022/4110 E., 2023/1902 K.'), [['2022/4110', 'PROTECT'], ['2023/1902', 'PROTECT']]);
assert.deepEqual(verdicts('ANKARA 4. ASLİYE TİCARET MAHKEMESİ 2024/892 E.'), [['2024/892', 'MASK']]);
assert.deepEqual(verdicts("İstanbul Bölge Adliye Mahkemesinin 2023/1 E. sayılı kararı emsaldir"), [['2023/1', 'PROTECT']]);
assert.deepEqual(verdicts('AİHM büyük dairesinin 2019/5 sayılı kararı'), [['2019/5', 'PROTECT']]);
assert.deepEqual(verdicts('bamya 2020/3 E.'), [['2020/3', 'MASK']]);
console.log('t4 OK');

const ydText = 'ANKARA BÖLGE İDARE MAHKEMESİ\n4. İDARİ DAVA DAİRESİ\nY.D İtiraz No : 2021/1071';
assert.equal(classifyDockets(ydText, findDockets(ydText, 2026))[0]?.verdict, 'MASK');
