// packages/core-engine/src/worker/engine.worker.ts
// Engine Worker girişi: MaskingEngineApi'yi Comlink ile ana iş parçacığına açar.
// Kasa yalnız bu worker'ın belleğinde yaşar (MASTER 1.3). Ağ denetçisi kurulumu (4.5) AGENT-4 tarafından
// bu dosyanın ilk satırına eklenir; NerPort istemcisi (A2) F2'de ports.ner olarak bağlanır.

import { expose } from 'comlink';
import { createEngine } from '../pipeline/engine';
import type { RandomSource } from '../types/contracts';

/** Kriptografik kaynak. Math.random YASAK (R-04). */
const cryptoRandom: RandomSource = {
  nextUint32: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
  nextFloat: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296,
};

expose(createEngine({ rng: cryptoRandom, now: () => Date.now() }));
