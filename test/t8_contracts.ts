import assert from 'node:assert/strict';
import { tokenKey as tk1, alphaIndex, makeToken, DEFAULT_MASKING_OPTIONS, CATEGORY_SPECS, ENTITY_CATEGORIES, ROLE_TOKEN_LABELS } from '../packages/core-engine/src/types/contracts';
import { tokenKey as tk2 } from '../packages/core-engine/src/types/contracts';
for (const s of ['[Davacı_1]', '\\[DAVACI\\_1\\]', '[ŞIRKET_A]', '[ŞİRKET_A]', 'DAVACI 1', '[MÜŞTEKİ_2]', '[DOĞUM_TARİHİ_1]', '[YEVMİYE_3]', '[İŞÇİ_1]'])
  assert.equal(tk1(s), tk2(s), s);
assert.equal(alphaIndex(1), 'A'); assert.equal(alphaIndex(26), 'Z'); assert.equal(alphaIndex(27), 'AA'); assert.equal(alphaIndex(52), 'AZ'); assert.equal(alphaIndex(53), 'BA');
assert.equal(makeToken('ŞİRKET', 2, 'ALPHA'), '[ŞİRKET_B]');
assert.equal(makeToken(ROLE_TOKEN_LABELS.BELIRSIZ, 1, 'NUMERIC'), '[KİŞİ_1]');
assert.equal(DEFAULT_MASKING_OPTIONS.maskedCategories.KURUM, false);
assert.equal(DEFAULT_MASKING_OPTIONS.maskedCategories.TCKN, true);
assert.equal(Object.keys(CATEGORY_SPECS).length, ENTITY_CATEGORIES.length);
// Tüm etiket gövdeleri birbirinden farklı anahtara katlanmalı (çakışma = geri çözmede karışıklık)
const keys = new Map<string, string>();
for (const c of ENTITY_CATEGORIES) { const k = tk1(`[${CATEGORY_SPECS[c].tokenLabel}_1]`); assert.ok(!keys.has(k), `çakışma ${k}`); keys.set(k, c); }
for (const [r, l] of Object.entries(ROLE_TOKEN_LABELS)) { if (r === 'BELIRSIZ') continue; const k = tk1(`[${l}_1]`); assert.ok(!keys.has(k), `rol/kategori çakışması ${k}`); keys.set(k, r); }
console.log('etiket anahtarları benzersiz:', keys.size);
console.log('t8 OK');
