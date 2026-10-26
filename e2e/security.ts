// e2e/security.ts: güvenlik kabul testleri (MASTER 4.11). Önce: pnpm --filter @maskelex/web build
// Kapsanan: 1 dış istek sıfır, 2 çevrimdışı, 3 CSP ihlali sıfır, 5 derleme taraması, 6 Tauri yapılandırma
// anlık görüntüsü, 7 kasa silme, 8 ağ denetçisi. 4 (altın set) A5'in test-corpus'u ile, 9 elle yapılır.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { serve, HEADERS } from './server.mjs';
import { buildContentXml, zipDeterministic, readDocxSync, locateCdata } from '../packages/document-parsers/src/index';
import { unzipSync } from 'fflate';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'apps/web/dist');
const enc = new TextEncoder();
const SECRET = { ad: 'Ayşe Kaya', tc: '10000000146' };
const SOURCE = `DAVACI : ${SECRET.ad} (T.C. Kimlik No: ${SECRET.tc})\nDavacı Kaya'nın talebi yerindedir.`;

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : [p];
});

// ---- 5) Derleme taraması: dist içinde başka kökene giden adres yok ----
function scanDist(): void {
  // Kütüphanelerin içindeki ad alanı ve belge bağlantıları (istek yapılmaz) izinlidir.
  // OOXML ad alanları (schemas.openxmlformats.org, purl.org) yalnız XML tanımlayıcısıdır, istek değildir.
  const ALLOWED = [/^https:\/\/(www\.)?maskelex\.com/, /^http:\/\/www\.w3\.org\//, /^https:\/\/react\.dev\//, /^https:\/\/reactjs\.org\//,
    /^http:\/\/schemas\.openxmlformats\.org\//, /^http:\/\/purl\.org\/dc\//];
  const bad: string[] = [];
  for (const f of files(DIST)) {
    if (!/\.(html|js|css|json|webmanifest)$/.test(f)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
      if (!ALLOWED.some((a) => a.test(m[0]))) bad.push(`${f.slice(DIST.length)}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, [], 'dist içinde izinsiz köken');
}

// ---- 6) Tauri yapılandırması MASTER 4.3 ile birebir ----
function tauriSnapshot(): void {
  const master = readFileSync(join(ROOT, 'MASTER.md'), 'utf8');
  const sec = master.slice(master.indexOf('### 4.3'), master.indexOf('### 4.4'));
  const json = (start: string): unknown => {
    const s = sec.indexOf(start), body = sec.slice(s, sec.indexOf('```', s));
    return JSON.parse(body.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'));
  };
  const spec = json('```json\n// apps/desktop-tauri/src-tauri/tauri.conf.json'.slice(8)) as { app: { security: unknown; withGlobalTauri: boolean } };
  const conf = JSON.parse(readFileSync(join(ROOT, 'apps/desktop-tauri/src-tauri/tauri.conf.json'), 'utf8'));
  assert.deepEqual(conf.app.security, spec.app.security, 'tauri.conf.json güvenlik bölümü');
  assert.equal(conf.app.withGlobalTauri, false);
  const capSpec = json('// apps/desktop-tauri/src-tauri/capabilities/default.json') as Record<string, unknown>;
  const cap = JSON.parse(readFileSync(join(ROOT, 'apps/desktop-tauri/src-tauri/capabilities/default.json'), 'utf8'));
  delete cap.$schema;
  assert.deepEqual(cap, capSpec, 'capabilities/default.json');
}

async function waitReady(p: Page): Promise<void> {
  await p.waitForSelector('input[type=file]:not([disabled])', { timeout: 15000 });
}

async function main(): Promise<void> {
  scanDist();
  tauriSnapshot();
  const srv = await serve(DIST);
  const origin = srv.url;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const p = await ctx.newPage();

  const requests: string[] = [];
  const cspErrors: string[] = [];
  ctx.on('request', (r) => requests.push(r.url()));
  p.on('console', (m) => { if (/Content Security Policy|Trusted Type|TrustedHTML|TrustedScript/i.test(m.text())) cspErrors.push(m.text()); });
  p.on('pageerror', (e) => cspErrors.push(`pageerror: ${e.message}`));
  await p.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => { console.error(`Content Security Policy ihlali: ${e.violatedDirective} ${e.blockedURI}`); });
  });

  // Başlıklar sunulan yanıtta mı
  const resp = await p.goto(`${origin}/uygulama/`);
  assert.equal(resp!.headers()['content-security-policy'], HEADERS['Content-Security-Policy']);
  assert.ok(await p.evaluate(() => crossOriginIsolated), 'COOP+COEP etkin değil');
  await waitReady(p);

  // ---- Tam akış: metin, maskele, kopyala, geri çöz, UDF ve DOCX ----
  await p.fill('#mlx-in', SOURCE);
  await p.getByRole('button', { name: 'Analiz et' }).click();
  await p.waitForSelector('pre');
  const masked = await p.locator('pre').first().textContent();
  assert.ok(masked && !masked.includes('Kaya') && !masked.includes(SECRET.tc), 'maskeli metinde kişisel veri');
  await p.getByRole('button', { name: 'Kopyala', exact: true }).click();
  await p.getByRole('button', { name: 'Kopyalandı' }).waitFor();
  // Pano okuma Permissions-Policy (clipboard-read=()) ile kapalı olmalı: sayfa panoyu okuyamaz.
  assert.equal(await p.evaluate(async () => { try { await navigator.clipboard.readText(); return 'okundu'; } catch (e) { return (e as Error).name; } }), 'NotAllowedError');
  await p.fill('#mlx-reply', "[DAVACI_1]'e tebliğ edilmiştir.");
  await p.getByRole('button', { name: 'Geri çöz' }).click();
  await p.waitForSelector('text=Çözülmüş metin');
  assert.ok((await p.locator('pre').nth(1).textContent())!.includes("Ayşe Kaya'ya tebliğ edilmiştir."));
  const dl = async (name: string): Promise<Uint8Array> => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name, exact: true }).click()]);
    return new Uint8Array(readFileSync((await d.path())!));
  };
  const udfOut = await dl('UDF olarak indir');
  assert.ok(locateCdata(new TextDecoder().decode(unzipSync(udfOut)['content.xml'])).text.includes('Ayşe Kaya'));
  const docxOut = await dl('Word olarak indir');
  assert.ok(readDocxSync(docxOut).text.includes('Ayşe Kaya'));

  // UDF yükle ve maskeli UDF indir
  const udf = zipDeterministic([['content.xml', enc.encode(buildContentXml(SOURCE))]]);
  await p.getByRole('button', { name: 'Oturumu sil' }).click();
  await waitReady(p);
  await p.setInputFiles('input[type=file]', { name: 'dilekce.udf', mimeType: 'application/octet-stream', buffer: Buffer.from(udf) });
  await p.waitForSelector('pre');
  const mUdf = await dl('Maskeli dosyayı indir');
  const mText = locateCdata(new TextDecoder().decode(unzipSync(mUdf)['content.xml'])).text;
  assert.ok(!mText.includes('Kaya') && !mText.includes(SECRET.tc), 'maskeli UDF');

  // ---- 8) Ağ Denetçisi: dış istek denemesi SecurityError ----
  const err = await p.evaluate(async () => { try { await fetch('https://example.com/'); return 'izin verildi'; } catch (e) { return (e as Error).name; } });
  assert.equal(err, 'SecurityError');

  // ---- 1) Dış istek sıfır ----
  const ext = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:'));
  assert.deepEqual(ext, [], 'uygulama kökeni dışına istek');

  // ---- 7) Kasa silme: sonra geri çözme boş, alanlar temiz ----
  await p.getByRole('button', { name: 'Oturumu sil' }).click();
  await waitReady(p);
  assert.equal(await p.inputValue('#mlx-in'), '');
  assert.equal(await p.locator('pre').count(), 0);

  // ---- 2) Çevrimdışı: ilk yüklemeden sonra ağ kesik, akış çalışır ----
  await ctx.setOffline(true);
  await p.fill('#mlx-in', SOURCE);
  await p.getByRole('button', { name: 'Analiz et' }).click();
  await p.waitForSelector('pre');
  assert.ok(!(await p.locator('pre').first().textContent())!.includes(SECRET.tc));
  await ctx.setOffline(false);

  // ---- 3) CSP ve Trusted Types ihlali sıfır ----
  assert.deepEqual(cspErrors, [], 'CSP / Trusted Types ihlali');

  await browser.close();
  srv.close();
  console.log('e2e güvenlik OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
