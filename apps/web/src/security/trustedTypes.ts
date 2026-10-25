// apps/web/src/security/trustedTypes.ts
// Varsayılan Trusted Types politikası (Chromium). main.tsx'in İLK işi olarak çağrılır.
interface TrustedTypePolicyFactoryLike { createPolicy(name: string, rules: Record<string, (s: string) => string>): unknown }

export function installTrustedTypes(): void {
  const tt = (globalThis as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;
  if (!tt) return;   // Chromium dışı: CSP yönergesi yok sayılır; R-05 ESLint kuralı yine geçerli
  tt.createPolicy('default', {
    createHTML: () => { throw new TypeError('HTML enjeksiyonu yasak'); },
    createScript: () => { throw new TypeError('Dinamik betik yasak'); },
    createScriptURL: (url: string) => {
      const u = new URL(url, location.href);
      const sameOrigin = u.origin === location.origin || (u.protocol === 'blob:' && url.startsWith(`blob:${location.origin}/`));
      if (!sameOrigin) throw new TypeError('Yalnız aynı kökenden betik');
      return u.href;
    },
  });
}
