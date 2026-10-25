import assert from 'node:assert/strict';
import { profileOf, realize, parseSuffix, parseSuffixAll, rehydrateSuffix, refineWithEvidence, tokenReadingProfile, isLetterByLetter } from '../packages/core-engine/src/morphology/morphology';

const fix = (llm: string, entity: string): string => rehydrateSuffix(llm, profileOf(entity)).suffixOut;

// İstenen örnekler
assert.equal(fix('in', 'Ayşe Kaya'), 'nın');        // [DAVACI_1]'in + Ayşe Kaya → Kaya'nın
assert.equal(fix('e', 'Ahmet Yılmaz'), 'a');        // Yılmaz'a
assert.equal(fix('in', 'Ahmet Yılmaz'), 'ın');
assert.equal(fix('nın', 'Ahmet Yılmaz'), 'ın');
assert.equal(fix('i', 'Ayşe Kaya'), 'yı');          // belirtme (ACC)
assert.equal(fix('si', 'Ayşe Kaya'), 'sı');         // iyelik açıkça
assert.equal(fix('de', 'Ahmet Yılmaz'), 'da');
assert.equal(fix('de', 'Mehmet Öztürk'), 'te');     // sert ünsüz
assert.equal(fix('den', 'Mehmet Öztürk'), 'ten');
assert.equal(fix('dir', 'Mehmet Öztürk'), 'tür');
assert.equal(fix('ye', 'Duru Mutlu'), 'ya');
assert.equal(fix('nin', 'Duru Mutlu'), 'nun');
assert.equal(fix('in', 'Gönül Özgür'), 'ün');
assert.equal(fix('e', 'Gönül Özgür'), 'e');
assert.equal(fix('le', 'Ahmet Yılmaz'), 'la');
assert.equal(fix('yle', 'Ayşe Kaya'), 'yla');
assert.equal(fix('ce', 'Ahmet Yılmaz'), 'ca');
assert.equal(fix('ce', 'Burak Toprak'), 'ça');
assert.equal(fix('lerin', 'Ahmet Yılmaz'), 'ların');
assert.equal(fix('inki', 'Ayşe Kaya'), 'nınki');
assert.equal(fix('teki', 'Ayşe Kaya'), 'daki');
assert.equal(fix('dır', 'Ayşe Kaya'), 'dır');
assert.equal(fix('ydi', 'Ahmet Yılmaz'), 'dı');
assert.equal(fix('ken', 'Ahmet Yılmaz'), 'ken');
assert.equal(fix('yken', 'Ahmet Yılmaz'), 'ken');
assert.equal(fix('siz', 'Ayşe Kaya'), 'sız');
// Damak l'si istisnası
assert.equal(fix('ın', 'Kemal Sunal'), 'ın');       // Sunal → kalın
assert.equal(fix('ın', 'Mustafa Kemal'), 'in');     // Kemal → ince
// Şirketler
assert.equal(fix('nin', 'ABC Yapı A.Ş.'), 'nin');  // A.Ş. → "şe"
assert.equal(fix('a', 'ABC Yapı A.Ş.'), 'ye');
assert.equal(fix('e', 'XYZ İnşaat Ltd. Şti.'), 'ne');   // Şti. → şirketi → -ne
assert.equal(fix('de', 'XYZ İnşaat Ltd. Şti.'), 'nde');
assert.equal(fix('den', 'XYZ İnşaat Ltd. Şti.'), 'nden');
assert.equal(fix('ce', 'Ankara Büyükşehir Belediyesi'), 'nce');  // Belediyesince
assert.equal(fix('yle', 'XYZ İnşaat Ltd. Şti.'), 'yle');
assert.equal(fix('ın', 'Türk Hava Yolları THY'), 'nin');  // THY → "ye"
assert.equal(fix('a', 'SGK'), 'ye');                      // SGK → "ke" (TDK okunuşu)
assert.equal(fix('ın', 'ODTÜ'), 'nün');                   // kelime gibi okunur
assert.equal(fix('ın', 'TÜİK'), 'in');
assert.equal(fix('ın', 'ASELSAN'), 'ın');
assert.equal(fix('e', 'ABD'), 'ye');
assert.equal(isLetterByLetter('ALİ'), false);
assert.equal(isLetterByLetter('ABD'), true);
assert.equal(isLetterByLetter('AYM'), true);
assert.equal(isLetterByLetter('İTÜ'), false);
assert.equal(isLetterByLetter('ÖSYM'), true);
assert.equal(isLetterByLetter('TRT'), true);
assert.equal(isLetterByLetter('NATO'), false);
// Büyük harfli tam ad (dilekçe başlığı)
assert.equal(fix('ın', 'AHMET YILMAZ'), 'ın');
assert.equal(fix('e', 'AYŞE KAYA'), 'ya');
// Sayılar
assert.equal(fix('nin', '12345678901'), 'in');            // ...01 → "bir"
assert.equal(fix('de', '2024/892'), 'de');                // "iki"
assert.equal(fix('e', '2024/890'), 'a');                  // "doksan"
assert.equal(fix('e', '06 ABC 123'), 'e');                // "üç" → üç'e
assert.equal(fix('de', '06 ABC 123'), 'te');
assert.equal(fix('ın', '06 ABC 40'), 'ın');               // "kırk"
assert.equal(fix('a', 'TR33 0006 1005 1978 6457 8413 26'), 'ya'); // "altı"
// Adres
assert.equal(fix('de', 'Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/ANKARA'), 'da');
assert.equal(fix('e', 'Bahçe Sokağı'), 'na');
// Yabancı ad sözlüğü
assert.equal(fix('in', 'George Smith'), 'in');            // Smith: son ünlü i
assert.equal(fix('in', 'George'), 'un');                  // corc
assert.equal(profileOf('Michael').confidence, 'HIGH');
assert.equal(profileOf('Sheldon').confidence, 'LOW');     // yabancı görünümlü → inceleme

