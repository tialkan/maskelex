// apps/web/src/security/inputHardening.ts
// Metin girilen ve gösterilen her alana uygulanır: yazım denetimi, çeviri ve yaygın yazım eklentileri kapalı.
export const SENSITIVE_FIELD_ATTRS = {
  spellCheck: false, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', translate: 'no',
  'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false',
  'data-lt-active': 'false', 'data-ms-editor': 'false',
} as const;
