import assert from 'node:assert/strict';
import { createMockEngine } from '../packages/core-engine/src/testing/index';
import { judgeSignatures } from '../packages/core-engine/src/names/judgeSignatures';
import { leakAudit } from '../packages/core-engine/src/pipeline/leakAudit';
import type { MaskingSessionVault } from '../packages/core-engine/src/types/contracts';

async function main(): Promise<void> {
  const text = 'Yükseköğretim Kurulu Başkanlığı karar verdi.\nBaşkan\nABDURRAHMAN BEŞİROĞLU\n217373\n\nÜye\nMAHMUT CELAL ÇENBERCİ\n28253\n\nÜye\nMURAT MENGİ\n102316';
  const engine = createMockEngine();
  await engine.createSession();
  const { docId } = await engine.loadDocument({ kind: 'text', text });
  const result = await engine.analyze(docId, () => {});
  assert.equal(result.entities.filter((e) => e.role === 'HAKIM' && e.status === 'MASK').length, 3);
  assert.equal(result.entities.filter((e) => e.category === 'OZEL' && e.status === 'MASK').length, 3);
  assert.ok(result.entities.some((e) => e.category === 'KURUM' && e.status === 'MASK'));
  const output = await engine.buildMasked(docId);
  for (const original of ['BEŞİROĞLU', 'ÇENBERCİ', 'MENGİ', '217373', '28253', '102316', 'Yükseköğretim Kurulu Başkanlığı']) assert.ok(!output.text.includes(original), original);
  assert.deepEqual(output.leakFindings, []);
  assert.equal(judgeSignatures('Başkan\nGündem ve karar\n12345').length, 0);
  const vault = { entities: new Map() } as unknown as MaskingSessionVault;
  for (const sample of ['Başkan\n[HAKİM_1]\n217373', 'Üye\nMURAT MENGİ\n[GİZLİ_1]']) {
    assert.equal(leakAudit({ docId, masked: sample, vault, tokenSpans: [], currentYear: 2026 }).length, 1);
  }
  console.log('t20 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
