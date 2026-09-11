import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiUrl } from '../services/apiBase';
import { StemPlayer } from './StemPlayer';
import { useI18n } from '../context/I18nContext';

type SeparationRun = {
  song_id?: string;
  progress?: number;
  done?: boolean;
  error?: string | null;
  stems?: string[];
};

/** Expandable stem children under a library song row. */
export const SongStemBranch: React.FC<{ songId: string; open: boolean; onToggle: () => void }> = ({
  songId,
  open,
  onToggle,
}) => {
  const { t } = useI18n();
  const [stems, setStems] = useState<string[]>([]);
  const [run, setRun] = useState<SeparationRun | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = async () => {
      try {
        const [stemBody, sepBody] = await Promise.all([
          fetch(`/v1/library/songs/${encodeURIComponent(songId)}/stems`).then((r) => (r.ok ? r.json() : null)),
          fetch('/v1/separation/status').then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!alive) return;
        setStems(Array.isArray(stemBody?.stems) ? stemBody.stems : []);
        const current = sepBody?.run?.song_id === songId ? sepBody.run : null;
        setRun(current);
      } catch {
        if (alive) setRun(null);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open, songId]);

  const running = Boolean(run && !run.done);
  const percent = Math.round((run?.progress ?? 0) * 100);
  const hasBranch = stems.length > 0 || running || Boolean(run?.error);

  if (!hasBranch && !open) {
    return null;
  }

  return (
    <div className="ml-8 border-l border-zinc-200 pl-3 dark:border-white/10">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-brand"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {t('stemsTitle')}
        {running && <Loader2 size={12} className="animate-spin text-brand" />}
      </button>
      {open && (
        <div className="space-y-1.5 pb-2">
          {running && (
            <div className="flex items-center gap-2 rounded-lg bg-brand/10 px-2 py-1.5 text-xs text-brand">
              <Loader2 size={12} className="animate-spin" />
              {t('stemsRunning')} · {percent}%
            </div>
          )}
          {run?.error && (
            <div className="rounded-lg bg-rose-500/10 px-2 py-1.5 text-xs text-rose-600 dark:text-rose-300">{run.error}</div>
          )}
          {stems.map((stem) => (
            <StemPlayer
              key={stem}
              label={stem}
              src={apiUrl(`/v1/library/songs/${encodeURIComponent(songId)}/stems/${stem}`)}
            />
          ))}
          {!running && stems.length === 0 && !run?.error && (
            <p className="text-[11px] text-zinc-500">{t('noStemsYet')}</p>
          )}
        </div>
      )}
    </div>
  );
};

/** Tiny affordance: show a stem expand control when stems exist or a run is active. */
export function useSongStemPresence(songIds: string[]) {
  const [map, setMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const sep = await fetch('/v1/separation/status').then((r) => (r.ok ? r.json() : null));
        const runId = sep?.run?.song_id as string | undefined;
        const next: Record<string, boolean> = {};
        await Promise.all(songIds.slice(0, 40).map(async (id) => {
          if (runId === id) { next[id] = true; return; }
          const body = await fetch(`/v1/library/songs/${encodeURIComponent(id)}/stems`).then((r) => (r.ok ? r.json() : null));
          next[id] = Array.isArray(body?.stems) && body.stems.length > 0;
        }));
        if (alive) setMap(next);
      } catch {
        // ignore
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [songIds.join(',')]);
  return map;
}
