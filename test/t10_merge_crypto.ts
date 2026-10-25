import assert from 'node:assert/strict';
import { merge } from '../packages/core-engine/src/pipeline/merge';
import { encryptVault, decryptVault } from '../packages/core-engine/src/vault/crypto';
import type { EntityMatch, ProtectedSpan } from '../packages/core-engine/src/types/contracts';

// Birleştirme: korunan aralık > katman > güven > uzunluk
const m = (id: string, start: number, end: number, layer: EntityMatch['layer'], confidence: EntityMatch['confidence'] = 'HIGH'): EntityMatch =>
  ({ id, docId: 'D-01', span: { start, end }, text: 'x', category: 'KISI', layer, confidence, score: 0.9, ruleId: 'test', flags: [] });
const prot: ProtectedSpan[] = [{ docId: 'D-01', span: { start: 100, end: 110 }, reason: 'ICTIHAT_KUNYESI', ruleId: 'L2.ICTIHAT', ownCaseSuspect: false }];
const out = merge([
  m('ner-uzun', 0, 20, 'L3_NER'), m('kural', 5, 12, 'L3_RULE'), m('tckn', 30, 41, 'L1_CHECKSUM'), m('ner-tckn', 28, 45, 'L3_NER'),
  m('korunan', 102, 108, 'L2_LEGAL'), m('elle', 101, 109, 'MANUAL'), m('d2', 0, 20, 'L3_NER'),
], prot);
assert.deepEqual(out.map((x) => x.id), ['kural', 'tckn', 'elle']);
// Aynı katmanda yüksek güven, sonra uzun aralık kazanır
assert.deepEqual(merge([m('a', 0, 5, 'L3_NER', 'MEDIUM'), m('b', 2, 4, 'L3_NER', 'HIGH')], []).map((x) => x.id), ['b']);
assert.deepEqual(merge([m('a', 0, 5, 'L3_NER'), m('b', 2, 4, 'L3_NER')], []).map((x) => x.id), ['a']);

// Kasa şifreleme: tam tur, yanlış parola, değiştirilmiş dosya, düşük tur sayısı
async function main(): Promise<void> {
const plain = new TextEncoder().encode(JSON.stringify({ entities: [['E-0001', { canonical: 'Ahmet Yılmaz' }]] }));
const copy = plain.slice();
const file = await encryptVault(plain, 'uzun-ve-guclu-parola');
assert.ok(plain.every((b) => b === 0));                                   // girdi sıfırlandı
assert.ok(!JSON.stringify(file).includes('Yılmaz'));
assert.deepEqual(await decryptVault(file, 'uzun-ve-guclu-parola'), copy);
await assert.rejects(decryptVault(file, 'yanlis-parola-123'), (e: { code: string }) => e.code === 'E_CRYPTO');
const tampered = { ...file, ciphertext: file.ciphertext.slice(0, -4) + (file.ciphertext.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
await assert.rejects(decryptVault(tampered, 'uzun-ve-guclu-parola'), (e: { code: string }) => e.code === 'E_CRYPTO');
await assert.rejects(decryptVault({ ...file, iterations: 1000 }, 'uzun-ve-guclu-parola'), (e: { code: string }) => e.code === 'E_CRYPTO');
await assert.rejects(encryptVault(new Uint8Array(4), 'kisa'), (e: { code: string }) => e.code === 'E_CRYPTO');
console.log('t10 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
