// Uzun tire (U+2014) ve kısa tire (U+2013) denetimi.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const skip = new Set(['node_modules', '.git', 'dist', 'target']);
const bad = [];
const walk = (d) => { for (const f of readdirSync(d)) { if (skip.has(f)) continue; const p = join(d, f);
  if (statSync(p).isDirectory()) walk(p); else if (/\.(md|ts|tsx|html|json|css)$/.test(f)) {
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/[–—]/.test(l)) bad.push(`${p}:${i + 1}`); }); } } };
walk('.');
if (bad.length) { console.error('Uzun/kısa tire bulundu:\n' + bad.join('\n')); process.exit(1); }
console.log('check:copy temiz');