// Büyük harfli ek
assert.equal(rehydrateSuffix('İN', profileOf('AYŞE KAYA')).suffixOut, 'NIN');

// Ayrıştırma
assert.deepEqual(parseSuffix('nın'), ['GEN']);
assert.deepEqual(parseSuffix('lerinden'), ['PL', 'POSS', 'ABL']);
assert.deepEqual(parseSuffix('i'), ['ACC']);
assert.deepEqual(parseSuffix('si'), ['POSS']);
assert.deepEqual(parseSuffix('inkiler'), ['GEN', 'KI', 'PL']);
assert.deepEqual(parseSuffix('tekilerin'), ['LOC', 'KI', 'PL', 'GEN']);
assert.deepEqual(parseSuffix('ndan'), ['ABL']);
assert.equal(parseSuffix('xyz'), null);
assert.equal(parseSuffix('ve'), null);
console.log('ayrıştırma örnekleri', parseSuffixAll('ın'), parseSuffixAll('ne'));

// Etiket okunuşu
assert.equal(realize(['GEN'], tokenReadingProfile('[DAVACI_1]')), 'in');
assert.equal(realize(['GEN'], tokenReadingProfile('[DAVACI_2]')), 'nin');
assert.equal(realize(['DAT'], tokenReadingProfile('[ŞİRKET_A]')), 'ya');
assert.equal(realize(['DAT'], tokenReadingProfile('[ŞİRKET_B]')), 'ye');
assert.equal(realize(['LOC'], tokenReadingProfile('[DOSYA_NO_3]')), 'te');
assert.equal(realize(['GEN'], tokenReadingProfile('[TCKN_10]')), 'un');

// Kanıt: kaynak belgede "A.Ş.'ne" yazılmışsa n'li çekime geç
const asProfile = refineWithEvidence(profileOf('ABC Yapı A.Ş.'), ['ne']);
assert.equal(asProfile.pronominalN, true);
assert.equal(realize(['LOC'], asProfile), 'nde');
// Kanıt hesaplananla tutarlıysa değişmez
const yp = refineWithEvidence(profileOf('Ahmet Yılmaz'), ['ın', 'a']);
assert.equal(yp.source, 'WORD');
// Yabancı ad, kanıtla düzelir: "Michel'ın"
const mp = refineWithEvidence(profileOf('Michel'), ['ın']);
assert.equal(realize(['DAT'], mp), 'a');

// Kapsamlı tutarlılık: her gövde ve ek için realize∘parse sabit
const stems = ['Ayşe Kaya', 'Ahmet Yılmaz', 'Mehmet Öztürk', 'Duru Mutlu', 'Gönül Özgür', 'Burak Toprak', 'XYZ Ltd. Şti.', 'ABC A.Ş.', '2024/892', 'Ufuk Bulut', 'Öykü Ünlü'];
const sufs = ['in', 'nın', 'e', 'ya', 'i', 'yi', 'de', 'ta', 'den', 'tan', 'le', 'yla', 'ce', 'lar', 'ların', 'inki', 'deki', 'dir', 'ydi', 'ken', 'siz', 'li'];
let n = 0;
for (const st of stems) for (const s of sufs) {
  const p = profileOf(st);
  const r1 = rehydrateSuffix(s, p).suffixOut;
  const r2 = rehydrateSuffix(r1, p).suffixOut;
  assert.equal(r2, r1, `idempotent değil: ${st} + ${s} → ${r1} → ${r2}`);
  n++;
}
console.log('idempotans denetimi', n, 'vaka');
console.log('t2 OK');
