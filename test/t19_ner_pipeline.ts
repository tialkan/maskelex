import assert from 'node:assert/strict';
import { MessageChannel } from 'node:worker_threads';
import { pretokenize } from '../packages/core-engine/src/ner/pretokenize';
import { makeWindows } from '../packages/core-engine/src/ner/windows';
import { mergeBio, toMatches } from '../packages/core-engine/src/ner/bio';
import { tagText, type ModelLike, type TokenizerLike } from '../packages/core-engine/src/ner/tagger';
import { createNerClient } from '../packages/core-engine/src/ner/client';
import type { FromNer, ToNer } from '../packages/core-engine/src/ner/protocol';

// Ön belirteçleme: kesme ve noktalama ayrı kelime, ofsetler doğru
const t0 = "Av. Ahmet Yılmaz'ın";
assert.deepEqual(pretokenize(t0).map((w) => t0.slice(w.start, w.end)), ['Av', '.', 'Ahmet', 'Yılmaz', "'", 'ın']);

// Pencereler: sınır, örtüşme, paragraf sonuna çekme
const w = makeWindows(Array(1200).fill(1), new Set([450]), 510, 128);
assert.equal(w[0]!.to, 451);                                  // paragraf sonuna çekildi
assert.ok(w.every((x) => x.to - x.from <= 510));
for (let i = 1; i < w.length; i++) assert.ok(w[i]!.from < w[i - 1]!.to, 'örtüşme');
assert.equal(w.at(-1)!.to, 1200);

// BIO: unvan ve noktalama atılır, kesme sonrası ek kanıt, satır sonu I-X'i böler
const words = pretokenize(t0);
const tags = [{ tag: 'B-PER', score: 0.9 }, { tag: 'I-PER', score: 0.9 }, { tag: 'I-PER', score: 0.95 }, { tag: 'I-PER', score: 0.95 }, { tag: 'I-PER', score: 0.8 }, { tag: 'I-PER', score: 0.8 }] as const;
const spans = mergeBio(t0, words, tags);
assert.equal(spans.length, 1);
assert.equal(t0.slice(spans[0]!.start, spans[0]!.end), 'Ahmet Yılmaz');
assert.equal(spans[0]!.suffix, 'ın');
const t1 = 'Ali\nVeli';
assert.equal(mergeBio(t1, pretokenize(t1), [{ tag: 'B-PER', score: 1 }, { tag: 'I-PER', score: 1 }]).length, 2);

// Eşleme: mahkeme atılır, kamu kurumu KURUM, diğer ORG ŞİRKET, LOC bulgu üretmez, güven kademesi
const t2 = 'Ankara 4. Asliye Hukuk Mahkemesi, Adalet Bakanlığı, Kaya Yapı ve İstanbul. Kaya geldi.';
const sp = (s: string, label: 'PER' | 'ORG' | 'LOC', score: number, from = 0) => ({ start: t2.indexOf(s, from), end: t2.indexOf(s, from) + s.length, label, score });
const ms = toMatches(t2, 'D-1', [sp('Ankara 4. Asliye Hukuk Mahkemesi', 'ORG', 0.99), sp('Adalet Bakanlığı', 'ORG', 0.95), sp('Kaya Yapı', 'ORG', 0.75),
  sp('İstanbul', 'LOC', 0.99), sp('Kaya', 'PER', 0.95, t2.indexOf('. Kaya'))], () => false);
assert.deepEqual(ms.map((m) => `${m.category}:${m.text}:${m.confidence}`), ['KURUM:Adalet Bakanlığı:HIGH', 'SIRKET:Kaya Yapı:MEDIUM', 'KISI:Kaya:MEDIUM']);

async function main(): Promise<void> {
// Uçtan uca hat, sahte belirteçleyici ve model ile; uzun metinde ofsetler pencereler boyunca doğru kalır
const NAMES = new Set(['Ahmet', 'Yılmaz', 'Zeynep', 'Kara']);
const vocab = new Map<string, number>();
const tok: TokenizerLike = {
  clsId: 1, sepId: 2,
  encodeWord: (w) => { const id = vocab.get(w) ?? (vocab.set(w, vocab.size + 10), vocab.get(w)!); return Array(Math.ceil(w.length / 3)).fill(id); },
};
const idWord = (): Map<number, string> => new Map([...vocab].map(([k, v]) => [v, k]));
const model: ModelLike = {
  id2label: { 0: 'O', 1: 'B-PER', 2: 'I-PER' },
  async run(ids) {
    const iw = idWord();
    let prevName = false;
    return ids.map((id, i) => {
      const word = iw.get(id);
      const first = i === 0 || ids[i - 1] !== id;
      const isName = !!word && NAMES.has(word);
      const r = !isName ? [0.98, 0.01, 0.01] : first && !prevName ? [0.02, 0.96, 0.02] : [0.02, 0.02, 0.96];
      if (first) prevName = isName;
      return r;
    });
  },
};
const filler = 'Taraflar arasındaki uyuşmazlık uzun süredir devam etmektedir ve dosya kapsamı incelenmiştir. ';
const long = `${filler.repeat(60)}Davacı Ahmet Yılmaz ile tanık Zeynep Kara dinlendi.\n${filler.repeat(60)}Zeynep Kara yeniden dinlendi.`;
let chunks = 0;
const out = await tagText(long, tok, model, () => { chunks++; });
assert.ok(chunks >= 3, `pencere sayısı ${chunks}`);
assert.deepEqual(out.map((s) => long.slice(s.start, s.end)), ['Ahmet Yılmaz', 'Zeynep Kara', 'Zeynep Kara']);

// İstemci: MessageChannel üzerinden protokol
const ch = new MessageChannel();
const fakeWorker = ch.port2;
fakeWorker.on('message', (m: ToNer) => {
  const send = (x: FromNer): void => fakeWorker.postMessage(x);
  if (m.t === 'load') { send({ t: 'status', status: { state: 'DOWNLOADING', progress: 0.5 } }); send({ t: 'status', status: { state: 'READY', progress: 1, modelId: 'sahte', backend: 'wasm' } }); }
  if (m.t === 'detect') {
    const s = m.text.indexOf('Ahmet Yılmaz');
    send({ t: 'chunk', id: m.id, done: 1, total: 1, spans: [{ start: s, end: s + 12, label: 'PER', score: 0.97 }] });
    send({ t: 'done', id: m.id });
  }
});
const port = { postMessage: (x: unknown) => ch.port1.postMessage(x), addEventListener: (_t: 'message', cb: (ev: { data: unknown }) => void) => ch.port1.on('message', (data) => cb({ data })) };
const client = createNerClient(port, () => true);
const progress: string[] = [];
const st = await client.load((s) => progress.push(s.state));
assert.equal(st.state, 'READY');
assert.deepEqual(progress, ['DOWNLOADING', 'READY']);
const found = await client.detect('Davacı Ahmet Yılmaz geldi.', 'D-9', () => {});
assert.deepEqual(found.map((m) => `${m.category}:${m.text}:${m.confidence}`), ['KISI:Ahmet Yılmaz:HIGH']);
ch.port1.close();
console.log('t19 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
