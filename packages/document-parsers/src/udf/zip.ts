// packages/document-parsers/src/udf/zip.ts
// ZIP okuma/yazma ve girdi politikası (MASTER 3.5.4, 3.5.6). Zip bombası koruması: sıkıştırılmamış toplam
// en çok 50 MB, en çok 64 girdi. Yazımda zaman damgaları sabittir: aynı girdi aynı baytları verir.
import { unzipSync, zipSync, type Unzipped, type Zippable, type ZipOptions } from 'fflate';

export const ZIP_LIMITS = { maxTotalBytes: 50 * 1024 * 1024, maxEntries: 64 } as const;
export class ZipPolicyError extends Error {}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function unzipLimited(bytes: Uint8Array): Unzipped {
  let entries = 0, total = 0;
  const out = unzipSync(bytes, {
    filter: (f) => {
      entries++;
      total += f.originalSize;
      if (entries > ZIP_LIMITS.maxEntries) throw new ZipPolicyError('Arşivde çok fazla girdi var.');
      if (total > ZIP_LIMITS.maxTotalBytes) throw new ZipPolicyError('Arşiv açıldığında izin verilen boyutu aşıyor.');
      return true;
    },
  });
  let real = 0;
  for (const v of Object.values(out)) real += v.length;
  if (real > ZIP_LIMITS.maxTotalBytes) throw new ZipPolicyError('Arşiv açıldığında izin verilen boyutu aşıyor.');
  return out;
}

const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);
export function zipDeterministic(entries: ReadonlyArray<readonly [string, Uint8Array]>): Uint8Array {
  const input: Zippable = {};
  for (const [name, data] of entries) input[name] = [data, { mtime: FIXED_MTIME, level: 6 } satisfies ZipOptions];
  return zipSync(input, { mtime: FIXED_MTIME });
}
