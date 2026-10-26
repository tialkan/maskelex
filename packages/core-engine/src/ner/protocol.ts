// packages/core-engine/src/ner/protocol.ts (MASTER 3.3.2): Engine Worker ile NER Worker arasındaki iletiler.
import type { NerStatus } from '../types/contracts';
import type { NerLabel } from './bio';

export type ToNer =
  | { t: 'load' }
  | { t: 'detect'; id: number; docId: string; text: string }
  | { t: 'abort'; id: number }
  | { t: 'dispose' };
export type FromNer =
  | { t: 'status'; status: NerStatus }
  | { t: 'chunk'; id: number; done: number; total: number; spans: Array<{ start: number; end: number; label: NerLabel; score: number }> }
  | { t: 'done'; id: number }
  | { t: 'error'; id: number; code: 'E_NER_UNAVAILABLE' };

/** postMessage/onmessage taşıyan en küçük arayüz (MessagePort, Worker, test sahtesi). */
export interface PortLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', cb: (ev: { data: unknown }) => void): void;
  start?(): void;
}
