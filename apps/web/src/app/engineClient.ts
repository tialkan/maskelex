// apps/web/src/app/engineClient.ts
// Motor istemcisi. Varsayılan: Engine Worker (Comlink). --mode mock: MockEngine ana iş parçacığında (F1).
// NER Worker ve MessageChannel bağlantısı F2'de (AGENT-2 ner.worker.ts hazır olunca) eklenir.
import { wrap, type Remote } from 'comlink';
import type { MaskingEngineApi } from '@maskelex/core-engine/types';

export const isMock = import.meta.env.MODE === 'mock';

export async function createEngineClient(): Promise<MaskingEngineApi | Remote<MaskingEngineApi>> {
  if (isMock) {
    const { createMockEngine, SAMPLE_NER } = await import('@maskelex/core-engine/testing');
    return createMockEngine({ ner: SAMPLE_NER });
  }
  const worker = new Worker(new URL('@maskelex/core-engine/worker', import.meta.url), { type: 'module', name: 'engine-worker' });
  return wrap<MaskingEngineApi>(worker);
}
