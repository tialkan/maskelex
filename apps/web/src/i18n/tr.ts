// apps/web/src/i18n/tr.ts
// Tüm arayüz metinleri. Kısa, resmi, uzun çizgi yok (scripts/check-copy.mjs denetler).
export const tr = {
  appName: 'MaskeLex',
  inputLabel: 'Belge metni',
  inputHint: 'Metni yapıştırın. Metin bu cihazdan çıkmaz.',
  analyze: 'Analiz et',
  analyzing: 'Analiz ediliyor',
  maskedLabel: 'Maskeli metin',
  copy: 'Kopyala',
  copied: 'Kopyalandı',
  leakBlocked: 'Maskelenmemiş bilgi kaldı. Kopyalamadan önce aşağıdaki bulguları inceleyin.',
  unmaskLabel: 'Yapay zekâ yanıtı',
  unmask: 'Geri çöz',
  unmaskedLabel: 'Çözülmüş metin',
  wipe: 'Oturumu sil',
  entities: (n: number): string => `${n} bulgu`,
  mockBanner: 'Geliştirme derlemesi: örnek motor çalışıyor.',
  error: 'İşlem tamamlanamadı.',
  fileLabel: 'ya da dosya seçin (.udf, .txt, .md)',
  downloadMasked: 'Maskeli dosyayı indir',
  downloadUdf: 'UDF olarak indir',
  downloadTxt: 'Metin olarak indir',
} as const;
