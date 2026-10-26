// apps/web/src/worker/engine.worker.ts
// Engine Worker girişi: MaskingEngineApi'yi Comlink ile ana iş parçacığına açar.
// Uygulama katmanında durur: çekirdek motor ile belge codec'lerini birleştirir (paketler arası döngü olmaz).
// Kasa yalnız bu worker'ın belleğinde yaşar (MASTER 1.3). Ağ denetçisi kurulumu (4.5) AGENT-4 tarafından
// bu dosyanın ilk satırına eklenir; NerPort istemcisi (A2) F2'de ports.ner olarak bağlanır.

// İlk iş: ağ denetçisi (MASTER 4.5). ES modül içe aktarımları önce değerlendirilir; içe aktarılan modüller
// yükleme sırasında ağ kullanmaz, motor ise ancak expose sonrası çalışır. Olaylar ana iş parçacığına { mlxNet } iletisiyle gider; Comlink bunları yok sayar.
import { installNetworkGuard } from '../security/networkMonitor';
installNetworkGuard('engine-worker', (e) => { (globalThis as unknown as Worker).postMessage({ mlxNet: e }); });

import { expose } from 'comlink';
import { createEngine } from '@maskelex/core-engine';
import { CODECS } from '@maskelex/document-parsers';
import type { RandomSource } from '@maskelex/core-engine/types';

/** Kriptografik kaynak. Math.random YASAK (R-04). */
const cryptoRandom: RandomSource = {
  nextUint32: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
  nextFloat: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296,
};

expose(createEngine({ rng: cryptoRandom, now: () => Date.now(), codecs: CODECS }));
