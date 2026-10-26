// apps/web/src/components/LeakReview.tsx
// Sızıntı bulgularının incelenmesi (MASTER 3.0.4): her bulgu için "Maskele" (bir varlığa bağla ya da yeni
// gizli bilgi olarak işaretle) veya "Sorun değil" (ACK_LEAK). Metin yalnız metin düğümü olarak işlenir (R-05).
import { useState } from 'react';
import type { EntityCluster, ReviewItem } from '@maskelex/core-engine/types';
import { tr } from '../i18n/tr';

const NEW = '__yeni__';

export interface LeakReviewProps {
  readonly source: string;
  readonly findings: readonly ReviewItem[];
  readonly entities: readonly EntityCluster[];
  readonly busy: boolean;
  readonly onMask: (f: ReviewItem, targetId: string | null) => void;
  readonly onAck: (f: ReviewItem) => void;
}

function Finding({ f, source, entities, busy, onMask, onAck }: Omit<LeakReviewProps, 'findings'> & { f: ReviewItem }) {
  const masked = entities.filter((e) => e.status === 'MASK');
  const [target, setTarget] = useState<string>(f.entityId && masked.some((e) => e.id === f.entityId) ? f.entityId : NEW);
  const s = f.span!;
  const before = source.slice(Math.max(0, s.start - 40), s.start);
  const hit = source.slice(s.start, s.end);
  const after = source.slice(s.end, s.end + 40);
  return (
    <li className="mlx-leak">
      <p className="mlx-snippet">…{before}<mark>{hit}</mark>{after}…</p>
      <div className="mlx-row">
        <label>{tr.leakTarget}{' '}
          <select value={target} onChange={(ev) => setTarget(ev.target.value)} disabled={busy}>
            {masked.map((e) => <option key={e.id} value={e.id}>{e.token}</option>)}
            <option value={NEW}>{tr.leakNew}</option>
          </select>
        </label>
        <button onClick={() => onMask(f, target === NEW ? null : target)} disabled={busy}>{tr.leakMask}</button>
        <button className="mlx-secondary" onClick={() => onAck(f)} disabled={busy}>{tr.leakAck}</button>
      </div>
    </li>
  );
}

export function LeakReview(props: LeakReviewProps) {
  if (!props.findings.length) return null;
  return (
    <section aria-live="polite">
      <p className="mlx-warn">{tr.leakBlocked}</p>
      <ul className="mlx-leaks">
        {props.findings.filter((f) => f.span).map((f) => (
          <Finding key={`${f.span!.start}-${f.span!.end}`} f={f} source={props.source} entities={props.entities}
            busy={props.busy} onMask={props.onMask} onAck={props.onAck} />
        ))}
      </ul>
    </section>
  );
}
