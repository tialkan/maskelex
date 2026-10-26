// apps/web/src/platform/webAdapter.ts
// PlatformAdapter (web). Pano, dosya ve pencere yan etkileri yalnız buradan yapılır (R-08).
import type { PlatformAdapter, Sensitivity } from '@maskelex/core-engine/types';

/** Panodaki metnin parmak izi (metnin kendisi saklanmaz). */
async function fingerprint(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let guard: ((e: BeforeUnloadEvent) => void) | null = null;

export const platform: PlatformAdapter = {
  kind: 'web',
  capabilities: { concealedClipboard: false, osNetworkSandbox: false },
  async copyText(text: string, _s: Sensitivity) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, fingerprint: await fingerprint(text) };
    } catch { return { ok: false, fingerprint: '' }; }
  },
  // ADR-0002: Permissions-Policy pano okumayı kapatır (clipboard-read=()); "pano değişmediyse" koşulu web'de
  // denetlenemez. Kullanıcının sonradan kopyaladığı içeriği silmemek için web'de temizleme yapılmaz; arayüz uyarır.
  async clearClipboardIfUnchanged(_fp: string) { return false; },
  async saveFile(file) {
    const url = URL.createObjectURL(new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.mime }));
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  },
  setCloseGuard(enabled: boolean) {
    if (guard) { window.removeEventListener('beforeunload', guard); guard = null; }
    if (enabled) { guard = (e) => { e.preventDefault(); }; window.addEventListener('beforeunload', guard); }
  },
  async hardReset() { location.reload(); },
};
