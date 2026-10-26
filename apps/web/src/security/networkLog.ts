// apps/web/src/security/networkLog.ts
// Ana iş parçacığı ve worker'lardan gelen ağ olaylarının tek listesi. Ağ Denetçisi rozeti (A4) buradan okur.
import type { NetworkEvent } from '@maskelex/core-engine/types';

export const networkEvents: NetworkEvent[] = [];
export const externalAttempts = (): number => networkEvents.filter((e) => !e.sameOrigin).length;
