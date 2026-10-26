import assert from 'node:assert/strict';
import { detectNames } from '../packages/core-engine/src/names/ruleDetector';
import { createMockEngine } from '../packages/core-engine/src/testing/index';

const found = (t: string): string[] => detectNames(t).map((h) => `${h.category}:${t.slice(h.start, h.end)}`);

assert.deepEqual(found('DAVACI : AHMET YILMAZ (T.C. Kimlik No: 1)'), ['KISI:AHMET YILMAZ']);
assert.deepEqual(found('VEKİLİ : Av. Mehmet Demir, Tel'), ['KISI:Mehmet Demir']);
assert.deepEqual(found('DAVALI : XYZ İnşaat Ltd. Şti.'), ['SIRKET:XYZ İnşaat Ltd. Şti.']);
assert.deepEqual(found('Sayın Zeynep Arslan ile Ali Bey görüştü.'), ['KISI:Zeynep Arslan', 'KISI:Ali']);
assert.deepEqual(found('Ankara Büyükşehir Belediyesi ve ABC Gıda San. ve Tic. A.Ş. taraftır.'),
  ['KURUM:Ankara Büyükşehir Belediyesi', 'SIRKET:ABC Gıda San. ve Tic. A.Ş.']);
// Dışlamalar: il, ay, kanun ve başlık sözcükleri ad sayılmaz
assert.deepEqual(found('Davacı Ankara Mart ayında başvurdu. Türk Borçlar Kanunu uyarınca.'), []);
assert.deepEqual(found('davacının talebi'), []);
// K4 sözlük: soyadı sözlükte ise ORTA, değilse DÜŞÜK (inceleme); büyük harfli başlık yalnız sözlükle
const conf = (t: string): string[] => detectNames(t).map((h) => `${h.confidence}:${t.slice(h.start, h.end)}`);
assert.deepEqual(conf('Bu toplantıya Mehmet Öztürk katıldı.'), ['MEDIUM:Mehmet Öztürk']);
assert.deepEqual(conf('Ahmet Can Demir ve Fatma Şahin tanıktır.'), ['MEDIUM:Ahmet Can Demir', 'MEDIUM:Fatma Şahin']);
assert.deepEqual(conf('Deniz Kuvvetleri Komutanlığı yazı gönderdi.'), ['LOW:Deniz Kuvvetleri Komutanlığı']);
assert.deepEqual(conf('ANKARA BÖLGE ADLİYE MAHKEMESİ'), []);
// K8 kesme kanıtı: cümle ortasında DÜŞÜK, cümle başında yok
assert.deepEqual(conf("Taraflar ile Yılmaz'ın arasında"), ['LOW:Yılmaz']);
assert.deepEqual(conf("Yılmaz'ın talebi."), []);

async function main(): Promise<void> {
  // NER olmadan: kural dedektörü + soyadı bağlama, sızıntı denetimi temiz
  const eng = createMockEngine();
  await eng.createSession();
  const text = `DAVACI : AYŞE KAYA
DAVALI : Burak Şahin
Davacı Kaya'nın talebi, davalı Şahin tarafından reddedilmiştir. Ayşe Kaya Hanım duruşmaya katıldı.`;
  const { docId } = await eng.loadDocument({ kind: 'text', text });
  const r = await eng.analyze(docId, () => {});
  const kaya = r.entities.find((e) => e.canonical === 'Ayşe Kaya')!;
  assert.equal(kaya.token, '[DAVACI_1]');
  assert.equal(kaya.mentionIds.length, 3);
  const m = await eng.buildMasked(docId);
  console.log(m.text);
  assert.ok(m.text.includes("Davacı [DAVACI_1]'in talebi, davalı [DAVALI_1] tarafından"));
  assert.deepEqual(m.leakFindings, []);
  assert.equal((await eng.unmask("[DAVACI_1]'e tebliğ edildi.")).text, "Ayşe Kaya'ya tebliğ edildi.");
  console.log('t12 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
