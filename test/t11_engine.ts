import assert from 'node:assert/strict';
import { createMockEngine, SAMPLE_PETITION, SAMPLE_NER } from '../packages/core-engine/src/testing/index';
import { leakAudit } from '../packages/core-engine/src/pipeline/leakAudit';
import type { AnalysisResult, MaskingSessionVault, EntityCluster } from '../packages/core-engine/src/types/contracts';
import { profileOf } from '../packages/core-engine/src/morphology/morphology';

async function main(): Promise<void> {
  // 1) Uçtan uca: analiz → maskele → kilitle → geri çöz
  const eng = createMockEngine({ ner: SAMPLE_NER });
  await assert.rejects(eng.analyze('D-001', () => {}), (e: { code: string }) => e.code === 'E_NO_SESSION');
  await eng.createSession();
  const { docId } = await eng.loadDocument({ kind: 'text', text: SAMPLE_PETITION });
  const phases: AnalysisResult['phase'][] = [];
  const r = await eng.analyze(docId, (u) => phases.push(u.phase));
  assert.deepEqual(phases[0], 'DETERMINISTIC');
  assert.equal(phases.at(-1), 'COMPLETE');
  const tok = (canon: string): string => r.entities.find((e) => e.canonical === canon)!.token;
  assert.equal(tok('Ahmet Yılmaz'), '[DAVACI_1]');
  assert.equal(tok('Mehmet Demir'), '[VEKİL_1]');
  assert.equal(tok('XYZ İnşaat Ltd. Şti.'), '[ŞİRKET_A]');
  assert.ok(r.entities.some((e) => e.category === 'IBAN' && e.status === 'MASK'));
  // İçtihat künyesi korunur
  assert.ok(r.protectedSpans.some((p) => SAMPLE_PETITION.slice(p.span.start, p.span.end).includes('2022/4110')));

  const masked = await eng.buildMasked(docId);
  console.log(masked.text);
  assert.ok(!masked.text.includes('Yılmaz'));
  assert.ok(!masked.text.includes('10000000146'));
  assert.ok(masked.text.includes("[DAVACI_1]'in alacağı"));     // ek etiketin okunuşuna göre yeniden çekildi
  assert.ok(masked.text.includes('2022/4110'));                 // emsal korunur
  assert.deepEqual(masked.leakFindings, []);

  await eng.markIssued(docId);
  // Kilitliyken rol değişirse yeni etiket verilir, eski etiket takma ad olarak çözülmeye devam eder
  const ahmet = r.entities.find((e) => e.canonical === 'Ahmet Yılmaz')!;
  const r2 = await eng.command({ type: 'SET_ROLE', entityId: ahmet.id, role: 'MUVEKKIL' });
  assert.equal(r2.entities.find((e) => e.id === ahmet.id)!.token, '[MÜVEKKİL_1]');
  const un = await eng.unmask("[DAVACI_1]'e ve [MÜVEKKİL_1]'e [VEKİL_1] aracılığıyla bildirildi. [ŞİRKET_A]'ya ihtar.");
  assert.equal(un.text, "Ahmet Yılmaz'a ve Ahmet Yılmaz'a Mehmet Demir aracılığıyla bildirildi. XYZ İnşaat Ltd. Şti.'ne ihtar.");

  // 2) KEEP yapılan varlık maskelenmez; elle ekleme tüm geçişlere uygulanır
  const r3 = await eng.command({ type: 'ADD_MANUAL', docId, span: { start: SAMPLE_PETITION.indexOf('ANKARA'), end: SAMPLE_PETITION.indexOf('ANKARA') + 6 }, category: 'ADRES', applyToAll: true });
  assert.ok(r3.entities.some((e) => e.category === 'ADRES' && e.status === 'MASK'));
  const m2 = await eng.buildMasked(docId);
  assert.ok(m2.text.startsWith('[ADRES_1] 4. ASLİYE'));

  // 3) Kasa dışa/içe aktarımı: yeni oturumda belge olmadan geri çözme çalışır
  const bytes = await eng.exportVault('uzun-ve-guclu-parola');
  assert.ok(!new TextDecoder().decode(bytes).includes('Yılmaz'));
  const eng2 = createMockEngine();
  await eng2.importVault(bytes, 'uzun-ve-guclu-parola');
  assert.equal((await eng2.unmask('[DAVACI_1] haklıdır.')).text, 'Ahmet Yılmaz haklıdır.');

  // 4) Oturum süresi dolunca kasa silinir
  let clock = 0;
  const eng3 = createMockEngine({ now: () => clock });
  await eng3.createSession({ sessionTimeoutMinutes: 1 });
  clock = 61_000;
  await assert.rejects(eng3.loadDocument({ kind: 'text', text: 'x' }), (e: { code: string }) => e.code === 'E_VAULT_EXPIRED');
  await assert.rejects(eng3.loadDocument({ kind: 'text', text: 'x' }), (e: { code: string }) => e.code === 'E_NO_SESSION');

  // 5) Sızıntı denetimi: etiket dışında kalan yüzey, ad parçası ve sağlamalı numara yakalanır
  const ent: EntityCluster = {
    id: 'E-0001', category: 'KISI', role: 'DAVACI', roleSource: 'CUE', token: '[DAVACI_1]', issuedTokens: [], canonical: 'Ayşe Kaya',
    surfaces: ['Ayşe Kaya', 'AYŞE KAYA'], mentionIds: [], status: 'MASK', confidence: 'HIGH', phon: profileOf('Ayşe Kaya'),
    observedSuffixes: [], nameParts: { given: ['Ayşe'], surnames: ['Kaya'] },
  };
  const vault = { entities: new Map([[ent.id, ent]]) } as unknown as MaskingSessionVault;
  const text = '[DAVACI_1] ile AYŞE KAYA görüştü. Kaya Hanım ve kaya gibi sağlam. TCKN 10000000146.';
  const f = leakAudit({ docId: 'D-001', masked: text, vault, tokenSpans: [{ start: 0, end: 10 }], currentYear: 2026 });
  const got = f.map((x) => text.slice(x.span!.start, x.span!.end));
  assert.deepEqual(got, ['AYŞE KAYA', 'Kaya', '10000000146']);
  console.log('t11 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
