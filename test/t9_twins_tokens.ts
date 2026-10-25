import assert from 'node:assert/strict';
import { makeTwinPicker, phonKey, type TwinLexiconEntry } from '../packages/core-engine/src/twins/twins';
import { allocateTokens, buildMaskEdits } from '../packages/core-engine/src/pipeline/maskText';
import { unmask } from '../packages/core-engine/src/unmask/rehydrate';
import { profileOf } from '../packages/core-engine/src/morphology/morphology';
import { applyEditsToText } from '../packages/document-parsers/src/ast/remap';
import type { RandomSource } from '../packages/core-engine/src/types/contracts';

// Örnek (gerçek liste lisanslı kaynaktan AGENT-2 tarafından derlenir)
const LEX: TwinLexiconEntry[] = [
  ...['Kaan', 'Hakan', 'Okan', 'Burak', 'Tarık', 'Mehmet', 'Ahmet', 'Ferit', 'Fikret', 'Emre', 'Can', 'Selim'].map((t) => ({ text: t, kind: 'AD' as const, gender: 'E' as const })),
  ...['Seda', 'Ayla', 'Derya', 'Esra', 'Elif', 'Gamze', 'Neşe', 'Melike', 'Beste'].map((t) => ({ text: t, kind: 'AD' as const, gender: 'K' as const })),
  ...['Korkmaz', 'Arslan', 'Tuna', 'Kara', 'Çelik', 'Kurt', 'Bulut', 'Erdem', 'Keskin', 'Duman', 'Sezer', 'Toprak', 'Eren'].map((t) => ({ text: t, kind: 'SOYAD' as const, gender: 'U' as const })),
];
let seed = 7;
const rng: RandomSource = { nextUint32: () => (seed = (seed * 1103515245 + 12345) >>> 0), nextFloat: () => Math.random() };
const picker = makeTwinPicker(LEX, rng, ['Ahmet Yılmaz', 'Ayşe Yılmaz', 'Mehmet Demir']);

const ahmet = picker.person({ id: 'E-1', given: 'Ahmet', surname: 'Yılmaz', gender: 'E' })!;
const ayse = picker.person({ id: 'E-2', given: 'Ayşe', surname: 'Yılmaz', gender: 'K' })!;
const mehmet = picker.person({ id: 'E-3', given: 'Mehmet', surname: 'Demir', gender: 'E' })!;
console.log(ahmet.full, '|', ayse.full, '|', mehmet.full);
assert.equal(ahmet.surname, ayse.surname);                        // aile soyadı tutarlı
assert.notEqual(mehmet.surname, ahmet.surname);
assert.equal(phonKey(ahmet.given), phonKey('Ahmet'));
assert.equal(phonKey(ahmet.surname), phonKey('Yılmaz'));
assert.equal(phonKey(ayse.given), phonKey('Ayşe'));
assert.ok(!['Mehmet', 'Ahmet'].includes(mehmet.given) && !['Mehmet', 'Ahmet'].includes(ahmet.given));   // belgedeki gerçek ad ikiz olamaz
assert.equal(phonKey(mehmet.given), phonKey('Mehmet'));
assert.equal(picker.familySurname('YILMAZ'), ahmet.surname);
// Uygun anahtar yoksa ikiz verilmez (etiket moduna düşülür)
assert.equal(picker.person({ id: 'E-4', given: 'Gönül', surname: 'Öztürk', gender: 'K' }), null);

// Etiket atama: ilk görünüş sırası, rol gövdesi, şirketler harfli
const counters: Record<string, number> = {};
const t1 = allocateTokens([
  { entityId: 'A', category: 'KISI', role: 'DAVALI', firstSeen: 50 },
  { entityId: 'B', category: 'KISI', role: 'DAVACI', firstSeen: 10 },
  { entityId: 'C', category: 'KISI', role: 'DAVACI', firstSeen: 30 },
  { entityId: 'D', category: 'SIRKET', role: 'BELIRSIZ', firstSeen: 5 },
  { entityId: 'E', category: 'SIRKET', role: 'BELIRSIZ', firstSeen: 70 },
  { entityId: 'F', category: 'KISI', role: 'BELIRSIZ', firstSeen: 90 },
  { entityId: 'G', category: 'TCKN', role: 'BELIRSIZ', firstSeen: 12 },
], counters, false);
assert.deepEqual(Object.fromEntries(t1), { D: '[ŞİRKET_A]', B: '[DAVACI_1]', G: '[TCKN_1]', C: '[DAVACI_2]', A: '[DAVALI_1]', E: '[ŞİRKET_B]', F: '[KİŞİ_1]' });
// Kilitli kasada F'nin rolü TANIK olursa yeni etiket verilir; diğerleri değişmez
const t2 = allocateTokens([
  { entityId: 'B', category: 'KISI', role: 'DAVACI', firstSeen: 10, currentToken: '[DAVACI_1]' },
  { entityId: 'F', category: 'KISI', role: 'TANIK', firstSeen: 90, currentToken: '[KİŞİ_1]' },
], counters, true);
assert.equal(t2.get('B'), '[DAVACI_1]');
assert.equal(t2.get('F'), '[TANIK_1]');

// Maskeli metinde ek normalleştirme ve tam tur
const text = "Davacı Ahmet Yılmaz'ın vekili, davalı Ayşe Kaya'ya ihtar çekmiş; Kaya'nın cevabı gelmemiştir.";
const s = (needle: string, from = 0): { start: number; end: number } => { const i = text.indexOf(needle, from); return { start: i, end: i + needle.length }; };
const ay = s('Ahmet Yılmaz'), ak = s('Ayşe Kaya'), k2 = s("Kaya'nın");
const masked = applyEditsToText(text, buildMaskEdits([
  { span: ay, replacement: '[DAVACI_1]', kind: 'TOKEN', suffix: { span: { start: ay.end + 1, end: ay.end + 3 }, text: 'ın' } },
  { span: ak, replacement: '[DAVALI_1]', kind: 'TOKEN', suffix: { span: { start: ak.end + 1, end: ak.end + 3 }, text: 'ya' } },
  { span: { start: k2.start, end: k2.start + 4 }, replacement: '[DAVALI_1]', kind: 'TOKEN', suffix: { span: { start: k2.start + 5, end: k2.start + 8 }, text: 'nın' } },
], true));
assert.equal(masked, "Davacı [DAVACI_1]'in vekili, davalı [DAVALI_1]'e ihtar çekmiş; [DAVALI_1]'in cevabı gelmemiştir.");
const back = unmask(masked, { groups: [], entities: [
  { id: 'E-1', tokens: ['[DAVACI_1]'], canonical: 'Ahmet Yılmaz', phon: profileOf('Ahmet Yılmaz') },
  { id: 'E-2', tokens: ['[DAVALI_1]'], canonical: 'Ayşe Kaya', phon: profileOf('Ayşe Kaya') },
] });
assert.equal(back.text, "Davacı Ahmet Yılmaz'ın vekili, davalı Ayşe Kaya'ya ihtar çekmiş; Ayşe Kaya'nın cevabı gelmemiştir.");
console.log('t9 OK');
