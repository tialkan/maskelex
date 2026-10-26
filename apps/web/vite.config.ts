// apps/web/vite.config.ts
// Çok sayfalı derleme: tanıtım (/) ve uygulama (/uygulama/). Satır içi betik üretilmez (CSP script-src 'self').
// --mode desktop: Tauri ön yüzü. --mode mock: motor ana iş parçacığında MockEngine ile çalışır (F1).
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// GitHub Pages yanıt başlığı ayarlatmaz: CSP aynı politikadan <meta> ile verilir. frame-ancestors ve
// upgrade-insecure-requests meta ile verilemediği için çıkarılır; COOP/COEP yoktur (NER tek iş parçacığı).
function metaCsp(): Plugin {
  const conf = readFileSync(r('./deploy/security-headers.conf'), 'utf8');
  const csp = /Content-Security-Policy "([^"]+)"/.exec(conf)![1]!.split(';').map((d) => d.trim())
    .filter((d) => d && !d.startsWith('frame-ancestors') && !d.startsWith('upgrade-insecure-requests')).join('; ');
  return {
    name: 'maskelex-meta-csp',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'pages' ? [react(), metaCsp()] : [react()],
  resolve: {
    alias: {
      '@platform': mode === 'desktop' ? r('../desktop-tauri/src/platform/tauriAdapter.ts') : r('./src/platform/webAdapter.ts'),
    },
  },
  base: mode === 'desktop' ? './' : mode === 'pages' ? '/maskelex/' : '/',
  build: {
    target: 'es2022',
    outDir: mode === 'desktop' ? 'dist-desktop' : mode === 'pages' ? 'dist-pages' : 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: { input: { tanitim: r('./index.html'), uygulama: r('./uygulama/index.html') } },
  },
  worker: { format: 'es' },
  server: {
    fs: { allow: [r('../..')] }, headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
}));
