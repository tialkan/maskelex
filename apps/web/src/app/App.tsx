// apps/web/src/app/App.tsx
// F0 iskeleti: yapıştır, analiz et, maskeli metni kopyala, yanıtı geri çöz. Tam arayüz (5.x) AGENT-4'ündür.
import { useEffect, useRef, useState } from 'react';
import type { MaskedOutput, MaskingEngineApi } from '@maskelex/core-engine/types';
import { proxy, type Remote } from 'comlink';
import { createEngineClient, isMock } from './engineClient';
import { tr } from '../i18n/tr';

type Engine = MaskingEngineApi | Remote<MaskingEngineApi>;

export function App() {
  const engine = useRef<Engine | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState<MaskedOutput | null>(null);
  const [count, setCount] = useState(0);
  const [reply, setReply] = useState('');
  const [restored, setRestored] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    void createEngineClient().then(async (e) => {
      await e.createSession();
      if (alive) engine.current = e;
    });
    return () => { alive = false; };
  }, []);

  const run = async (fn: (e: Engine) => Promise<void>): Promise<void> => {
    if (!engine.current) return;
    setBusy(true); setError(false);
    try { await fn(engine.current); } catch { setError(true); } finally { setBusy(false); }
  };

  const analyze = (): Promise<void> => run(async (e) => {
    const { docId } = await e.loadDocument({ kind: 'text', text: input });
    // Geri çağırım worker sınırını Comlink proxy ile geçer (yapılandırılmış kopya işlev taşıyamaz).
    const r = await e.analyze(docId, proxy(() => {}));
    setCount(r.entities.filter((x) => x.status === 'MASK').length);
    setMasked(await e.buildMasked(docId));
  });
  const copy = (): Promise<void> => run(async (e) => {
    if (!masked) return;
    await navigator.clipboard.writeText(masked.text);
    await e.markIssued(masked.docId);
  });
  const doUnmask = (): Promise<void> => run(async (e) => { setRestored((await e.unmask(reply)).text); });
  const wipe = (): Promise<void> => run(async (e) => {
    await e.wipe('USER'); await e.createSession();
    setInput(''); setMasked(null); setReply(''); setRestored(''); setCount(0);
  });

  return (
    <main className="mlx-app">
      <h1>{tr.appName}</h1>
      {isMock && <p className="mlx-banner">{tr.mockBanner}</p>}
      <label htmlFor="mlx-in">{tr.inputLabel}</label>
      <p className="mlx-muted">{tr.inputHint}</p>
      <textarea id="mlx-in" value={input} onChange={(ev) => setInput(ev.target.value)} spellCheck={false} autoComplete="off" translate="no" />
      <div className="mlx-row">
        <button onClick={() => void analyze()} disabled={busy || input.trim() === ''}>{busy ? tr.analyzing : tr.analyze}</button>
        <button onClick={() => void wipe()} disabled={busy}>{tr.wipe}</button>
        {masked && <span className="mlx-muted">{tr.entities(count)}</span>}
        {error && <span className="mlx-warn">{tr.error}</span>}
      </div>
      {masked && (
        <section>
          <h2>{tr.maskedLabel}</h2>
          <pre>{masked.text}</pre>
          {masked.leakFindings.length > 0 && <p className="mlx-warn">{tr.leakBlocked}</p>}
          <div className="mlx-row">
            <button onClick={() => void copy()} disabled={busy || masked.leakFindings.length > 0}>{tr.copy}</button>
          </div>
          <label htmlFor="mlx-reply">{tr.unmaskLabel}</label>
          <textarea id="mlx-reply" value={reply} onChange={(ev) => setReply(ev.target.value)} spellCheck={false} autoComplete="off" translate="no" />
          <div className="mlx-row">
            <button onClick={() => void doUnmask()} disabled={busy || reply.trim() === ''}>{tr.unmask}</button>
          </div>
          {restored && (<><h2>{tr.unmaskedLabel}</h2><pre>{restored}</pre></>)}
        </section>
      )}
    </main>
  );
}
