// scripts/fetch-model.mjs (MASTER 3.3.2, 4.9)
// YALNIZ geliştirici makinesinde ve CI'da çalışır; uygulama çalışma zamanında model indirmez.
//   node scripts/fetch-model.mjs --pin   İlk kez: indirir, SHA-256 hesaplar, modelConfig.ts ve docs/sources/ner-model.md'ye yazar.
//   node scripts/fetch-model.mjs         Sonra: indirir ve sabitlenmiş özetlerle karşılaştırır; uyuşmazlıkta derlemeyi durdurur.
// Dosyalar apps/web/public/models/<id>@<sha8>/ altına konur (git'e girmez, .gitignore).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONFIG = join(ROOT, 'packages/core-engine/src/ner/modelConfig.ts');
const src = readFileSync(CONFIG, 'utf8');
const id = /id: '([^']+)'/.exec(src)[1];
const revisionMatch = /revision: '([0-9a-f]{40})'/.exec(src);
const files = [...src.matchAll(/files: \[([^\]]+)\]/g)][0][1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
const pinned = Object.fromEntries([...src.matchAll(/'([^']+)': '([0-9a-f]{64})'/g)].map((m) => [m[1], m[2]]));
const pin = process.argv.includes('--pin');
const rev = revisionMatch?.[1] ?? 'main';
if (!pin && !revisionMatch) { console.error('modelConfig.revision boş: önce --pin ile sabitleyin.'); process.exit(1); }

let commit = rev;
if (pin) {
  const info = await (await fetch(`https://huggingface.co/api/models/${id}`)).json();
  commit = info.sha;
  console.log(`Model: ${id}  commit: ${commit}  lisans etiketi: ${(info.cardData?.license ?? info.tags?.find((t) => t.startsWith('license:')) ?? 'YOK')}`);
}
const got = {};
const bufs = {};
for (const f of files) {
  const res = await fetch(`https://huggingface.co/${id}/resolve/${commit}/${f}`);
  if (!res.ok) { console.error(`${f}: HTTP ${res.status}`); process.exit(1); }
  const b = Buffer.from(await res.arrayBuffer());
  bufs[f] = b;
  got[f] = createHash('sha256').update(b).digest('hex');
  console.log(`${f}  ${(b.length / 1e6).toFixed(1)} MB  ${got[f]}`);
}
if (!pin) {
  const bad = files.filter((f) => pinned[f] !== got[f]);
  if (bad.length) { console.error(`SHA-256 uyuşmazlığı: ${bad.join(', ')}`); process.exit(1); }
}
const sha8 = got['onnx/model_quantized.onnx'].slice(0, 8);
const outDir = join(ROOT, 'apps/web/public/models', `${id}@${sha8}`);
for (const f of files) { mkdirSync(dirname(join(outDir, f)), { recursive: true }); writeFileSync(join(outDir, f), bufs[f]); }
if (pin) {
  const shaBlock = `{\n${files.map((f) => `    '${f}': '${got[f]}',`).join('\n')}\n  } as Readonly<Record<string, string>>`;
  writeFileSync(CONFIG, src.replace(/revision: [^,]+,/, `revision: '${commit}' as string | null,`).replace(/sha256: \{[^}]*\} as Readonly<Record<string, string>>/, `sha256: ${shaBlock}`));
  mkdirSync(join(ROOT, 'docs/sources'), { recursive: true });
  writeFileSync(join(ROOT, 'docs/sources/ner-model.md'), `# NER modeli (sabitlenmiş)\n\n- Model: \`${id}\`\n- Commit: \`${commit}\`\n- Kaynak: https://huggingface.co/${id}/tree/${commit}\n\n| Dosya | SHA-256 |\n|---|---|\n${files.map((f) => `| \`${f}\` | \`${got[f]}\` |`).join('\n')}\n\nLisans (V-04) ve başarım ölçümü ADR-0003'te.\n`);
  console.log('modelConfig.ts ve docs/sources/ner-model.md güncellendi.');
}
console.log(`Yerleştirildi: ${outDir}`);
