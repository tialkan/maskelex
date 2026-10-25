// apps/web/src/security/networkMonitor.ts
// Canlı Ağ Denetçisi: ana iş parçacığında ve her worker'ın ilk satırında kurulur.
// Aynı köken dışındaki her isteği ENGELLER ve bildirir; aynı köken isteklerini yalnız yol olarak kaydeder.
import type { NetworkEvent, NetworkKind, NetworkRealm } from '@maskelex/core-engine/types';

type AnyGlobal = Record<string, any>;

export function installNetworkGuard(realm: NetworkRealm, report: (e: NetworkEvent) => void): void {
  const g = globalThis as unknown as AnyGlobal;
  const origin: string = g.location.origin;
  const same = (u: string): boolean => { try { return new URL(u, g.location.href).origin === origin; } catch { return false; } };
  const shown = (u: string): string => (same(u) ? new URL(u, g.location.href).pathname : u);
  const guard = (kind: NetworkKind, url: string): void => {
    const ok = same(url);
    report({ at: Date.now(), realm, kind, url: shown(url), sameOrigin: ok, blocked: !ok });
    if (!ok) throw new DOMException('Dış bağlantı engellendi', 'SecurityError');
  };

  const origFetch = (g.fetch as typeof fetch).bind(g);
  g.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    guard('fetch', typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return origFetch(input, init);
  };
  if (g.XMLHttpRequest) {
    const open = g.XMLHttpRequest.prototype.open as (...a: unknown[]) => void;
    g.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      guard('xhr', String(url));
      return open.call(this, method, url, ...rest);
    };
  }
  for (const [name, kind] of [['WebSocket', 'websocket'], ['EventSource', 'eventsource']] as const) {
    if (g[name]) g[name] = new Proxy(g[name], { construct(t, args) { guard(kind, String(args[0])); return Reflect.construct(t, args); } });
  }
  if (g.navigator?.sendBeacon) g.navigator.sendBeacon = (u: string): boolean => { guard('beacon', u); return false; };
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {   // WebRTC, CSP connect-src kapsamında değildir
    if (g[name]) g[name] = function () {
      report({ at: Date.now(), realm, kind: 'webrtc', url: 'webrtc:', sameOrigin: false, blocked: true });
      throw new DOMException('WebRTC devre dışı', 'SecurityError');
    };
  }
  if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[])
        report({ at: Date.now(), realm, kind: 'resource', url: shown(e.name), sameOrigin: same(e.name), blocked: false, bytes: e.transferSize });
    }).observe({ type: 'resource', buffered: true });
  }
  g.addEventListener?.('securitypolicyviolation', (ev: SecurityPolicyViolationEvent) =>
    report({ at: Date.now(), realm, kind: 'csp-violation', url: ev.blockedURI, sameOrigin: false, blocked: true }));
}
