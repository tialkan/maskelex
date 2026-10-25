// apps/web/src/main.tsx
// Sıra önemlidir: önce Trusted Types (4.4), sonra ağ denetçisi (4.5), en son uygulama.
import { installTrustedTypes } from './security/trustedTypes';
import { installNetworkGuard } from './security/networkMonitor';
import type { NetworkEvent } from '@maskelex/core-engine/types';

installTrustedTypes();
const networkEvents: NetworkEvent[] = [];
installNetworkGuard('main', (e) => { networkEvents.push(e); });

const [{ createRoot }, { StrictMode, createElement }, { App }] = await Promise.all([
  import('react-dom/client'), import('react'), import('./app/App'),
]);
await import('./styles/app.css');
createRoot(document.getElementById('root')!).render(createElement(StrictMode, null, createElement(App)));
