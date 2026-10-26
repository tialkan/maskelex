// MASTER.md 1.8 kurallarının ESLint karşılığı (çekirdek). AGENT-5 genişletir.
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-desktop/**', 'apps/desktop-tauri/src-tauri/gen/**', '**/node_modules/**', 'apps/desktop-tauri/src-tauri/target/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': 'error',                                                     // R-01
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'R-04: RandomSource kullanın.' },
        { property: 'innerHTML', message: 'R-05' }, { property: 'outerHTML', message: 'R-05' },
        { property: 'insertAdjacentHTML', message: 'R-05' }],
      'no-restricted-globals': ['error', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'RTCPeerConnection'], // R-06
      'no-restricted-syntax': ['error',
        { selector: 'Literal[regex.pattern=/\\(\\?<[=!]/]', message: 'R-02: lookbehind yasak.' }],
      'no-implied-eval': 'error', 'no-new-func': 'error', 'no-eval': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['packages/core-engine/src/ner/**', 'apps/web/src/sw/**', 'apps/web/src/security/networkMonitor.ts'], rules: { 'no-restricted-globals': 'off' } },
  { files: ['test/**', 'scripts/**'], rules: { 'no-console': 'off', 'no-restricted-properties': 'off' } },
);
