// packages/core-engine/src/ner/client.ts (MASTER 3.3.2)
// Engine Worker içindeki NerPort istemcisi. NER Worker kasa görmez: yalnız metin gider, etiketli aralık gelir.
import type { DocumentId, EntityMatch, NerChunkEvent, NerPort, NerStatus } from '../types/contracts';
import { toMatches, type NerSpan } from './bio';
import type { FromNer, PortLike, ToNer } from './protocol';

export function createNerClient(port: PortLike, isKnownName: (w: string) => boolean): NerPort {
  let status: NerStatus = { state: 'NOT_LOADED', progress: 0 };
  let seq = 0;
  const statusSubs = new Set<(s: NerStatus) => void>();
  const pending = new Map<number, { text: string; docId: DocumentId; spans: NerSpan[]; onChunk: (e: NerChunkEvent) => void;
    resolve: (m: readonly EntityMatch[]) => void; reject: (e: unknown) => void }>();
  const send = (m: ToNer): void => port.postMessage(m);

  port.addEventListener('message', (ev) => {
    const m = ev.data as FromNer;
    if (m.t === 'status') { status = m.status; for (const cb of statusSubs) cb(status); return; }
    const p = pending.get(m.id);
    if (!p) return;
    if (m.t === 'chunk') {
      p.spans.push(...m.spans);
      p.onChunk({ docId: p.docId, done: m.done, total: m.total, matches: toMatches(p.text, p.docId, m.spans, isKnownName) });
    } else if (m.t === 'done') {
      pending.delete(m.id);
      p.resolve(toMatches(p.text, p.docId, p.spans, isKnownName));
    } else {
      pending.delete(m.id);
      p.reject({ code: m.code, message: 'Ad tanıma modeli kullanılamıyor.' });
    }
  });
  port.start?.();

  return {
    status: () => status,
    load(onProgress) {
      if (status.state === 'READY' || status.state === 'FAILED' || status.state === 'DISABLED') return Promise.resolve(status);
      return new Promise((resolve) => {
        const cb = (s: NerStatus): void => {
          onProgress(s);
          if (s.state === 'READY' || s.state === 'FAILED') { statusSubs.delete(cb); resolve(s); }
        };
        statusSubs.add(cb);
        send({ t: 'load' });
      });
    },
    detect(text, docId, onChunk, signal) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { text, docId, spans: [], onChunk, resolve, reject });
        signal?.addEventListener('abort', () => { send({ t: 'abort', id }); pending.delete(id); reject({ code: 'E_NER_UNAVAILABLE', message: 'İptal edildi.' }); });
        send({ t: 'detect', id, docId, text });
      });
    },
    async dispose() { send({ t: 'dispose' }); status = { state: 'NOT_LOADED', progress: 0 }; },
  };
}
