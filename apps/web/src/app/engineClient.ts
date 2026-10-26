// apps/web/src/app/engineClient.ts
// Motor istemcisi. Varsayılan: Engine Worker (Comlink). --mode mock: MockEngine ana iş parçacığında (F1).
// NER Worker ve MessageChannel bağlantısı F2'de (AGENT-2 ner.worker.ts hazır olunca) eklenir.
import { wrap, type Remote } from 'comlink';
import type { MaskingEngineApi } from '@maskelex/core-engine/types';

export const isMock = import.meta.env.MODE === 'mock';

export async function createEngineClient(): Promise<MaskingEngineApi | Remote<MaskingEngineApi>> {
  if (isMock) {
    const [{ createMockEngine, SAMPLE_NER }, { CODECS }] = await Promise.all([import('@maskelex/core-engine/testing'), import('@maskelex/document-parsers')]);
    return createMockEngine({ ner: SAMPLE_NER, codecs: CODECS });
  }
  const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module', name: 'engine-worker' });
  return wrap<MaskingEngineApi>(worker);
}
