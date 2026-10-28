import assert from 'node:assert/strict';
import { createMockEngine } from '../packages/core-engine/src/testing/index';
import { detectAll } from '../packages/core-engine/src/detectors/deterministic/reference';

async function main(): Promise<void> {
  const text = 'İdare Mahkemesi kararında E:2021/1591 sayılı dosya, E.52993 ve E.9096169 sayılı yazılar, 51387834/150.02/4953059 sayılı işlem; sağlık problemleri nedeniyle eğitim gecikti. 1416 sayılı Kanun uygulanır.';
  const e = createMockEngine(); await e.createSession();
  const { docId } = await e.loadDocument({ kind: 'text', text });
  await e.analyze(docId, () => {});
  const output = await e.buildMasked(docId);
  for (const secret of ['2021/1591', 'E.52993', 'E.9096169', '51387834/150.02/4953059', 'sağlık problemleri']) assert.ok(!output.text.includes(secret), secret);
  assert.ok(output.text.includes('1416 sayılı Kanun'));
  assert.equal(output.leakFindings.length, 0);
  assert.ok(detectAll('Sağlık sorunları nedeniyle E.123456 sayılı işlem', 2026).raws.some((r) => r.ruleId === 'L1.SAGLIK'));
  console.log('t21 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
