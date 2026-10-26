import assert from 'node:assert/strict';
import { createMockEngine } from '../packages/core-engine/src/testing/index';

const TEXT = `DAVACI : Ayşe Kaya
Dava değeri 125.000,00 TL (yüzyirmibeşbin Türk Lirası) olup ayrıca ₺25.000 ve 1.250.000.-TL talep edilmiştir.`;

async function run(mode: 'OFF' | 'TOKEN' | 'SCALE') {
  const eng = createMockEngine({ seed: 11 });
  await eng.createSession({ amountMode: mode });
  const { docId } = await eng.loadDocument({ kind: 'text', text: TEXT });
  await eng.analyze(docId, () => {});
  return { eng, m: await eng.buildMasked(docId) };
}

async function main(): Promise<void> {
  // OFF: tutarlar olduğu gibi
  const off = await run('OFF');
  assert.ok(off.m.text.includes('125.000,00 TL (yüzyirmibeşbin Türk Lirası)'));

  // TOKEN: rakam ve yazı aynı etiket; geri çözme özgün tutara döner
  const tok = await run('TOKEN');
  assert.ok(tok.m.text.includes('[TUTAR_1] TL ([TUTAR_1] Türk Lirası)'), tok.m.text);
  assert.ok(!/125\.000|yüzyirmibeş|25\.000/.test(tok.m.text));
  assert.deepEqual(tok.m.leakFindings, []);
  assert.equal((await tok.eng.unmask('[TUTAR_1] TL istenmiştir.')).text, '125.000,00 TL istenmiştir.');

  // SCALE: tüm tutarlar aynı k ile; biçim ve oranlar korunur; yazı yeni değere göre
  const sc = await run('SCALE');
  const nums = [...sc.m.text.matchAll(/([0-9.]+(?:,[0-9]{2})?)(?:\.-)?\s?TL|₺([0-9.]+)/g)].map((x) => Number((x[1] ?? x[2])!.replace(/\.$/, '').replace(/\./g, '').replace(',', '.')));
  assert.equal(nums.length, 3);
  const k = nums[0]! / 125000;
  assert.ok(k < 0.95 || k > 1.05);
  assert.ok(Math.abs(nums[1]! / 25000 - k) < 1e-3 && Math.abs(nums[2]! / 1250000 - k) < 1e-3, 'oran korunmalı');
  assert.match(sc.m.text, /[0-9]{1,3}\.[0-9]{3},[0-9]{2} TL \(/);          // binlik ayracı ve 2 ondalık korunur
  assert.ok(!sc.m.text.includes('yüzyirmibeşbin'));
  assert.deepEqual(sc.m.leakFindings, []);
  // Birebir ölçekli tutar özgüne döner; türetilmiş tutar için öneri verilir
  const scaled = sc.m.text.match(/([0-9.]+,[0-9]{2}) TL/)![1]!;
  const u = await sc.eng.unmask(`${scaled} TL ve 1.000,00 TL faiz.`);
  assert.ok(u.text.startsWith('125.000,00 TL ve 1.000,00 TL'), u.text);
  assert.ok(u.issues.some((i) => i.kind === 'AMOUNT_DERIVED'));
  // Kasa içe/dışa aktarımı k'yı korur
  const bytes = await sc.eng.exportVault('uzun-ve-guclu-parola');
  const e2 = createMockEngine();
  await e2.importVault(bytes, 'uzun-ve-guclu-parola');
  assert.ok((await e2.unmask(`${scaled} TL`)).text.startsWith('125.000,00 TL'));
  console.log('t16 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
