import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';

type Status = {
  engine_id: string; ready: boolean; installing: boolean; resolution: number; steps: number; precision: string;
  assets: Array<{ id: string; label: string; installed: boolean; bytes: number }>;
  download?: { downloaded_bytes: number; total_bytes: number; done: boolean; error?: string };
  run: { phase: string; elapsed_seconds: number; error?: string };
};

export function LocalCoverSettings() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const response = await fetch('/v1/covers/local/status');
        if (!response.ok) throw new Error(`Local cover status: ${response.status}`);
        const body = await response.json();
        if (!cancelled) setStatus(body);
      } catch (e) { if (!cancelled) setError(String(e)); }
    };
    void read();
    const timer = window.setInterval(() => void read(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  const action = async (kind: 'install' | 'cancel' | 'select') => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = kind === 'select'
        ? await fetch('/v1/configuration', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selections: [{ capability: 'cover_art', mode: 'local', local_engine: status?.engine_id, cloud_model: null }] }) })
        : await fetch(`/v1/covers/local/${kind}`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `Local cover: ${response.status}`);
      if (kind === 'select') { setNotice(t('localCoverSelected')); window.dispatchEvent(new Event('mm3:settings-changed')); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const generating = ['waiting_for_music', 'loading_and_generating'].includes(status?.run.phase || '');
  const progress = status?.download;
  return <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-white/10">
    <h3 className="font-semibold">{t('localCoverTitle')}</h3>
    <p className="text-xs text-zinc-500">{t('localCoverHint')}</p>
    {status && <>
      <p className="text-xs">{status.resolution} × {status.resolution} · {status.steps} {t('ditSteps')} · {status.precision}</p>
      <ul className="space-y-1 text-xs text-zinc-500">{status.assets.map(asset => <li key={asset.id}>{asset.installed ? '✓' : '○'} {asset.label} · {asset.bytes ? `${(asset.bytes / 1e9).toFixed(2)} GB` : '…'}</li>)}</ul>
      <div className="flex flex-wrap gap-2">
        {!status.ready && <button type="button" disabled={busy || status.installing} onClick={() => void action('install')} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{status.installing ? t('downloading') : t('localCoverInstall')}</button>}
        {status.ready && <button type="button" disabled={busy} onClick={() => void action('select')} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-black">{t('localCoverUse')}</button>}
        {(status.installing || generating) && <button type="button" disabled={busy} onClick={() => void action('cancel')} className="rounded-lg border px-3 py-2 text-xs">{t('cancel')}</button>}
      </div>
      {status.installing && progress && <div className="text-xs">
        <progress className="w-full" value={progress.downloaded_bytes} max={progress.total_bytes || 1} />
        {(progress.downloaded_bytes / 1e9).toFixed(2)} / {(progress.total_bytes / 1e9).toFixed(2)} GB
      </div>}
      {status.run.phase && <p className="text-xs text-zinc-500">{t(`localCoverPhase_${status.run.phase}`)} · {status.run.elapsed_seconds.toFixed(1)} s</p>}
    </>}
    {(error || status?.run.error || progress?.error) && <p role="alert" className="text-xs text-red-500">{error || status?.run.error || progress?.error}</p>}
    {notice && <p className="text-xs text-emerald-600">{notice}</p>}
  </section>;
}
