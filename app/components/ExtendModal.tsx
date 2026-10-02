import React, { useState } from 'react';
import { AlertTriangle, FastForward, Loader2, X } from 'lucide-react';
import { Song } from '../types';
import { useI18n } from '../context/I18nContext';
import { parseDuration } from '../services/nativeLibrary';

/**
 * Continuation.
 *
 * The track's saved audio codes up to the cut are fed back through the LM
 * unchanged and sampling carries on from there, so the kept part keeps its
 * melody and the new part grows out of it. The whole song is rendered again
 * with the same seed, which leaves the kept part nearly identical.
 */

interface ExtendModalProps {
  song: Song;
  onClose: () => void;
  onQueued: (jobId: string) => void;
}

const MAX_SECONDS = 360;

const CONTROL =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-black/20 dark:text-white';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export const ExtendModal: React.FC<ExtendModalProps> = ({ song, onClose, onQueued }) => {
  const { t } = useI18n();
  const length = Math.max(1, parseDuration(song.duration) ?? 1);
  const [from, setFrom] = useState<number>(length);
  const [extra, setExtra] = useState<number>(Math.min(60, MAX_SECONDS - length));
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState(`${song.title} (extended)`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const room = Math.max(0, MAX_SECONDS - from);
  const canSubmit = !busy && extra >= 5 && extra <= room;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/v1/music/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: song.id,
          from_seconds: from >= length ? undefined : from,
          extra_seconds: extra,
          lyrics: lyrics.trim() || undefined,
          title: title.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `Extend failed (${response.status})`);
      onQueued(body.id);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Extend failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
            <FastForward size={17} className="text-emerald-500" /> {t('extendTitle')}
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{song.title}</p>
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t('extendHint')}</p>

          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span className="mb-1.5 flex justify-between">
              <span>{t('extendFrom')}</span>
              <span className="tabular-nums">{clock(from)} / {clock(length)}</span>
            </span>
            <input type="range" min={1} max={length} step={1} value={from} onChange={event => setFrom(Number(event.target.value))} className="w-full accent-emerald-500" />
          </label>

          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span className="mb-1.5 flex justify-between">
              <span>{t('extendExtra')}</span>
              <span className="tabular-nums">{t('extendTotal')}: {clock(from + extra)}</span>
            </span>
            <input type="number" min={5} max={room} value={extra} onChange={event => setExtra(Number(event.target.value) || 0)} className={CONTROL} />
          </label>

          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span className="mb-1.5 block">{t('extendLyrics')}</span>
            <textarea rows={4} value={lyrics} onChange={event => setLyrics(event.target.value)} placeholder={'[bridge]\n...'} className={`${CONTROL} resize-y font-mono`} />
            <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{t('extendLyricsHint')}</span>
          </label>

          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span className="mb-1.5 block">{t('title')}</span>
            <input value={title} onChange={event => setTitle(event.target.value)} className={CONTROL} />
          </label>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle size={14} /> {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FastForward size={14} />} {t('extendStart')}
          </button>
        </div>
      </div>
    </div>
  );
};
