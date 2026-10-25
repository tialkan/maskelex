// packages/core-engine/src/testing/index.ts
// Test ve arayüz geliştirme yardımcıları: tohumlu RandomSource, sözlüklü sahte NER, MockEngine.
// AGENT-4 F1'de arayüzü MockEngine ile geliştirir; F2'de aynı API gerçek motora bağlanır.
// Üretim kodu bu modülü İÇE AKTARMAZ.

import { createEngine } from '../pipeline/engine';
import { foldKey, isAlnum, leftBoundary, lowerView, rightBoundary, trLower } from '../text/turkish';
import type {
  DocumentId, EntityCategory, EntityMatch, LegalRole, MaskingEngineApi, NerPort, NerStatus, RandomSource,
} from '../types/contracts';

/** Tohumlu, deterministik kaynak (mulberry32). YALNIZ test içindir; kriptografik değildir. */
export function seededRandom(seed = 42): RandomSource {
  let a = seed >>> 0;
  const nextUint32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return { nextUint32, nextFloat: () => nextUint32() / 4294967296 };
}

export interface FakeNerEntry {
  readonly text: string;
  readonly category: Extract<EntityCategory, 'KISI' | 'SIRKET' | 'KURUM' | 'ADRES'>;
  readonly role?: LegalRole;
}

/** Sözlükteki yüzeyleri büyük/küçük harf duyarsız, sözcük sınırlı bulan sahte NER. Model indirmez. */
export function createFakeNer(entries: readonly FakeNerEntry[], ready = true): NerPort {
  let status: NerStatus = ready ? { state: 'READY', progress: 1, modelId: 'fake-ner', backend: 'wasm' } : { state: 'NOT_LOADED', progress: 0 };
  return {
    status: () => status,
    async load(onProgress) { status = { state: 'READY', progress: 1, modelId: 'fake-ner', backend: 'wasm' }; onProgress(status); return status; },
    async detect(text: string, docId: DocumentId, onChunk) {
      const view = lowerView(text);
      const out: EntityMatch[] = [];
      let n = 0;
      for (const e of entries) {
        const needle = trLower(e.text);
        for (let i = view.indexOf(needle); i >= 0; i = view.indexOf(needle, i + 1)) {
          const end = i + needle.length;
          if (!leftBoundary(view, i, isAlnum) || !rightBoundary(view, end, isAlnum)) continue;
          out.push({
            id: `NER-${++n}`, docId, span: { start: i, end }, text: text.slice(i, end), category: e.category, layer: 'L3_NER',
            confidence: 'HIGH', score: 0.9, ruleId: `L3.NER.FAKE`, normalized: foldKey(e.text), flags: [],
            ...(e.role ? { roleHint: e.role } : {}),
          });
        }
      }
      out.sort((a, b) => a.span.start - b.span.start);
      onChunk({ docId, done: 1, total: 1, matches: out });
      return out;
    },
    async dispose() { status = { state: 'NOT_LOADED', progress: 0 }; },
  };
}

export interface MockEngineOptions {
  readonly seed?: number;
  readonly ner?: readonly FakeNerEntry[];
  /** Sabit saat (ms). Verilmezse 2026-01-01 başlar, her çağrıda 1 ms ilerler. */
  readonly now?: () => number;
}

/** Başvuru modülleri + sahte NER ile çalışan MaskingEngineApi. */
export function createMockEngine(opts: MockEngineOptions = {}): MaskingEngineApi {
  let t = Date.UTC(2026, 0, 1);
  return createEngine({
    rng: seededRandom(opts.seed ?? 42),
    now: opts.now ?? (() => ++t),
    ...(opts.ner ? { ner: createFakeNer(opts.ner) } : {}),
  });
}

/** Arayüz geliştirme için örnek sentetik dilekçe (gerçek kişi verisi YOK; numaralar sağlaması geçerli test değerleri). */
export const SAMPLE_PETITION = `ANKARA 4. ASLİYE TİCARET MAHKEMESİ'NE
DOSYA NO : 2024/892 E.
DAVACI : Ahmet Yılmaz (T.C. Kimlik No: 10000000146)
VEKİLİ : Av. Mehmet Demir, Tel: 0532 123 45 67, e-posta mehmet.demir@ornekhukuk.av.tr
DAVALI : XYZ İnşaat Ltd. Şti.
IBAN: TR33 0006 1005 1978 6457 8413 26
AÇIKLAMALAR: Ahmet Yılmaz'ın alacağı ödenmemiştir. Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı kararında da belirtildiği üzere.`;

export const SAMPLE_NER: readonly FakeNerEntry[] = [
  { text: 'Ahmet Yılmaz', category: 'KISI', role: 'DAVACI' },
  { text: 'Mehmet Demir', category: 'KISI', role: 'VEKIL' },
  { text: 'XYZ İnşaat Ltd. Şti.', category: 'SIRKET' },
];
