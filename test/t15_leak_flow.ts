import assert from 'node:assert/strict';
import { createMockEngine } from '../packages/core-engine/src/testing/index';

async function main(): Promise<void> {
  const eng = createMockEngine();
  await eng.createSession();
  // Aynı soyadı iki kişide: tek başına "Kaya" kişiye bağlanamaz, sızıntı denetimi yakalar
  const text = `DAVACI : Ayşe Kaya
DAVALI : Mehmet Kaya
Kaya ödeme yapmamıştır.`;
  const { docId } = await eng.loadDocument({ kind: 'text', text });
  const r = await eng.analyze(docId, () => {});
  const m = await eng.buildMasked(docId);
  assert.equal(m.leakFindings.length, 1);
  const f = m.leakFindings[0]!;
  // Bulgu aralığı KAYNAK metindedir
  assert.equal(text.slice(f.span!.start, f.span!.end), 'Kaya');
  assert.equal(f.span!.start, text.lastIndexOf('Kaya'));

  // Kullanıcı "Maskele" der ve bulguyu davalıya bağlar: ADD_MANUAL + MERGE
  const davali = r.entities.find((e) => e.canonical === 'Mehmet Kaya')!;
  const r2 = await eng.command({ type: 'ADD_MANUAL', docId, span: f.span!, category: 'KISI', applyToAll: false });
  const added = r2.entities.find((e) => r2.mentions.some((mm) => mm.entityId === e.id && mm.span.start === f.span!.start))!;
  await eng.command({ type: 'MERGE', sourceId: added.id, targetId: davali.id });
  const m2 = await eng.buildMasked(docId);
  assert.deepEqual(m2.leakFindings, []);
  assert.ok(m2.text.endsWith('[DAVALI_1] ödeme yapmamıştır.'));
  assert.equal((await eng.unmask('[DAVALI_1] ödeme yapmamıştır.')).text, 'Mehmet Kaya ödeme yapmamıştır.');
  // Onay yolu: bulgu onaylanınca listeden düşer, maskeli dosya üretilebilir
  const e2 = createMockEngine();
  await e2.createSession();
  const d2 = await e2.loadDocument({ kind: 'text', text });
  await e2.analyze(d2.docId, () => {});
  const leak = (await e2.buildMasked(d2.docId)).leakFindings[0]!;
  await assert.rejects(e2.exportFile({ source: 'MASKED', docId: d2.docId, format: 'txt' }), (e: { code: string }) => e.code === 'E_LEAK_DETECTED');
  await e2.command({ type: 'ACK_LEAK', docId: d2.docId, span: leak.span! });
  assert.deepEqual((await e2.buildMasked(d2.docId)).leakFindings, []);
  assert.ok((await e2.exportFile({ source: 'MASKED', docId: d2.docId, format: 'txt' })).bytes.length > 0);
  console.log('t15 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
