// scripts/build-name-lexicon.mjs
// Ad ve soyadı sözlüklerini @faker-js/faker (MIT) Türkçe yerel verisinden üretir. Elle ad EKLENMEZ.
// Çalıştırma: node scripts/build-name-lexicon.mjs  (çıktı commit'lenir; sürüm package.json'da sabittir)
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const version = req('@faker-js/faker/package.json').version;
const mod = await import('@faker-js/faker/locale/tr');
const tr = Object.values(mod).find((v) => v && v.rawDefinitions);
const p = tr.rawDefinitions.person;
const out = new URL('../packages/core-engine/src/names/data/', import.meta.url);

// En az 3 harf: "Ak", "Ay" gibi kısa adlar sıradan sözcüklerle çakışır.
const ok = (n) => typeof n === 'string' && [...n].length >= 3 && /^\p{Lu}\p{Ll}+$/u.test(n);
const gender = new Map();
const put = (n, g) => { if (!ok(n)) return; const prev = gender.get(n); gender.set(n, prev && prev !== g ? 'U' : g); };
for (const n of p.first_name.male) put(n, 'E');
for (const n of p.first_name.female) put(n, 'K');
for (const n of p.first_name.generic) if (!gender.has(n)) put(n, 'U');
const given = Object.fromEntries([...gender].sort(([a], [b]) => a.localeCompare(b, 'tr')));
const surnames = [...new Set(p.last_name.generic.filter(ok))].sort((a, b) => a.localeCompare(b, 'tr'));

const meta = { source: '@faker-js/faker locale tr (person.first_name, person.last_name)', version, license: 'MIT' };
writeFileSync(new URL('given-names.json', out), JSON.stringify({ meta, names: given }, null, 0) + '\n');
writeFileSync(new URL('surnames.json', out), JSON.stringify({ meta, names: surnames }, null, 0) + '\n');
// İkiz sözlüğü (MASTER 3.4.5/9): yalnız cinsiyeti belli adlar ve soyadları. Ortak sözcük olan adlar dışlanır;
// liste MASTER'daki örneklerdir, sıradan sözcük sözlüğü bağlanınca genişletilir.
const COMMON_WORDS = new Set(['Deniz', 'Umut', 'Barış', 'Bahar']);
const twin = [
  ...Object.entries(given).filter(([n, g]) => g !== 'U' && !COMMON_WORDS.has(n)).map(([text, gender]) => ({ text, kind: 'AD', gender })),
  ...surnames.map((text) => ({ text, kind: 'SOYAD', gender: 'U' })),
];
writeFileSync(new URL('twin-lexicon.json', out), JSON.stringify({ meta, entries: twin }, null, 0) + '\n');
console.log(`ikiz: ${twin.length}`);
console.log(`ad: ${Object.keys(given).length}, soyadı: ${surnames.length}, kaynak sürümü ${version}`);
