import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILT_IN_TEMPLATES, KORUMA } from '../packages/core-engine/src/pipeline/templates';
import { createMockEngine } from '../packages/core-engine/src/testing/index';

// Şablon metinleri MASTER 5.11 ile birebir
const master = readFileSync(new URL('../MASTER.md', import.meta.url), 'utf8');
const sec = master.slice(master.indexOf('### 5.11'), master.indexOf('### 5.12'));
assert.ok(sec.includes(KORUMA), 'KORUMA metni MASTER ile aynı değil');
for (const t of BUILT_IN_TEMPLATES) {
  const row = sec.split('\n').find((l) => l.startsWith(`| \`${t.id}\``));
  assert.ok(row, t.id);
  const gorev = row!.split('|')[3]!.trim().replace(/^"|"$/g, '');
  assert.ok(t.body.endsWith(gorev) && row!.includes(t.title), t.id);
}

async function main(): Promise<void> {
  const eng = createMockEngine();
  await eng.createSession();
  const { docId } = await eng.loadDocument({ kind: 'text', text: 'DAVACI : Ayşe Kaya alacaklıdır. $& $1' });
  await eng.analyze(docId, () => {});
  const m = await eng.buildMasked(docId, 'genel', 'Zamanaşımına özellikle bak.');
  assert.ok(m.withTemplate!.startsWith(KORUMA));
  assert.ok(m.withTemplate!.includes(`--- METİN BAŞI ---\n${m.text}\n--- METİN SONU ---`));   // $& gibi dizeler bozulmaz
  assert.ok(m.withTemplate!.endsWith('maddeler halinde açıkla. Zamanaşımına özellikle bak.'));
  assert.ok(!m.withTemplate!.includes('Kaya'));
  assert.equal((await eng.buildMasked(docId, 'serbest')).withTemplate!.endsWith('--- METİN SONU ---'), true);
  console.log('t17 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
