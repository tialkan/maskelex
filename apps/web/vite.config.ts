// apps/web/vite.config.ts
// Çok sayfalı derleme: tanıtım (/) ve uygulama (/uygulama/). Satır içi betik üretilmez (CSP script-src 'self').
// --mode desktop: Tauri ön yüzü. --mode mock: motor ana iş parçacığında MockEngine ile çalışır (F1).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@platform': mode === 'desktop' ? r('../desktop-tauri/src/platform/tauriAdapter.ts') : r('./src/platform/webAdapter.ts'),
    },
  },
  base: mode === 'desktop' ? './' : '/',
  build: {
    target: 'es2022',
    outDir: mode === 'desktop' ? 'dist-desktop' : 'dist',
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
