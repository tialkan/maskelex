// packages/core-engine/src/ner/modelConfig.ts (MASTER 3.3.1, D-04)
// İlk aday. Kesin seçim ve SHA-256 değerleri ADR-0003 ölçümüyle yazılır; değerler BOŞKEN model yüklenmez
// (doğrulanmamış dosya çalıştırılmaz). scripts/fetch-model.mjs dosyaları indirir, özetleri hesaplar ve buraya yazar.
export const MODEL = {
  id: 'akdeniz27/bert-base-turkish-cased-ner',
  revision: null as string | null,
  files: ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'] as const,
  sha256: {} as Readonly<Record<string, string>>,
  /** Web yolu: /models/<id>@<sha8>/ (MASTER 4.9) */
  get pathSegment(): string { const s = this.sha256['onnx/model_quantized.onnx']; return s ? `${this.id}@${s.slice(0, 8)}` : this.id; },
};
export const isPinned = (): boolean => MODEL.files.every((f) => typeof MODEL.sha256[f] === 'string' && MODEL.sha256[f]!.length === 64);
