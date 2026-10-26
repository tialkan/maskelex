import assert from 'node:assert/strict';
import { createMockEngine } from '../packages/core-engine/src/testing/index';
import { phonKey } from '../packages/core-engine/src/twins/twins';

const TEXT = `DAVACI : Ahmet Yılmaz
DAVALI : Mehmet Öztürk
Davacı Yılmaz'ın talebi, davalı Mehmet Öztürk'e bildirilmiştir. TCKN 10000000146.`;

async function main(): Promise<void> {
  const eng = createMockEngine({ seed: 5 });
  await eng.createSession({ mode: 'TWIN' });
  const { docId } = await eng.loadDocument({ kind: 'text', text: TEXT });
  const r = await eng.analyze(docId, () => {});
  const m = await eng.buildMasked(docId);
  console.log(m.text);
  for (const real of ['Ahmet', 'Yılmaz', 'Mehmet', 'Öztürk', '10000000146']) assert.ok(!m.text.includes(real), real);
  assert.deepEqual(m.leakFindings, []);
  const twins = [...m.text.matchAll(/《([^》]+)》/g)].map((x) => x[1]!);
  assert.ok(twins.length >= 4);
  // Ses anahtarı: ikiz soyadı özgünle aynı ek davranışını taşır
  const ahmet = r.entities.find((e) => e.canonical === 'Ahmet Yılmaz')!;
  const tw = (await eng.buildMasked(docId)) && twins[0]!.split(' ');
  assert.equal(phonKey(tw[1]!), phonKey('Yılmaz'));
  assert.equal(phonKey(tw[0]!), phonKey('Ahmet'));
  // Soyadı tek başına: ikizin soyadı, ek ikizin okunuşuna göre
  assert.ok(m.text.includes(`Davacı 《${tw[1]}》'`));
  // Kimlik numarası etiketle kalır
  assert.ok(m.text.includes('[TCKN_1]'));
  // Geri çözme: LLM ikizi eki ve işaretleri düşürerek yazsa da özgün ad döner
  const u = await eng.unmask(`《${tw.join(' ')}》'e ve ${tw.join(' ')} ile görüşüldü.`);
  assert.ok(u.text.startsWith("Ahmet Yılmaz'a ve Ahmet Yılmaz ile"), u.text);
  // İkizler oturum boyunca sabit
  assert.equal((await eng.buildMasked(docId)).text, m.text);
  void ahmet;

  // Aile: aynı gerçek soyadı aynı ikiz soyadı
  const e2 = createMockEngine({ seed: 9 });
  await e2.createSession({ mode: 'TWIN' });
  const d2 = await e2.loadDocument({ kind: 'text', text: 'MİRASÇI : Ahmet Yılmaz\nMİRASÇI : Mehmet Yılmaz' });
  await e2.analyze(d2.docId, () => {});
  const fam = [...(await e2.buildMasked(d2.docId)).text.matchAll(/《([^》]+)》/g)].map((x) => x[1]!.split(' ')[1]);
  assert.equal(fam.length, 2);
  assert.equal(fam[0], fam[1]);
  console.log('t18 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
