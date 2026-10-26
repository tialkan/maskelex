// apps/desktop-tauri/src/platform/tauriAdapter.ts
// PlatformAdapter (masaüstü). Yalnız uygulamanın üç komutu çağrılır (MASTER 4.3); dosya yolu JS'e dönmez.
import { invoke } from '@tauri-apps/api/core';
import type { PlatformAdapter, Sensitivity } from '@maskelex/core-engine/types';

let guard: ((e: BeforeUnloadEvent) => void) | null = null;

export const platform: PlatformAdapter = {
  kind: 'desktop',
  capabilities: { concealedClipboard: true, osNetworkSandbox: navigator.userAgent.includes('Mac') },
  async copyText(text: string, s: Sensitivity) {
    try {
      const sira = await invoke<number>('pano_yaz', { metin: text, hassas: s === 'SENSITIVE' });
      return { ok: true, fingerprint: String(sira) };
    } catch {
      // Gizli pano bu işletim sisteminde yoksa (Linux) standart panoya düşülür.
      try { await navigator.clipboard.writeText(text); return { ok: true, fingerprint: '' }; } catch { return { ok: false, fingerprint: '' }; }
    }
  },
  async clearClipboardIfUnchanged(fp: string) {
    if (!fp) return false;
    try { return await invoke<boolean>('pano_temizle', { sira: Number(fp) }); } catch { return false; }
  },
  async saveFile(file) {
    try { return { ok: await invoke<boolean>('kaydet', { dosyaAdi: file.name, veri: Array.from(file.bytes) }) }; } catch { return { ok: false }; }
  },
  setCloseGuard(enabled: boolean) {
    if (guard) { window.removeEventListener('beforeunload', guard); guard = null; }
    if (enabled) { guard = (e) => { e.preventDefault(); }; window.addEventListener('beforeunload', guard); }
  },
  async hardReset() { location.reload(); },
};
