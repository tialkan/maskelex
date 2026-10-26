// apps/web/src/app/App.tsx
// F0 iskeleti: yapıştır, analiz et, maskeli metni kopyala, yanıtı geri çöz. Tam arayüz (5.x) AGENT-4'ündür.
import { useEffect, useRef, useState } from 'react';
import type { DocumentFormat, EntityCluster, MaskedOutput, MaskingEngineApi, ReviewItem } from '@maskelex/core-engine/types';
import { LeakReview } from '../components/LeakReview';
import { platform } from '../platform';
import { proxy, type Remote } from 'comlink';
import { createEngineClient, isMock } from './engineClient';
import { tr } from '../i18n/tr';

type Engine = MaskingEngineApi | Remote<MaskingEngineApi>;

/** DEFAULT_MASKING_OPTIONS.clipboardClearSeconds ile aynı; seçenekler ekranı (A4) bağlanınca oradan okunur. */
const CLIPBOARD_CLEAR_SECONDS = 60;

const fmtOf = (name: string): DocumentFormat => {
  const n = name.toLocaleLowerCase('tr-TR');
  return n.endsWith('.udf') ? 'udf' : n.endsWith('.docx') ? 'docx' : 'txt';
};

export function App() {
  const engine = useRef<Engine | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState<MaskedOutput | null>(null);
  const [count, setCount] = useState(0);
  const [reply, setReply] = useState('');
  const [restored, setRestored] = useState('');
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clipWarn, setClipWarn] = useState(false);
  const [entities, setEntities] = useState<readonly EntityCluster[]>([]);
  const [format, setFormat] = useState<DocumentFormat>('txt');

  useEffect(() => {
    let alive = true;
    void createEngineClient().then(async (e) => {
      await e.createSession();
      if (alive) { engine.current = e; setReady(true); }
    });
    return () => { alive = false; };
  }, []);
  // Eşleşme tablosu varken pencere kapatılmak istenirse uyar.
  useEffect(() => { platform.setCloseGuard(masked !== null); }, [masked]);

  const run = async (fn: (e: Engine) => Promise<void>): Promise<void> => {
    if (!engine.current) return;
    setBusy(true); setError(false);
    try { await fn(engine.current); } catch { setError(true); } finally { setBusy(false); }
  };

  const download = async (f: { fileName: string; mime: string; bytes: Uint8Array }): Promise<void> => {
    await platform.saveFile({ name: f.fileName, mime: f.mime, bytes: f.bytes });
  };
  const openFile = (file: File): Promise<void> => run(async (e) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { docId, text } = await e.loadDocument({ kind: 'file', fileName: file.name, bytes });
    setInput(text);
    await finishAnalyze(e, docId, fmtOf(file.name));
  });
  const finishAnalyze = async (e: Engine, docId: string, f: DocumentFormat): Promise<void> => {
    setFormat(f); setCopied(false);
    // Geri çağırım worker sınırını Comlink proxy ile geçer (yapılandırılmış kopya işlev taşıyamaz).
    const r = await e.analyze(docId, proxy(() => {}));
    setEntities(r.entities);
    setCount(r.entities.filter((x) => x.status === 'MASK').length);
    setMasked(await e.buildMasked(docId));
  };
  const refresh = async (e: Engine, docId: string, r: { entities: readonly EntityCluster[] }): Promise<void> => {
    setEntities(r.entities);
    setCount(r.entities.filter((x) => x.status === 'MASK').length);
    setMasked(await e.buildMasked(docId));
  };
  const maskLeak = (f: ReviewItem, targetId: string | null): Promise<void> => run(async (e) => {
    const target = entities.find((x) => x.id === targetId);
    let r = await e.command({ type: 'ADD_MANUAL', docId: f.docId, span: f.span!, category: target?.category ?? 'OZEL', applyToAll: false });
    const added = r.mentions.find((m) => m.span.start === f.span!.start)?.entityId;
    if (target && added && added !== target.id) r = await e.command({ type: 'MERGE', sourceId: added, targetId: target.id });
    await refresh(e, f.docId, r);
  });
  const ackLeak = (f: ReviewItem): Promise<void> => run(async (e) => {
    await refresh(e, f.docId, await e.command({ type: 'ACK_LEAK', docId: f.docId, span: f.span! }));
  });
  const exportMasked = (): Promise<void> => run(async (e) => {
    if (!masked) return;
    await download(await e.exportFile({ source: 'MASKED', docId: masked.docId, format: format === 'udf' || format === 'docx' ? format : 'txt' }));
  });
  const exportRestored = (f: 'udf' | 'docx' | 'txt'): Promise<void> => run(async (e) => {
    await download(await e.exportFile({ source: 'UNMASKED', format: f, text: restored }));
  });
  const analyze = (): Promise<void> => run(async (e) => {
    const { docId } = await e.loadDocument({ kind: 'text', text: input });
    await finishAnalyze(e, docId, 'txt');
  });
  const copy = (): Promise<void> => run(async (e) => {
    if (!masked) return;
    const r = await platform.copyText(masked.text, 'MASKED');
    if (!r.ok) throw new Error('pano');
    await e.markIssued(masked.docId);
    setCopied(true);
  });
  // Çözülmüş (hassas) metin: gizli panoya yazılır, süre dolunca pano değişmediyse temizlenir (MASTER 4.8).
  const copyRestored = (): Promise<void> => run(async () => {
    if (!platform.capabilities.concealedClipboard) setClipWarn(true);
    const r = await platform.copyText(restored, 'SENSITIVE');
    if (!r.ok) throw new Error('pano');
    setTimeout(() => { void platform.clearClipboardIfUnchanged(r.fingerprint); }, CLIPBOARD_CLEAR_SECONDS * 1000);
  });
  const doUnmask = (): Promise<void> => run(async (e) => { setRestored((await e.unmask(reply)).text); });
  const wipe = (): Promise<void> => run(async (e) => {
    await e.wipe('USER'); await e.createSession();
    setInput(''); setMasked(null); setEntities([]); setCopied(false); setReply(''); setRestored(''); setCount(0);
  });

  return (
    <main className="mlx-app">
      <h1>{tr.appName}</h1>
      {isMock && <p className="mlx-banner">{tr.mockBanner}</p>}
      <label htmlFor="mlx-in">{tr.inputLabel}</label>
      <p className="mlx-muted">{tr.inputHint}</p>
      <textarea id="mlx-in" value={input} onChange={(ev) => setInput(ev.target.value)} spellCheck={false} autoComplete="off" translate="no" />
      <div className="mlx-row">
        <label className="mlx-muted">{tr.fileLabel}{' '}
          <input type="file" disabled={!ready || busy} accept=".udf,.docx,.txt,.md" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void openFile(f); ev.target.value = ''; }} />
        </label>
      </div>
      <div className="mlx-row">
        <button onClick={() => void analyze()} disabled={!ready || busy || input.trim() === ''}>{busy ? tr.analyzing : tr.analyze}</button>
        <button onClick={() => void wipe()} disabled={busy}>{tr.wipe}</button>
        {masked && <span className="mlx-muted">{tr.entities(count)}</span>}
        {error && <span className="mlx-warn">{tr.error}</span>}
      </div>
      {masked && (
        <section>
          <h2>{tr.maskedLabel}</h2>
          <pre>{masked.text}</pre>
          <LeakReview source={input} findings={masked.leakFindings} entities={entities} busy={busy} onMask={(f, t) => void maskLeak(f, t)} onAck={(f) => void ackLeak(f)} />
          <div className="mlx-row">
            <button onClick={() => void copy()} disabled={busy || masked.leakFindings.length > 0}>{copied ? tr.copied : tr.copy}</button>
            <button onClick={() => void exportMasked()} disabled={busy || masked.leakFindings.length > 0}>{tr.downloadMasked}</button>
          </div>
          <label htmlFor="mlx-reply">{tr.unmaskLabel}</label>
          <textarea id="mlx-reply" value={reply} onChange={(ev) => setReply(ev.target.value)} spellCheck={false} autoComplete="off" translate="no" />
          <div className="mlx-row">
            <button onClick={() => void doUnmask()} disabled={busy || reply.trim() === ''}>{tr.unmask}</button>
          </div>
          {restored && (<><h2>{tr.unmaskedLabel}</h2><pre>{restored}</pre>
            {clipWarn && <p className="mlx-warn">{tr.clipboardWebWarning}</p>}
            <div className="mlx-row">
              <button onClick={() => void copyRestored()} disabled={busy}>{tr.copy}</button>
              <button onClick={() => void exportRestored('udf')} disabled={busy}>{tr.downloadUdf}</button>
              <button onClick={() => void exportRestored('docx')} disabled={busy}>{tr.downloadDocx}</button>
              <button onClick={() => void exportRestored('txt')} disabled={busy}>{tr.downloadTxt}</button>
            </div></>)}
        </section>
      )}
    </main>
  );
}
