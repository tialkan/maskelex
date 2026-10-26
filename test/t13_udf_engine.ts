import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { createMockEngine } from '../packages/core-engine/src/testing/index';
import { createEngine } from '../packages/core-engine/src/pipeline/engine';
import { seededRandom } from '../packages/core-engine/src/testing/index';
import { CODECS, buildContentXml, zipDeterministic, locateCdata, validateContentXml, unzipLimited, ZipPolicyError } from '../packages/document-parsers/src/index';

const enc = new TextEncoder(), dec = new TextDecoder();
const source = `T.C.
ANKARA 4. ASLİYE TİCARET MAHKEMESİ'NE

DAVACI : Ahmet Yılmaz (T.C. Kimlik No: 10000000146)
DAVALI : XYZ İnşaat Ltd. Şti.
Davacı Yılmaz'ın alacağı ödenmemiştir. Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı karar emsaldir.`;
const udf = zipDeterministic([
  ['content.xml', enc.encode(buildContentXml(source))],
  ['documentproperties.xml', enc.encode('<properties/>')],
  ['sign.sgn', new Uint8Array([1, 2, 3])],
  ['resim.png', new Uint8Array([9, 9])],
]);

async function main(): Promise<void> {
  // Belirleyici ZIP: aynı girdi aynı bayt
  assert.deepEqual(zipDeterministic([['a', enc.encode('x')]]), zipDeterministic([['a', enc.encode('x')]]));

  let t = 0;
  const eng = createEngine({ rng: seededRandom(7), now: () => ++t, codecs: CODECS });
  await eng.createSession();
  const loaded = await eng.loadDocument({ kind: 'file', fileName: 'Dilekçe Ahmet.udf', bytes: udf });
  assert.ok(loaded.text.startsWith('T.C.\nANKARA'));
  assert.deepEqual(loaded.warnings.map((w) => w.code).sort(), ['SIGNATURE_PRESENT', 'UYAP_METADATA_PRESENT']);
  await eng.analyze(loaded.docId, () => {});

  const file = await eng.exportFile({ source: 'MASKED', docId: loaded.docId, format: 'udf' });
  assert.match(file.fileName, /^maskeli-[0-9a-f]{4}\.udf$/);            // özgün ad sızmaz
  const z = unzipSync(file.bytes);
  assert.deepEqual(Object.keys(z).sort(), ['content.xml', 'resim.png']); // imza ve UYAP üst verisi düşer
  const xml = dec.decode(z['content.xml']);
  assert.deepEqual(validateContentXml(xml), []);
  const text = locateCdata(xml).text;
  assert.ok(!text.includes('Yılmaz') && !text.includes('10000000146') && !text.includes('XYZ'));
  assert.ok(text.includes("Davacı [DAVACI_1]'in alacağı"));
  assert.ok(text.includes('2022/4110'));

  // Çözülmüş çıktı: yeni UDF, yalnız content.xml
  const out = await eng.exportFile({ source: 'UNMASKED', format: 'udf', text: "Ahmet Yılmaz'a tebliğ edildi.\n\nSaygılarımla." });
  const z2 = unzipSync(out.bytes);
  assert.deepEqual(Object.keys(z2), ['content.xml']);
  const x2 = dec.decode(z2['content.xml']);
  assert.deepEqual(validateContentXml(x2), []);
  assert.equal(locateCdata(x2).text, "Ahmet Yılmaz'a tebliğ edildi.\n​\nSaygılarımla.\n");

  // Kaynak biçimi olmayan maskeli dosya istenemez; desteklenmeyen dosya reddedilir
  const m = createMockEngine();
  await m.createSession();
  await assert.rejects(m.loadDocument({ kind: 'file', fileName: 'a.pdf', bytes: new Uint8Array(4) }), (e: { code: string }) => e.code === 'E_UNSUPPORTED_FORMAT');
  await assert.rejects(eng.loadDocument({ kind: 'file', fileName: 'bozuk.udf', bytes: zipDeterministic([['x.txt', enc.encode('x')]]) }),
    (e: { code: string }) => e.code === 'E_UDF_FORMAT');

  // Zip bombası koruması
  const many = zipDeterministic(Array.from({ length: 70 }, (_, i) => [`f${i}`, new Uint8Array(1)] as const));
  assert.throws(() => unzipLimited(many), ZipPolicyError);
  console.log('t13 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
