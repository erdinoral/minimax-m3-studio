import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { karaokeReason } from '../services/karaoke';
import { AlertTriangle, ChevronDown, CircleAlert, Dices, FileAudio, FolderOpen, Loader2, RotateCcw, Save, Sparkles, Square, Trash2, Upload, Wand2, Settings2 } from 'lucide-react';
import type { Music3Request, Song } from '../types';
import { useI18n } from '../context/I18nContext';
import { joinCaption, randomExample, splitCaption } from '../services/examples';
import { loadNativeOpenRouterCatalog, modelsForCapability, transcribeWithNativeOpenRouter } from '../services/nativeOpenRouter';
import { appendStylesToCaption, expandStylesForCaption, orderedStyleChips, recordStylesTextChips, styleTextHasChip, toggleStyleInText } from '../services/styleChips';

/** mm-server rejects empty lyrics; instrumental = section tags, no sung words. */
function instrumentalLyricsScaffold(durationSeconds: number): string {
  const seconds = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 60;
  if (seconds <= 30) return '[intro]\n\n[instrumental]\n\n[outro]';
  if (seconds <= 90) return '[intro]\n\n[instrumental]\n\n[instrumental]\n\n[outro]';
  return '[intro]\n\n[instrumental]\n\n[instrumental]\n\n[instrumental]\n\n[outro]';
}

/**
 * The Music3 request form.
 *
 * The layout follows what every implementation of this model agrees on — the
 * reference client shipped with the engine, ComfyUI's native nodes and MiniMax's
 * own model card:
 *
 *   * the request is grouped by pipeline stage: prompt, LM configuration, flow
 *     matching, post-processing, components;
 *   * a field left empty means "use the engine default", which is shown as the
 *     placeholder, so the submitted request stays sparse;
 *   * the caption is a structured document — Global Metadata, Vocal Details,
 *     Arrangement — not a one-line prompt, and the lyrics carry bracketed
 *     section tags;
 *   * duration is a *maximum*: the model may end the song earlier.
 *
 * Writing that caption from a one-line idea is a text-LLM job, which this model
 * cannot do — its own language model emits audio codes. The Director tab is the
 * primary drafting path when an assistant is configured; Studio remains the
 * hand-edited path that needs no text model.
 */

interface CreatePanelProps {
  onGenerate: (request: Music3Request & { _tempId?: string }) => void;
  isGenerating: boolean;
  activeJobCount?: number;
  initialData?: { song: Song; timestamp: number } | null;
  /** Taste hints from liked/disliked library tracks for the writing assistant. */
  preferenceInstruction?: string;
  waitForJobsToDrain?: (signal?: AbortSignal) => Promise<void>;
  enqueueCreatePipeline?: (task: () => Promise<void>) => Promise<void>;
  createTempSongForClick?: (descriptionPreview: string) => string;
  updateTempSongForClick?: (tempId: string, patch: Partial<Song>) => void;
  removeTempSongForClick?: (tempId: string) => void;
  incrementPendingClicks?: (n?: number) => void;
  decrementPendingClicks?: (n?: number) => void;
  registerPreflightAbort?: (tempId: string, ac: AbortController) => void;
  unregisterPreflightAbort?: (tempId: string) => void;
}

type EngineDefaults = Partial<Record<string, number | string>>;

type ProfileFiles = { lm_model: string; depth_model: string; cond_model: string; dit_model: string; vae_model: string };

type SetupStatus = {
  ready?: boolean;
  profile_files?: ProfileFiles | null;
  engine_ready?: boolean;
  selected_profile_id?: string | null;
  selected_component_ids?: string[] | null;
  effective_max_batch?: number;
  hardware?: { reason?: string };
};

type EngineCatalog = {
  defaults?: EngineDefaults;
  models?: { lm?: string[]; depth?: string[]; cond?: string[]; dit?: string[]; vae?: string[] };
};

/** 9000 acoustic frames at 25 frames per second, as the model card states. */
const MAX_DURATION_SECONDS = 360;
/** The tokenized caption + lyrics budget the engine enforces at submit. */
const MAX_PROMPT_TOKENS = 5000;

const PROFILE_LABEL: Record<string, string> = {
  native: 'Full Native',
  'quality-q8': 'Q8 Quality',
  balanced: 'Balanced',
  'recommended-light': 'Light',
};

const CONTROL =
  'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand disabled:opacity-50 dark:border-white/10 dark:bg-black/25 dark:text-white';
const CARD = 'rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/5 dark:bg-suno-card';
const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';
const TOOL =
  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition-colors hover:border-brand hover:text-brand dark:border-white/10 dark:text-zinc-300';
const CTA =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-xs font-bold text-black transition hover:bg-brand-soft disabled:opacity-50';
const CTA_PRIMARY =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-bold text-black shadow-lg shadow-brand/20 transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50';

const numberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** A rough token estimate, only used to warn before the engine rejects it. */
const estimateTokens = (text: string) => Math.ceil(text.trim().length / 3.6);

const ICON =
  'rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-black dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-40';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className={LABEL}>{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{hint}</span>}
  </label>
);

/** The toggle used throughout the studio: a real switch, not a tick box. */
const Switch: React.FC<{ checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      {hint && <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{hint}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-600'}`}
    >
      <span className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  </div>
);

/**
 * A number you drag, with the value beside it.
 *
 * An empty field means "engine default", and that has to survive: the slider
 * shows the default until it is touched, and the reset action puts it back.
 */
const SliderRow: React.FC<{
  label: string;
  value: string;
  fallback: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ label, value, fallback, min, max, step, suffix, onChange, disabled }) => {
  const current = value.trim() === '' ? fallback : Number(value);
  const shown = Number.isFinite(current) ? current : fallback;
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 1 : 0;
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
          {shown.toFixed(decimals)}{suffix ?? ''}
          {value.trim() === '' && <span className="ml-1 text-zinc-400">·</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        className="mt-1.5 h-1 w-full cursor-pointer accent-brand"
      />
    </div>
  );
};

/** A group inside Advanced: what this stage is, and what these knobs do. */
const Stage: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section>
    <h4 className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h4>
    <p className="mb-3 mt-0.5 text-[11px] leading-4 text-zinc-500">{hint}</p>
    {children}
  </section>
);

/** A card with a titled header strip, the way the panels are built elsewhere. */
const Card: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-suno-card">
    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-white/5 dark:bg-white/5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</span>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
    <div className="p-3">{children}</div>
  </div>
);

/** Grows with its content: these sections run to a thousand characters. */
const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }> = ({ minRows = 3, value, ...rest }) => {
  const node = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, minRows * 20)}px`;
  }, [value, minRows]);
  return <textarea ref={node} value={value} rows={minRows} {...rest} />;
};

/** One labelled section of the structured caption. */
const Pane: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEnhance?: () => void;
  enhancing?: boolean;
  enhanceTitle?: string;
  enhanceDisabled?: boolean;
}> = ({ label, value, placeholder, onChange, onEnhance, enhancing, enhanceTitle, enhanceDisabled }) => (
  <div className="rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-brand dark:border-white/10 dark:bg-black/25">
    <div className="flex items-center justify-between gap-2 px-2.5 pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="flex items-center gap-2">
        {onEnhance && (
          <button
            type="button"
            onClick={onEnhance}
            disabled={enhanceDisabled || enhancing}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-brand transition-colors hover:bg-brand/10 disabled:opacity-40"
            title={enhanceTitle}
          >
            {enhancing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          </button>
        )}
        <span className="text-[10px] tabular-nums text-zinc-400">{value.length}</span>
      </span>
    </div>
    <AutoTextarea
      value={value}
      minRows={4}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full resize-none bg-transparent px-2.5 pb-2.5 pt-1 text-sm leading-5 text-zinc-900 outline-none dark:text-white"
    />
  </div>
);

export const CreatePanel: React.FC<CreatePanelProps> = ({
  onGenerate,
  isGenerating,
  activeJobCount = 0,
  initialData,
  preferenceInstruction = '',
  waitForJobsToDrain,
  enqueueCreatePipeline,
  createTempSongForClick,
  updateTempSongForClick,
  removeTempSongForClick,
  incrementPendingClicks,
  decrementPendingClicks,
  registerPreflightAbort,
  unregisterPreflightAbort,
}) => {
  const { t } = useI18n();

  const [name, setName] = useState('');
  // The caption is three labelled panes, the way the model was trained and the
  // way MiniMax's own demo edits it.
  const [globalMetadata, setGlobalMetadata] = useState('');
  const [vocalDetails, setVocalDetails] = useState('');
  const [arrangement, setArrangement] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [randomizeSeed, setRandomizeSeed] = useState(true);

  // Parameters are strings so an empty field can mean "engine default".
  const [duration, setDuration] = useState('');
  const [lmSeed, setLmSeed] = useState('');
  const [lmCfg, setLmCfg] = useState('');
  const [lmTopK, setLmTopK] = useState('');
  const [audioCodes, setAudioCodes] = useState('');
  const [steps, setSteps] = useState('');
  const [ditCfg, setDitCfg] = useState('');
  const [synthBatch, setSynthBatch] = useState('');
  // A track read back into the codes the engine renders from. Nothing here
  // changes a request until a file is chosen: no file, no field, and the
  // studio behaves exactly as it did before this existed.
  const [seed, setSeed] = useState('');
  const [peakClip, setPeakClip] = useState('');
  // Quality first, not "quick listen": the engine's own defaults are mp3 at
  // 128 kbps, which throws away what the vocoder produced.
  const [mp3Bitrate, setMp3Bitrate] = useState('320');
  // The engine's own default is 128 kbps, which throws away what the vocoder
  // produced; 320 is the top the encoder offers and costs a few megabytes.
  const [format, setFormat] = useState<Music3Request['output_format']>('mp3');
  const [models, setModels] = useState<Record<string, string>>({});

  const [setup, setSetup] = useState<SetupStatus | null>(null);
  // "Nobody answered" and "the engine says it has no models" are different
  // problems, and telling the user to download 12 GB when the service is simply
  // down is a lie.
  const [serviceDown, setServiceDown] = useState(false);
  const [catalog, setCatalog] = useState<EngineCatalog | null>(null);
  const [assistantReady, setAssistantReady] = useState(false);
  const [assisting, setAssisting] = useState<'all' | 'lyrics' | 'prompt' | null>(null);
  // What the assistant is doing right now, and what it has written so far.
  const [assistStage, setAssistStage] = useState<string | null>(null);
  const [assistModel, setAssistModel] = useState<string | null>(null);
  const [assistDraft, setAssistDraft] = useState('');
  // What the assistant said the cover should show; sent with the request so the
  // automatic cover uses it instead of the generic template.
  const [coverPrompt, setCoverPrompt] = useState('');
  // What the studio is doing to finished tracks: covers and karaoke timings run
  // after generation, and used to run in complete silence.
  const [activity, setActivity] = useState<Array<{ song_id: string; title: string; kind: string; state: string; detail?: string }>>([]);
  useEffect(() => {
    // Finished work changes the track on screen - a cover appears, timings
    // arrive - so the library is told to reread it rather than waiting for the
    // next thing that happens to reload the list.
    let finished = '';
    const read = () => void fetch('/v1/activity')
      .then(response => response.json())
      .then((body: { activity?: typeof activity }) => {
        const entries = body.activity ?? [];
        const done = entries.filter(entry => entry.state === 'done').map(entry => `${entry.song_id}:${entry.kind}`).join(',');
        if (done !== finished) {
          finished = done;
          window.dispatchEvent(new CustomEvent('mm3:library-changed'));
        }
        setActivity(entries);
      })
      .catch(() => undefined);
    read();
    const timer = window.setInterval(read, 2000);
    return () => window.clearInterval(timer);
  }, []);
  // A local model takes tens of seconds to answer. A spinner alone reads as a
  // hung button, so the panel counts the seconds out loud.
  const [assistSeconds, setAssistSeconds] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [stylesText, setStylesText] = useState('');
  const [styleChipOrder, setStyleChipOrder] = useState(() => orderedStyleChips());
  const [enhancingSection, setEnhancingSection] = useState<'global' | 'vocal' | 'arrangement' | null>(null);
  const [excludeStyles, setExcludeStyles] = useState('');
  const [vocalGender, setVocalGender] = useState<'auto' | 'male' | 'female'>('auto');
  // Director (simple) is the primary path: one brief → full draft. Studio stays
  // for hand-edited captions; Instrumental is no-vocals only; Cover is rewrite.
  const [mode, setMode] = useState<'simple' | 'studio' | 'cover' | 'instrumental'>('simple');
  const [assistInstruction, setAssistInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const promptFile = useRef<HTMLInputElement | null>(null);
  const coverFileInput = useRef<HTMLInputElement | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverTranscript, setCoverTranscript] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [asrModelId, setAsrModelId] = useState<string | null>(null);
  // Song language lock: auto = intent/lyrics rules; not UI/brief language alone.
  const [lyricsLanguage, setLyricsLanguageState] = useState<'auto' | 'tr' | 'en' | 'ru' | 'ja' | 'zh' | 'ko'>(() => {
    try {
      const stored = localStorage.getItem('music3-studio-song-language');
      if (stored === 'auto' || stored === 'tr' || stored === 'en' || stored === 'ru' || stored === 'ja' || stored === 'zh' || stored === 'ko') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'auto';
  });
  const setLyricsLanguage = (lang: typeof lyricsLanguage) => {
    setLyricsLanguageState(lang);
    try {
      localStorage.setItem('music3-studio-song-language', lang);
    } catch {
      // ignore
    }
  };

  const ready = setup?.ready === true && setup?.engine_ready === true;
  const defaults = catalog?.defaults ?? {};
  const placeholder = (key: string) => (defaults[key] === undefined ? '' : String(defaults[key]));
  const caption = joinCaption(globalMetadata, vocalDetails, arrangement);
  const promptTokens = estimateTokens(caption) + estimateTokens(lyrics);

  const profileLabel = useMemo(() => {
    if (setup?.selected_component_ids?.length) return t('customSet');
    const id = setup?.selected_profile_id;
    return id ? PROFILE_LABEL[id] ?? id : '—';
  }, [setup, t]);

  useEffect(() => {
    if (!assisting) return;
    setAssistSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setAssistSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [assisting]);

  const refreshSetup = useCallback(async () => {
    const response = await fetch('/setup/status');
    if (!response.ok) throw new Error(String(response.status));
    setSetup(await response.json());
    setServiceDown(false);
  }, []);

  useEffect(() => {
    const poll = () => void refreshSetup().catch(() => { setSetup(null); setServiceDown(true); });
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => window.clearInterval(timer);
  }, [refreshSetup]);

  useEffect(() => {
    void fetch('/v1/local-models/music')
      .then(response => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((body: { catalog?: EngineCatalog }) => setCatalog(body.catalog ?? null))
      .catch(() => setCatalog(null));
  }, [setup?.engine_ready]);

  useEffect(() => {
    // Asked once at mount, the panel kept saying "configure the assistant"
    // long after the assistant had been configured. It is asked again while it
    // is not ready, and whenever the settings are closed.
    const read = () => void fetch('/v1/assistant/status')
      .then(response => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((body: { available?: boolean }) => setAssistantReady(body.available === true))
      .catch(() => setAssistantReady(false));
    read();
    const timer = window.setInterval(read, 5000);
    window.addEventListener('mm3:settings-changed', read);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('mm3:settings-changed', read);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'cover') return;
    void loadNativeOpenRouterCatalog()
      .then(models => {
        const asr = modelsForCapability(models, 'speech_to_text');
        setAsrModelId(asr[0]?.id ?? null);
      })
      .catch(() => setAsrModelId(null));
  }, [mode]);

  useEffect(() => {
    const onCover = (event: Event) => {
      const song = (event as CustomEvent<Song>).detail;
      if (!song) return;
      setMode('cover');
      setName(song.title || '');
      setCoverFile(null);
      setCoverTranscript((song.lyrics || '').trim());
      setAssistInstruction(`Inspired by "${song.title || 'this track'}". Keep a similar vibe; write original lyrics.`);
      if (song.audioUrl) {
        // Best-effort: fetch audio into a File so Transcribe can run without re-upload.
        void fetch(song.audioUrl)
          .then(response => response.ok ? response.blob() : Promise.reject())
          .then(blob => setCoverFile(new File([blob], `${song.title || 'reference'}.mp3`, { type: blob.type || 'audio/mpeg' })))
          .catch(() => undefined);
      }
    };
    window.addEventListener('mm3:cover-from-song', onCover);
    return () => window.removeEventListener('mm3:cover-from-song', onCover);
  }, []);

  const selectMode = (next: 'simple' | 'studio' | 'cover' | 'instrumental') => {
    setMode(next);
    if (next === 'instrumental') {
      setInstrumental(true);
      setLyrics('');
      return;
    }
    if (mode === 'instrumental') setInstrumental(false);
  };

  const buildCoverInstruction = (transcript: string, extra: string) => {
    const reference = transcript.trim();
    const direction = extra.trim();
    return [
      'Inspired cover — write an ORIGINAL song inspired by the reference below.',
      'Match genre, mood, energy arc and approximate section structure.',
      'Do NOT quote, paraphrase, translate, or closely rewrite the reference lyrics.',
      'Invent a new title, new story, and new singable lyrics with section tags.',
      'Caption variety: avoid stock filler; write a distinctive arrangement and concrete Sonics (~300-450 words).',
      reference ? `\nReference transcript / structure:\n---\n${reference}\n---` : '',
      direction ? `\nExtra direction from the user:\n${direction}` : '',
    ].filter(Boolean).join('\n');
  };

  const transcribeCover = async () => {
    if (!coverFile || !asrModelId || coverBusy) return;
    setCoverBusy(true);
    setError(null);
    try {
      const text = await transcribeWithNativeOpenRouter(asrModelId, coverFile);
      setCoverTranscript(text.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCoverBusy(false);
    }
  };

  useEffect(() => {
    if (!initialData?.song) return;
    const song = initialData.song;
    setName(song.title || '');
    const panes = splitCaption(song.style || '');
    setGlobalMetadata(panes.globalMetadata);
    setVocalDetails(panes.vocalDetails);
    setArrangement(panes.arrangement);
    setLyrics(song.lyrics || '');
    const settings = (song.generationParams ?? {}) as EngineDefaults;
    const asString = (key: string) => (settings[key] === undefined ? '' : String(settings[key]));
    setDuration(asString('duration'));
    setSteps(asString('steps'));
    setLmCfg(asString('lm_cfg'));
    setLmTopK(asString('lm_top_k'));
    setDitCfg(asString('dit_cfg'));
    setPeakClip(asString('peak_clip'));
    setMp3Bitrate(asString('mp3_bitrate'));
    if (typeof settings.output_format === 'string') setFormat(settings.output_format as Music3Request['output_format']);
  }, [initialData]);

  const reset = () => {
    setName(''); setGlobalMetadata(''); setVocalDetails(''); setArrangement(''); setLyrics(''); setInstrumental(false);
    setStylesText(''); setExcludeStyles(''); setVocalGender('auto');
    setDuration(''); setLmBatch(''); setLmSeed(''); setLmCfg(''); setLmTopK(''); setAudioCodes('');
    setSteps(''); setDitCfg(''); setSynthBatch(''); setSeed('');
    setPeakClip(''); setMp3Bitrate('320'); setFormat('mp3'); setModels({});
    setError(null);
  };

  /** One of the official demo prompts bundled with the engine. */
  const loadExample = () => {
    const example = randomExample();
    setGlobalMetadata(example.globalMetadata);
    setVocalDetails(example.vocalDetails);
    setArrangement(example.arrangement);
    setLyrics(example.lyrics);
    setDuration(String(example.duration));
    setName(example.name);
    setError(null);
  };

  const buildRequest = (overrides?: { instrumental?: boolean; lyrics?: string }) => {
    let captionText = appendStylesToCaption(caption, stylesText);
    if (excludeStyles.trim()) captionText = `${captionText}\nExclude: ${excludeStyles.trim()}`.trim();
    const asInstrumental = overrides?.instrumental ?? instrumental;
    const lyricSource = overrides?.lyrics ?? lyrics;
    const request: Music3Request & { title?: string; cover_prompt?: string; audio_codes?: string; models?: Record<string, string> } = {
      caption: captionText,
      // An instrumental has no words, whatever is still sitting in the box. The
      // lyrics of the previous track stayed there, went to the engine and came
      // back sung: the switch said instrumental and the track had vocals.
      lyrics: asInstrumental ? '' : lyricSource.replace(/\r\n?/g, '\n').trim(),
      duration_seconds: Math.min(numberOrUndefined(duration) ?? 60, MAX_DURATION_SECONDS),
      steps: numberOrUndefined(steps) ?? 30,
      seed: randomizeSeed ? undefined : numberOrUndefined(seed),
      lm_seed: numberOrUndefined(lmSeed),
      lm_cfg: numberOrUndefined(lmCfg) ?? 1.5,
      lm_top_k: numberOrUndefined(lmTopK) ?? 50,
      lm_batch_size: 1,
      synth_batch_size: numberOrUndefined(synthBatch) ?? 1,
      dit_cfg: numberOrUndefined(ditCfg) ?? 1.7,
      peak_clip: numberOrUndefined(peakClip) ?? 10,
      output_format: format,
      mp3_bitrate: numberOrUndefined(mp3Bitrate) ?? 128,
      create_mode: mode === 'cover'
        ? 'cover'
        : mode === 'instrumental' || asInstrumental
          ? 'instrumental'
          : mode,
    };
    if (stylesText.trim()) request.styles_text = stylesText.trim();
    if (name.trim()) request.title = name.trim();
    if (coverPrompt.trim()) request.cover_prompt = coverPrompt.trim();
    if (audioCodes.trim()) request.audio_codes = audioCodes.trim();
    if (Object.keys(models).length === 5) request.models = models;
    return request;
  };

  const savePrompt = () => {
    const request = buildRequest();
    const blob = new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(name.trim() || 'request').replace(/[\\/:*?"<>|]/g, '')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openPrompt = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const asString = (value: unknown) => (typeof value === 'number' || typeof value === 'string' ? String(value) : '');
      if (typeof parsed.title === 'string') setName(parsed.title);
      if (typeof parsed.caption === 'string') {
        const panes = splitCaption(parsed.caption);
        setGlobalMetadata(panes.globalMetadata);
        setVocalDetails(panes.vocalDetails);
        setArrangement(panes.arrangement);
      }
      if (typeof parsed.lyrics === 'string') setLyrics(parsed.lyrics);
      setDuration(asString(parsed.duration ?? parsed.duration_seconds));
      setSteps(asString(parsed.steps));
      setLmCfg(asString(parsed.lm_cfg));
      setLmTopK(asString(parsed.lm_top_k));
      setLmSeed(asString(parsed.lm_seed));
      setLmBatch(asString(parsed.lm_batch_size));
      setDitCfg(asString(parsed.dit_cfg));
      setSynthBatch(asString(parsed.synth_batch_size));
      setSeed(asString(parsed.seed));
      setPeakClip(asString(parsed.peak_clip));
      setMp3Bitrate(asString(parsed.mp3_bitrate));
      if (typeof parsed.audio_codes === 'string') setAudioCodes(parsed.audio_codes);
      if (typeof parsed.output_format === 'string') setFormat(parsed.output_format as Music3Request['output_format']);
      setError(null);
    } catch {
      setError(t('promptFileInvalid'));
    }
  };

  /// Optional. Nothing here is required to use the model: the manual form is
  /// the primary path, and the buttons stay disabled until a provider is set.
  // A run in progress can be given up on. The request is a stream that can
  // take minutes on a reasoning model, and without this the only way out of one
  // that went quiet was to close the studio.
  const assistRun = useRef<AbortController | null>(null);
  const stopAssistant = () => {
    assistRun.current?.abort();
    assistRun.current = null;
    setAssisting(null);
    setAssistStage(null);
    setAssistDraft('');
  };

  type AssistDraftResult = {
    lyrics?: string;
    global_metadata?: string;
    vocal_details?: string;
    arrangement?: string;
    title?: string;
    cover_prompt?: string;
    duration_seconds?: number;
  };

  type CreateSnapshot = {
    name: string;
    stylesText: string;
    excludeStyles: string;
    lyrics: string;
    caption: string;
    globalMetadata: string;
    vocalDetails: string;
    arrangement: string;
    coverPrompt: string;
    duration: string;
    instrumental: boolean;
    vocalGender: typeof vocalGender;
    lyricsLanguage: typeof lyricsLanguage;
  };

  const languageLockLine = (lang: typeof lyricsLanguage = lyricsLanguage) => {
    if (lang === 'auto') {
      return 'Song language: default to English sung lyrics unless the user already supplied lyrics or explicitly asked for another language.';
    }
    const names: Record<typeof lyricsLanguage, string> = {
      auto: 'English',
      tr: 'Turkish',
      en: 'English',
      ru: 'Russian',
      ja: 'Japanese',
      zh: 'Chinese',
      ko: 'Korean',
    };
    const label = names[lang];
    return `HARD Song language lock: write EVERY sung lyric line entirely in ${label}. Section tags stay English. Do not write Russian or any other language.`;
  };

  const buildAdvancedCaptionInstruction = (snap?: CreateSnapshot) => {
    const styles = (snap?.stylesText ?? stylesText).trim();
    const exclude = (snap?.excludeStyles ?? excludeStyles).trim();
    const gender = snap?.vocalGender ?? vocalGender;
    const isInstrumental = snap?.instrumental ?? instrumental;
    const lyricText = (snap?.lyrics ?? lyrics).trim();
    const instrumentLock = expandStylesForCaption(styles);
    const lines: string[] = [
      'Write the structured caption (global_metadata, vocal_details, arrangement) for MiniMax Music 3 from the styles and lyrics below.',
      'Caption fields must stay in English. Align arrangement sections with the lyric tags.',
      'BPM rule: if the styles state an explicit BPM (or tempo number), use that exact BPM in Basic Attributes. If no BPM is given, choose a suitable tempo automatically (a range or qualitative tempo is fine — do not invent a fake precise BPM).',
      'HARD Styles fidelity: every named genre, instrument, or percussion in Styles (e.g. cowbell, 808, saxophone, keman) MUST appear explicitly in Arrangement and/or Sonics & Production Profile — do not drop or replace them with generic drums.',
      'Variety: avoid stock filler ("atmospheric pads", "driving drums", "night drive"). Invent a distinctive hook, specific secondary textures, and concrete mix moves. Aim for ~300-450 words with clear section-to-section contrast — not a short generic blurb.',
    ];
    if (instrumentLock) {
      lines.push(`HARD instrument constraints (from Styles — mandatory in Arrangement + Sonics):\n${instrumentLock}`);
    }
    if (styles) lines.push(`Styles:\n${styles}`);
    if (lyricText) lines.push(`Lyrics:\n${lyricText}`);
    if (exclude) lines.push(`Exclude / avoid: ${exclude}`);
    if (gender === 'male') lines.push('Vocal gender constraint: Male lead.');
    if (gender === 'female') lines.push('Vocal gender constraint: Female lead.');
    if (isInstrumental) lines.push('This piece is instrumental: no sung words.');
    return lines.join('\n\n');
  };

  const buildSectionEnhanceInstruction = (section: 'global' | 'vocal' | 'arrangement') => {
    const styles = stylesText.trim();
    const instrumentLock = expandStylesForCaption(styles);
    const focus =
      section === 'global'
        ? 'global_metadata'
        : section === 'vocal'
          ? 'vocal_details'
          : 'arrangement';
    const lines: string[] = [
      `Rewrite ONLY the ${focus} field for MiniMax Music 3. Return all three caption fields in JSON.`,
      'Copy the other two fields EXACTLY from Current below — do not change their wording.',
      'Caption fields must stay in English. Strengthen musical concreteness; keep lyric section tags aligned when rewriting arrangement.',
      'HARD Styles fidelity: named instruments/genres in Styles must appear in Arrangement and/or Sonics.',
      'Make the rewritten field more specific and less template-like: name textures, groove personality, and mix moves — avoid stock filler phrases.',
    ];
    if (instrumentLock) {
      lines.push(`HARD instrument constraints:\n${instrumentLock}`);
    }
    if (styles) lines.push(`Styles:\n${styles}`);
    if (lyrics.trim()) lines.push(`Lyrics:\n${lyrics.trim()}`);
    lines.push(
      `Current (keep non-${focus} identical):\nGlobal metadata:\n${globalMetadata.trim() || '(empty)'}\n\nVocal details:\n${vocalDetails.trim() || '(empty)'}\n\nArrangement:\n${arrangement.trim() || '(empty)'}`,
    );
    if (instrumental) lines.push('This piece is instrumental: no sung words.');
    if (vocalGender === 'male') lines.push('Vocal gender constraint: Male lead.');
    if (vocalGender === 'female') lines.push('Vocal gender constraint: Female lead.');
    return lines.join('\n\n');
  };

  /** Empty box or a few keywords → seed; tagged verses → keep as real lyrics. */
  const lyricsLookLikeSeed = (text: string) => {
    const value = text.trim();
    if (!value) return true;
    if (/\[[a-z][a-z0-9-]*\]/i.test(value)) return false;
    const lines = value.split(/\n/).map((line) => line.trim()).filter(Boolean);
    return lines.length <= 4 && value.length < 160;
  };

  const buildAdvancedLyricsInstruction = (snap?: CreateSnapshot) => {
    const seed = (snap?.lyrics ?? lyrics).trim();
    const styles = (snap?.stylesText ?? stylesText).trim();
    const exclude = (snap?.excludeStyles ?? excludeStyles).trim();
    const title = (snap?.name ?? name).trim();
    const lang = snap?.lyricsLanguage ?? lyricsLanguage;
    const lines: string[] = [
      languageLockLine(lang),
      'Write complete singable MiniMax Music 3 lyrics with section tags on their own lines ([intro], [verse], [pre-chorus], [chorus], [bridge], [outro], …).',
      'Do not put musical instructions inside the lyrics — only sung words under the tags.',
      'If Styles name a genre or vibe (phonk, arabesque, lo-fi, kpop, …), write imagery and attitude that fit that culture/scene — not a generic love song.',
    ];
    if (styles) {
      lines.push(`Styles / sound world (use as theme and mood):\n${styles}`);
    }
    if (seed) {
      lines.push(
        lyricsLookLikeSeed(seed)
          ? `User keywords / seed phrases (expand into a full song; do not leave them as a bare word list):\n${seed}`
          : `Existing lyric draft to improve or complete:\n${seed}`,
      );
    } else if (styles) {
      lines.push('Lyrics box is empty — invent original lyrics that belong to the Styles world above.');
    } else {
      lines.push('No styles or keywords were given — write a specific, concrete song (pick a clear mood and story).');
    }
    if (exclude) lines.push(`Avoid themes/sounds: ${exclude}`);
    if (title) lines.push(`Working title (optional inspiration): ${title}`);
    return lines.join('\n\n');
  };

  const withTaste = (instruction: string) => {
    const taste = preferenceInstruction.trim();
    if (!taste) return instruction;
    return instruction.trim() ? `${instruction.trim()}\n\n${taste}` : taste;
  };

  /** Queued Create path: one shot to /write (server retries while model loads). */
  const runAssistantWrite = async (
    target: 'all' | 'lyrics' | 'prompt',
    instruction: string,
    snap: CreateSnapshot,
    signal: AbortSignal,
    options?: { clearCaption?: boolean; clearLyrics?: boolean },
  ): Promise<AssistDraftResult> => {
    const clearCaption = options?.clearCaption === true;
    const clearLyrics = options?.clearLyrics === true;
    const payload = JSON.stringify({
      target,
      description: snap.name.trim(),
      instruction: withTaste(instruction),
      lyrics: clearLyrics ? '' : snap.lyrics.trim(),
      global_metadata: clearCaption ? '' : snap.globalMetadata.trim(),
      vocal_details: clearCaption ? '' : snap.vocalDetails.trim(),
      arrangement: clearCaption ? '' : snap.arrangement.trim(),
      duration_seconds: numberOrUndefined(snap.duration) ?? 60,
      instrumental: snap.instrumental,
      lyrics_language: snap.lyricsLanguage,
    });

    const response = await fetch('/v1/assistant/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || String(response.status));
    const draft: AssistDraftResult = {};
    if (typeof body?.lyrics === 'string') draft.lyrics = body.lyrics;
    if (typeof body?.global_metadata === 'string') draft.global_metadata = body.global_metadata;
    if (typeof body?.vocal_details === 'string') draft.vocal_details = body.vocal_details;
    if (typeof body?.arrangement === 'string') draft.arrangement = body.arrangement;
    if (typeof body?.title === 'string' && body.title.trim()) draft.title = body.title.trim();
    if (typeof body?.cover_prompt === 'string' && body.cover_prompt.trim()) draft.cover_prompt = body.cover_prompt.trim();
    if (typeof body?.duration_seconds === 'number' && body.duration_seconds >= 10) {
      draft.duration_seconds = Math.min(360, Math.round(body.duration_seconds));
    }
    return draft;
  };

  const writeAdvancedLyrics = async () => {
    if (!assistantReady || assisting) return;
    if (instrumental) {
      setError(t('instrumentalNoLyrics'));
      return;
    }
    if (!stylesText.trim() && !lyrics.trim()) {
      setError(t('lyricsNeedStylesOrKeywords'));
      return;
    }
    const seedMode = lyricsLookLikeSeed(lyrics);
    await askAssistant('lyrics', buildAdvancedLyricsInstruction(), {
      // Keywords/empty → write from scratch; keep structured caption if any.
      clearCarried: false,
      clearCaption: false,
      ...(seedMode ? { clearLyrics: true } : {}),
    });
  };

  const writeAdvancedCaption = async () => {
    if (!assistantReady || assisting) return;
    if (!stylesText.trim() && !lyrics.trim() && !excludeStyles.trim()) {
      setError(t('captionNeedStylesOrLyrics'));
      return;
    }
    setCaptionOpen(true);
    await askAssistant('prompt', buildAdvancedCaptionInstruction(), { clearCaption: true });
  };

  const enhanceCaptionSection = async (section: 'global' | 'vocal' | 'arrangement') => {
    if (!assistantReady || assisting) return;
    setCaptionOpen(true);
    setEnhancingSection(section);
    const applyOnly =
      section === 'global'
        ? (['global_metadata'] as const)
        : section === 'vocal'
          ? (['vocal_details'] as const)
          : (['arrangement'] as const);
    try {
      await askAssistant('prompt', buildSectionEnhanceInstruction(section), {
        clearCaption: false,
        applyOnly: [...applyOnly],
      });
    } finally {
      setEnhancingSection(null);
    }
  };

  type ApplyField = 'lyrics' | 'global_metadata' | 'vocal_details' | 'arrangement' | 'title' | 'cover_prompt' | 'duration_seconds';

  // Music3 and the writing assistant share one GPU. Starting the assistant
  // while a track is generating fights for VRAM; the Create pipeline waits
  // instead, and standalone "write" buttons stay locked until the card is free.
  const musicOccupiesGpu = activeJobCount > 0;

  const askAssistant = async (
    target: 'all' | 'lyrics' | 'prompt',
    instructionOverride?: string,
    options?: {
      clearCarried?: boolean;
      clearCaption?: boolean;
      clearLyrics?: boolean;
      applyOnly?: ApplyField[];
    },
  ): Promise<AssistDraftResult | null> => {
    if (!assistantReady || assisting) return null;
    if (musicOccupiesGpu) {
      setError(t('assistantWaitForMusic'));
      return null;
    }
    const run = new AbortController();
    assistRun.current = run;
    setAssisting(target);
    setError(null);
    const allow = (field: ApplyField) => !options?.applyOnly || options.applyOnly.includes(field);
    try {
      const instruction = withTaste((instructionOverride ?? assistInstruction).trim());
      const clear = options?.clearCarried === true;
      const clearCaption = clear || options?.clearCaption === true;
      const clearLyrics = clear || options?.clearLyrics === true;
      const payload = JSON.stringify({
        target,
        description: name.trim(),
        instruction,
        lyrics: clearLyrics ? '' : lyrics.trim(),
        global_metadata: clearCaption ? '' : globalMetadata.trim(),
        vocal_details: clearCaption ? '' : vocalDetails.trim(),
        arrangement: clearCaption ? '' : arrangement.trim(),
        duration_seconds: numberOrUndefined(duration) ?? 60,
        instrumental,
        lyrics_language: lyricsLanguage,
      });

      setAssistStage('preparing');
      setAssistDraft('');
      let streamed = '';
      const live = await fetch('/v1/assistant/write/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: run.signal,
      });
      if (live.ok && live.body) {
        const reader = live.body.getReader();
        const decoder = new TextDecoder();
        let carry = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          carry += decoder.decode(value, { stream: true });
          let split = carry.indexOf('\n\n');
          while (split !== -1) {
            const frame = carry.slice(0, split).trim();
            carry = carry.slice(split + 2);
            split = carry.indexOf('\n\n');
            if (!frame.startsWith('data:')) continue;
            let event: { stage?: string; delta?: string; text?: string; error?: string; model?: string };
            try {
              event = JSON.parse(frame.slice(5).trim());
            } catch {
              continue;
            }
            if (event.error) throw new Error(event.error);
            if (event.stage) setAssistStage(event.stage);
            if (event.model) setAssistModel(event.model);
            if (event.delta) {
              streamed += event.delta;
              setAssistDraft(streamed);
            }
          }
        }
      }

      const response = await fetch('/v1/assistant/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: run.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || String(response.status));
      const draft: AssistDraftResult = {};
      if (typeof body?.lyrics === 'string') {
        draft.lyrics = body.lyrics;
        if (allow('lyrics')) setLyrics(body.lyrics);
      }
      if (typeof body?.global_metadata === 'string') {
        draft.global_metadata = body.global_metadata;
        if (allow('global_metadata')) setGlobalMetadata(body.global_metadata);
      }
      if (typeof body?.vocal_details === 'string') {
        draft.vocal_details = body.vocal_details;
        if (allow('vocal_details')) setVocalDetails(body.vocal_details);
      }
      if (typeof body?.arrangement === 'string') {
        draft.arrangement = body.arrangement;
        if (allow('arrangement')) setArrangement(body.arrangement);
      }
      if (typeof body?.title === 'string' && body.title.trim()) {
        draft.title = body.title.trim();
        if (allow('title')) setName(body.title.trim());
      }
      if (typeof body?.cover_prompt === 'string' && body.cover_prompt.trim()) {
        draft.cover_prompt = body.cover_prompt.trim();
        if (allow('cover_prompt')) setCoverPrompt(body.cover_prompt.trim());
      }
      if (typeof body?.duration_seconds === 'number' && body.duration_seconds >= 10) {
        draft.duration_seconds = Math.min(360, Math.round(body.duration_seconds));
        if (allow('duration_seconds') && duration.trim() === '') setDuration(String(draft.duration_seconds));
      }
      return draft;
    } catch (reason) {
      const cancelled = reason instanceof DOMException && reason.name === 'AbortError';
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      return null;
    } finally {
      assistRun.current = null;
      setAssisting(null);
      setAssistStage(null);
      setAssistDraft('');
    }
  };

  const rewriteFromCover = async () => {
    if (!assistantReady || assisting) return;
    if (!coverTranscript.trim() && !assistInstruction.trim()) {
      setError(t('coverNeedsReference'));
      return;
    }
    setLyrics('');
    setGlobalMetadata('');
    setVocalDetails('');
    setArrangement('');
    await askAssistant('all', buildCoverInstruction(coverTranscript, assistInstruction), { clearCarried: true });
  };

  const takeCreateSnapshot = (): CreateSnapshot => ({
    name,
    stylesText,
    excludeStyles,
    lyrics,
    caption,
    globalMetadata,
    vocalDetails,
    arrangement,
    coverPrompt,
    duration,
    instrumental,
    vocalGender,
    lyricsLanguage,
  });

  const submit = async () => {
    if (!ready) { setError(t('downloadProfileFirst')); return; }
    if (activeJobCount >= 10) return;

    const treatAsInstrumental = mode === 'instrumental';
    if (treatAsInstrumental) {
      setInstrumental(true);
      setLyrics('');
    }

    // Advanced + Instrumental: queue lyrics/caption assist → music.
    if (mode === 'studio' || mode === 'instrumental') {
      if (mode === 'studio' && !stylesText.trim() && !lyrics.trim() && !caption.trim()) {
        setError(t('advancedNeedsStyles'));
        return;
      }
      if (mode === 'instrumental' && !stylesText.trim() && !caption.trim() && !assistInstruction.trim()) {
        setError(t('instrumentalNeedsStyles'));
        return;
      }
      if (!stylesText.trim() && !caption.trim()) {
        setError(mode === 'instrumental' ? t('instrumentalNeedsStyles') : t('advancedNeedsStyles'));
        return;
      }
      if (!assistantReady && mode === 'studio' && (!caption.trim() || lyricsLookLikeSeed(lyrics))) {
        setError(t('assistantNeedsModel'));
        return;
      }
      if (!assistantReady && mode === 'instrumental' && !caption.trim()) {
        setError(t('assistantNeedsModel'));
        return;
      }

      const durationGuess = numberOrUndefined(duration) ?? 60;
      const snap = {
        ...takeCreateSnapshot(),
        instrumental: treatAsInstrumental || instrumental,
        lyrics: treatAsInstrumental ? instrumentalLyricsScaffold(durationGuess) : lyrics,
      };
      if (snap.stylesText.trim()) {
        recordStylesTextChips(snap.stylesText);
        setStyleChipOrder(orderedStyleChips());
      }
      const preview = snap.name.trim()
        || snap.stylesText.trim().slice(0, 60)
        || snap.lyrics.trim().slice(0, 60)
        || (treatAsInstrumental ? t('instrumental') : '');
      const tempId = createTempSongForClick?.(preview) ?? `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      incrementPendingClicks?.(1);
      const ac = new AbortController();
      registerPreflightAbort?.(tempId, ac);
      setError(null);

      const failQueuedCreate = (message: string) => {
        removeTempSongForClick?.(tempId);
        unregisterPreflightAbort?.(tempId);
        decrementPendingClicks?.(1);
        setError(message);
      };

      const runPipeline = async () => {
        try {
          if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');

          // Hold the LLM until the previous Music3 job releases the GPU.
          updateTempSongForClick?.(tempId, { stage: 'stageWaitingInQueue' });
          if (waitForJobsToDrain) await waitForJobsToDrain(ac.signal);
          if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');

          let working = { ...snap };
          let lyricsForRequest = working.instrumental
            ? (working.lyrics.trim() || instrumentalLyricsScaffold(numberOrUndefined(working.duration) ?? 60))
            : working.lyrics.trim();

          if (!working.instrumental && lyricsLookLikeSeed(working.lyrics)) {
            if (!working.stylesText.trim() && !working.lyrics.trim()) {
              failQueuedCreate(t('lyricsNeedStylesOrKeywords'));
              return;
            }
            updateTempSongForClick?.(tempId, { stage: 'stageWritingLyrics', title: preview || t('creating') });
            const lyricDraft = await runAssistantWrite(
              'lyrics',
              buildAdvancedLyricsInstruction(working),
              working,
              ac.signal,
              { clearLyrics: true },
            );
            if (!lyricDraft.lyrics?.trim()) {
              failQueuedCreate(t('assistantEmpty'));
              return;
            }
            lyricsForRequest = lyricDraft.lyrics.trim();
            working = { ...working, lyrics: lyricsForRequest };
            setLyrics(lyricsForRequest);
            updateTempSongForClick?.(tempId, { lyrics: lyricsForRequest, stage: 'stageWritingCaption' });
          } else if (!working.instrumental && !working.lyrics.trim()) {
            failQueuedCreate(t('lyricsRequired'));
            return;
          }

          let captionText = working.caption.trim();
          let titleForRequest = working.name.trim();
          let coverForRequest = working.coverPrompt.trim();
          let durationForRequest = numberOrUndefined(working.duration) ?? 60;

          if (working.stylesText.trim() || !captionText) {
            setCaptionOpen(true);
            updateTempSongForClick?.(tempId, { stage: 'stageWritingCaption' });
            const draft = await runAssistantWrite(
              'prompt',
              buildAdvancedCaptionInstruction({ ...working, lyrics: lyricsForRequest }),
              { ...working, lyrics: lyricsForRequest },
              ac.signal,
              { clearCaption: true },
            );
            captionText = joinCaption(
              draft.global_metadata ?? '',
              draft.vocal_details ?? '',
              draft.arrangement ?? '',
            ).trim();
            if (!captionText) {
              failQueuedCreate(t('assistantEmpty'));
              return;
            }
            if (draft.global_metadata !== undefined) setGlobalMetadata(draft.global_metadata);
            if (draft.vocal_details !== undefined) setVocalDetails(draft.vocal_details);
            if (draft.arrangement !== undefined) setArrangement(draft.arrangement);
            if (draft.title?.trim()) {
              titleForRequest = draft.title.trim();
              setName(titleForRequest);
            }
            if (draft.cover_prompt?.trim()) {
              coverForRequest = draft.cover_prompt.trim();
              setCoverPrompt(coverForRequest);
            }
            if (draft.duration_seconds && working.duration.trim() === '') {
              durationForRequest = draft.duration_seconds;
              setDuration(String(draft.duration_seconds));
            }
          }

          captionText = appendStylesToCaption(captionText, working.stylesText);
          if (working.excludeStyles.trim()) captionText = `${captionText}\nExclude: ${working.excludeStyles.trim()}`.trim();
          if (estimateTokens(captionText) + estimateTokens(lyricsForRequest) > MAX_PROMPT_TOKENS) {
            failQueuedCreate(t('promptTooLong'));
            return;
          }

          updateTempSongForClick?.(tempId, {
            title: titleForRequest || preview,
            lyrics: lyricsForRequest,
            style: captionText,
            stage: 'stageWaitingInQueue',
          });

          const request = buildRequest({
            instrumental: working.instrumental,
            lyrics: lyricsForRequest,
          });
          request.caption = captionText;
          request.lyrics = lyricsForRequest;
          request.duration_seconds = Math.min(durationForRequest, MAX_DURATION_SECONDS);
          if (working.stylesText.trim()) request.styles_text = working.stylesText.trim();
          else delete request.styles_text;
          if (titleForRequest) request.title = titleForRequest;
          else delete request.title;
          if (coverForRequest) request.cover_prompt = coverForRequest;
          unregisterPreflightAbort?.(tempId);
          onGenerate({ ...request, _tempId: tempId });
        } catch (reason) {
          const cancelled = reason instanceof DOMException && reason.name === 'AbortError';
          if (cancelled) {
            removeTempSongForClick?.(tempId);
            unregisterPreflightAbort?.(tempId);
            decrementPendingClicks?.(1);
            return;
          }
          failQueuedCreate(reason instanceof Error ? reason.message : String(reason));
        }
      };

      if (enqueueCreatePipeline) void enqueueCreatePipeline(runPipeline);
      else void runPipeline();
      return;
    }

    if (assisting) return;
    if (!lyrics.trim()) { setError(t('lyricsRequired')); return; }
    if (!caption.trim()) { setError(t('captionRequired')); return; }
    if (promptTokens > MAX_PROMPT_TOKENS) { setError(t('promptTooLong')); return; }
    setError(null);
    onGenerate(buildRequest({ instrumental: false, lyrics }));
  };

  const totalTracks = numberOrUndefined(synthBatch) ?? 1;
  const roles: Array<{ key: string; label: string; options: string[] }> = [
    { key: 'lm_model', label: 'LM', options: catalog?.models?.lm ?? [] },
    { key: 'depth_model', label: 'Depth', options: catalog?.models?.depth ?? [] },
    { key: 'cond_model', label: 'Cond', options: catalog?.models?.cond ?? [] },
    { key: 'dit_model', label: 'DiT', options: catalog?.models?.dit ?? [] },
    { key: 'vae_model', label: 'VAE', options: catalog?.models?.vae ?? [] },
  ];

  const resetParameters = () => {
    setDuration(''); setLmBatch(''); setLmSeed(''); setLmCfg(''); setLmTopK(''); setAudioCodes('');
    setSteps(''); setDitCfg(''); setSynthBatch(''); setSeed(''); setRandomizeSeed(true);
    setPeakClip(''); setMp3Bitrate('320'); setFormat('mp3'); setModels({});
  };

  const overBudget = promptTokens > MAX_PROMPT_TOKENS;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-suno-panel dark:text-white">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <div className="space-y-3 p-4 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold">{t('createMusic')}</h1>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{t('localInference')}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${ready ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {serviceDown ? t('serviceUnavailable') : ready ? t('engineReady') : t('profileRequired')}
            </span>
          </div>

          {serviceDown ? (
            <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-5 text-rose-700 dark:text-rose-200">
              <CircleAlert className="mt-0.5 shrink-0" size={15} />
              <div><b>{t('serviceUnavailable')}</b><br />{t('serviceUnavailableHint')}</div>
            </div>
          ) : !ready && (
            <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
              <CircleAlert className="mt-0.5 shrink-0" size={15} />
              <div><b>{t('localGenerationUnavailable')}</b><br />{t('downloadProfileFirst')}</div>
            </div>
          )}

          <div className="flex items-center rounded-lg border border-zinc-300 bg-zinc-200 p-1 dark:border-white/5 dark:bg-black/40">
            {([
              { id: 'simple' as const, label: t('simpleMode') },
              { id: 'studio' as const, label: t('studioMode') },
              { id: 'instrumental' as const, label: t('instrumentalMode') },
              { id: 'cover' as const, label: t('coverMode') },
            ]).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectMode(tab.id)}
                className={`flex-1 rounded-md px-1 py-1.5 text-[11px] font-semibold transition-all sm:text-xs ${mode === tab.id ? 'bg-brand text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode !== 'instrumental' && (
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('songLanguage')}</label>
            <select
              value={lyricsLanguage}
              onChange={event => setLyricsLanguage(event.target.value as typeof lyricsLanguage)}
              className={`${CONTROL} py-1.5`}
              title={t('songLanguageHint')}
            >
              <option value="auto">{t('songLanguageAuto')}</option>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          )}

          {mode === 'simple' && !assistantReady && (
            <Card title={t('songIdea')}>
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t('assistantNeedsModel')}</p>
              <p className="mt-2 text-[11px] leading-4 text-zinc-500">{t('assistantHint')}</p>
              {/* Telling someone to go to Settings without a way to get there
                  is half an instruction. */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('mm3:open-settings', { detail: 'models' }))}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand hover:text-brand dark:border-white/15 dark:text-zinc-300"
              >
                <Settings2 size={13} />
                {t('setUpAssistant')}
              </button>
            </Card>
          )}

          {mode === 'simple' && assistantReady && (
            <Card title={t('songIdea')}>
              <AutoTextarea
                value={assistInstruction}
                minRows={3}
                onChange={event => setAssistInstruction(event.target.value)}
                placeholder={t('songIdeaPlaceholder')}
                className={`${CONTROL} resize-none`}
              />
              <p className="mt-2 text-[11px] leading-4 text-zinc-500">{t('songIdeaHint')}</p>
              {preferenceInstruction.trim() && (
                <p className="mt-2 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300/90">{t('tasteLearningHint')}</p>
              )}
              {musicOccupiesGpu && (
                <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-4 text-amber-800 dark:text-amber-200">
                  {t('assistantWaitForMusic')}
                </p>
              )}
              <button
                type="button"
                onClick={() => void askAssistant('all', [
                  assistInstruction.trim(),
                  'Caption variety: avoid stock filler ("atmospheric pads", "driving drums"). Invent a distinctive hook, specific textures, and concrete mix moves (~300-450 words).',
                ].filter(Boolean).join('\n\n'))}
                disabled={assisting !== null || musicOccupiesGpu || !assistInstruction.trim()}
                className={`mt-3 ${CTA}`}
              >
                {assisting === 'all' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {assisting === 'all' ? `${t('assistantWriting')} · ${assistSeconds} ${t('secondsShort')}` : t('writeEverything')}
              </button>
              {assisting === 'all' && (
                <button
                  type="button"
                  onClick={stopAssistant}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-rose-400 hover:text-rose-600 dark:border-white/15 dark:text-zinc-300"
                >
                  <Square size={13} />
                  {t('cancelDownload')}
                </button>
              )}
            </Card>
          )}

          {mode === 'instrumental' && (
            <Card title={t('instrumentalMode')}>
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t('instrumentalModeHint')}</p>
              {assistantReady ? (
                <>
                  <AutoTextarea
                    value={assistInstruction}
                    minRows={3}
                    onChange={event => setAssistInstruction(event.target.value)}
                    placeholder={t('instrumentalIdeaPlaceholder')}
                    className={`${CONTROL} mt-3 resize-none`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setInstrumental(true);
                      setLyrics('');
                      void askAssistant('prompt', [
                        assistInstruction.trim() || 'Instrumental track from the Styles below.',
                        'This piece is fully instrumental: no sung words, no humming, no choir, no vocal chops.',
                        'Write Global metadata, Vocal details (state instrumental + lead instrument), and Arrangement.',
                        'Variety: avoid stock filler. Name a distinctive lead texture, concrete secondary layers, and section-to-section contrast (~300-450 words).',
                      ].join('\n'), { clearCaption: true, clearLyrics: true });
                    }}
                    disabled={assisting !== null || musicOccupiesGpu || (!assistInstruction.trim() && !stylesText.trim())}
                    className={`mt-3 ${CTA}`}
                  >
                    {assisting === 'prompt' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {assisting === 'prompt' ? `${t('assistantWriting')} · ${assistSeconds} ${t('secondsShort')}` : t('writeCaption')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('mm3:open-settings', { detail: 'models' }))}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand hover:text-brand dark:border-white/15 dark:text-zinc-300"
                >
                  <Settings2 size={13} />
                  {t('setUpAssistant')}
                </button>
              )}
            </Card>
          )}

          {mode === 'cover' && (
            <Card title={t('coverMode')}>
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{t('coverModeHint')}</p>
              <input
                ref={coverFileInput}
                type="file"
                accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac"
                className="hidden"
                onChange={event => {
                  setCoverFile(event.target.files?.[0] ?? null);
                  setCoverTranscript('');
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => coverFileInput.current?.click()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-xs font-semibold text-zinc-600 transition-colors hover:border-brand hover:text-brand dark:border-white/15 dark:text-zinc-300"
              >
                <Upload size={14} />
                {coverFile ? coverFile.name : t('coverUploadAudio')}
              </button>
              {!asrModelId && (
                <p className="mt-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">{t('coverNeedsAsr')}</p>
              )}
              <button
                type="button"
                onClick={() => void transcribeCover()}
                disabled={!coverFile || !asrModelId || coverBusy}
                className={`mt-3 ${CTA}`}
              >
                {coverBusy ? <Loader2 size={14} className="animate-spin" /> : <FileAudio size={14} />}
                {coverBusy ? t('coverTranscribing') : t('coverTranscribe')}
              </button>
              <AutoTextarea
                value={coverTranscript}
                minRows={4}
                onChange={event => setCoverTranscript(event.target.value)}
                placeholder={t('coverTranscriptPlaceholder')}
                className={`${CONTROL} mt-3 resize-none font-mono text-xs`}
              />
              <AutoTextarea
                value={assistInstruction}
                minRows={2}
                onChange={event => setAssistInstruction(event.target.value)}
                placeholder={t('coverDirectionPlaceholder')}
                className={`${CONTROL} mt-3 resize-none`}
              />
              {!assistantReady ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('mm3:open-settings', { detail: 'models' }))}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand hover:text-brand dark:border-white/15 dark:text-zinc-300"
                >
                  <Settings2 size={13} />
                  {t('setUpAssistant')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void rewriteFromCover()}
                  disabled={assisting !== null || musicOccupiesGpu || (!coverTranscript.trim() && !assistInstruction.trim())}
                  className={`mt-3 ${CTA}`}
                >
                  {assisting === 'all' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {assisting === 'all' ? `${t('assistantWriting')} · ${assistSeconds} ${t('secondsShort')}` : t('coverRewrite')}
                </button>
              )}
            </Card>
          )}


          {activity.filter(entry => entry.state !== 'done').slice(-3).map(entry => (
            <div key={`${entry.song_id}-${entry.kind}`} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] dark:border-white/10 dark:bg-suno-card">
              <div className="flex items-center gap-2">
                {entry.state === 'running'
                  ? <Loader2 size={12} className="animate-spin text-brand" />
                  : <AlertTriangle size={12} className="text-amber-500" />}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {entry.kind === 'cover' ? t('activityCover') : t('activityKaraoke')}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-500">{entry.title}</span>
              </div>
              {entry.detail && <p className="mt-1 break-words text-[11px] leading-4 text-amber-600 dark:text-amber-300">{karaokeReason(t, entry.detail)}</p>}
            </div>
          ))}

          {assisting !== null && (
            <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-suno-card">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className="flex items-center gap-1.5 text-brand">
                  <Loader2 size={12} className="animate-spin" />
                  {assistStage === 'preparing' && t('assistStagePreparing')}
                  {assistStage === 'sent' && t('assistStageSent')}
                  {assistStage === 'writing' && t('assistStageWriting')}
                  {assistStage === 'done' && t('assistStageDone')}
                  {!assistStage && t('assistStagePreparing')}
                </span>
                <span className="tabular-nums text-zinc-400">{assistSeconds} {t('secondsShort')}</span>
              </div>
              {assistModel && <p className="mt-1 truncate text-[11px] text-zinc-500">{assistModel}</p>}
              {assistDraft && (
                <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-2 font-mono text-[11px] leading-4 text-zinc-600 dark:bg-black/30 dark:text-zinc-300">
                  {assistDraft.slice(-1200)}
                </pre>
              )}
            </div>
          )}

          {/* Only for the icon buttons in the card headers: the big button
              already says it in words. */}
          {(assisting === 'lyrics' || assisting === 'prompt') && (
            <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand dark:text-brand-soft">
              <Loader2 size={14} className="animate-spin" />
              <span>{t('assistantWriting')} · {assistSeconds} {t('secondsShort')}</span>
            </div>
          )}

          {/* Title always available */}
          <div className={CARD}>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={t('untitled')}
              className="w-full border-0 bg-transparent p-0 text-lg font-bold text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-white dark:placeholder:text-zinc-600"
            />
          </div>

          {mode !== 'instrumental' && (
          <Card
            title={t('lyrics')}
            actions={
              <>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${overBudget ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : 'bg-zinc-200/70 text-zinc-500 dark:bg-white/10 dark:text-zinc-400'}`}
                  title={`${t('promptBudget')} — ${t('caption')}: ${estimateTokens(caption)}, ${t('lyrics')}: ${estimateTokens(lyrics)}`}
                >
                  {t('promptBudgetShort')} {promptTokens} / {MAX_PROMPT_TOKENS}
                </span>
                {assistantReady && (
                  <button
                    type="button"
                    onClick={() => void (mode === 'studio' ? writeAdvancedLyrics() : askAssistant('lyrics'))}
                    disabled={assisting !== null || musicOccupiesGpu}
                    className={ICON}
                    title={musicOccupiesGpu ? t('assistantWaitForMusic') : t('writeLyrics')}
                  >
                    {assisting === 'lyrics' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="text-brand" />}
                  </button>
                )}
                <button type="button" onClick={() => setLyrics('')} className={ICON} title={t('resetPrompt')}><RotateCcw size={14} /></button>
              </>
            }
          >
            <AutoTextarea
              value={lyrics}
              minRows={10}
              onChange={event => setLyrics(event.target.value)}
              placeholder={mode === 'studio' ? t('lyricsKeywordsPlaceholder') : '[intro]\n\n[verse]\n…\n\n[chorus]\n…'}
              className={`${CONTROL} resize-none font-mono text-xs leading-5`}
            />
            <p className="mt-2 text-[11px] leading-4 text-zinc-500">{mode === 'studio' ? t('lyricsHintAdvanced') : t('lyricsHint')}</p>
            {overBudget && <p className="mt-1 text-[11px] leading-4 text-rose-600 dark:text-rose-300">{t('promptTooLong')}</p>}
          </Card>
          )}

          {(mode === 'studio' || mode === 'instrumental') && (
            <Card
              title={t('stylesSection')}
              actions={
                <button type="button" onClick={() => setStylesText('')} className={ICON} title={t('resetPrompt')}>
                  <RotateCcw size={14} />
                </button>
              }
            >
              <AutoTextarea
                value={stylesText}
                minRows={3}
                onChange={event => setStylesText(event.target.value)}
                placeholder={t('stylesPlaceholder')}
                className={`${CONTROL} resize-none text-xs leading-5`}
              />
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {styleChipOrder.map((chip) => {
                  const selected = styleTextHasChip(stylesText, chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setStylesText((current) => toggleStyleInText(current, chip));
                        setStyleChipOrder(orderedStyleChips());
                      }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-brand bg-brand text-black'
                          : 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:border-brand dark:border-white/10 dark:bg-white/5 dark:text-zinc-200'
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{t('stylesHint')}</p>
              <p className="mt-1 text-[11px] leading-4 text-zinc-500">{t('stylesInstrumentHint')}</p>
            </Card>
          )}

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-suno-card">
            <button
              type="button"
              onClick={() => setCaptionOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('captionStructured')}</span>
              <span className="flex items-center gap-1">
                {assistantReady && captionOpen && (
                  <span
                    role="button"
                    tabIndex={assisting !== null || musicOccupiesGpu ? -1 : 0}
                    aria-disabled={assisting !== null || musicOccupiesGpu}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (assisting !== null || musicOccupiesGpu) return;
                      void writeAdvancedCaption();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (assisting !== null || musicOccupiesGpu) return;
                        void writeAdvancedCaption();
                      }
                    }}
                    className={`${ICON} ${(assisting !== null || musicOccupiesGpu) ? 'pointer-events-none opacity-40' : ''}`}
                    title={musicOccupiesGpu ? t('assistantWaitForMusic') : t('writeCaption')}
                  >
                    {assisting === 'prompt' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="text-brand" />}
                  </span>
                )}
                <ChevronDown size={15} className={`text-zinc-500 transition-transform ${captionOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {captionOpen && (
              <div className="space-y-3 border-t border-zinc-100 p-3 dark:border-white/5">
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={loadExample} className={ICON} title={t('examplePrompt')}><Dices size={14} /></button>
                  <button type="button" onClick={() => promptFile.current?.click()} className={ICON} title={t('openPrompt')}><FolderOpen size={14} /></button>
                  <button type="button" onClick={savePrompt} className={ICON} title={t('savePrompt')}><Save size={14} /></button>
                  <button type="button" onClick={reset} className={ICON} title={t('resetPrompt')}><RotateCcw size={14} /></button>
                  <input
                    ref={promptFile}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={event => { const file = event.target.files?.[0]; if (file) void openPrompt(file); event.target.value = ''; }}
                  />
                </div>
                <p className="text-[11px] leading-4 text-zinc-500">{t('captionStructuredHint')}</p>
                <p className="text-[11px] leading-4 text-zinc-500">{t('stylesInstrumentHint')}</p>
                <div className="space-y-2">
                  <Pane
                    label={t('globalMetadata')}
                    value={globalMetadata}
                    onChange={setGlobalMetadata}
                    placeholder={t('globalMetadataPlaceholder')}
                    onEnhance={assistantReady ? () => void enhanceCaptionSection('global') : undefined}
                    enhancing={enhancingSection === 'global'}
                    enhanceTitle={t('enhanceSection')}
                    enhanceDisabled={assisting !== null || musicOccupiesGpu}
                  />
                  <Pane
                    label={t('vocalDetails')}
                    value={vocalDetails}
                    onChange={setVocalDetails}
                    placeholder={t('vocalDetailsPlaceholder')}
                    onEnhance={assistantReady ? () => void enhanceCaptionSection('vocal') : undefined}
                    enhancing={enhancingSection === 'vocal'}
                    enhanceTitle={t('enhanceSection')}
                    enhanceDisabled={assisting !== null || musicOccupiesGpu}
                  />
                  <Pane
                    label={t('arrangementSection')}
                    value={arrangement}
                    onChange={setArrangement}
                    placeholder={t('arrangementPlaceholder')}
                    onEnhance={assistantReady ? () => void enhanceCaptionSection('arrangement') : undefined}
                    enhancing={enhancingSection === 'arrangement'}
                    enhanceTitle={t('enhanceSection')}
                    enhanceDisabled={assisting !== null || musicOccupiesGpu}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-suno-card">
            <button
              type="button"
              onClick={() => setShowAdvanced(current => !current)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
            >
              <span>{t('moreOptions')}</span>
              <span className="flex items-center gap-2">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); resetParameters(); setExcludeStyles(''); setVocalGender('auto'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); resetParameters(); setExcludeStyles(''); setVocalGender('auto'); } }}
                  className={ICON}
                  title={t('resetToDefaults')}
                >
                  <Trash2 size={14} />
                </span>
                <ChevronDown size={15} className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </span>
            </button>
            {showAdvanced && (
              <div className="space-y-4 border-t border-zinc-100 p-3 dark:border-white/5">
                <Field label={t('excludeStyles')}>
                  <input
                    value={excludeStyles}
                    onChange={(e) => setExcludeStyles(e.target.value)}
                    placeholder={t('excludeStylesPlaceholder')}
                    className={CONTROL}
                  />
                </Field>
                {mode !== 'instrumental' && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t('vocalGender')}</span>
                  <div className="flex rounded-lg border border-zinc-300 p-0.5 dark:border-white/10">
                    {(['auto', 'male', 'female'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setVocalGender(g);
                          if (g === 'auto') return;
                          const label = g === 'male' ? 'Male' : 'Female';
                          setVocalDetails((current) => {
                            const line = `Vocal Gender & Timbre: Singer A (${label}).`;
                            if (/Vocal Gender & Timbre:/i.test(current)) {
                              return current.replace(/Vocal Gender & Timbre:[^\n]*/i, line);
                            }
                            return current.trim() ? `${line}\n${current}` : line;
                          });
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${vocalGender === g ? 'bg-brand text-black' : 'text-zinc-500'}`}
                      >
                        {g === 'auto' ? t('songLanguageAuto') : g === 'male' ? t('male') : t('female')}
                      </button>
                    ))}
                  </div>
                </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t('maxDuration')}</span>
                    <div className="flex rounded-lg border border-zinc-300 p-0.5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setDuration('')}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${duration.trim() === '' ? 'bg-brand text-black' : 'text-zinc-500'}`}
                      >
                        {t('songLanguageAuto')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (duration.trim() === '') setDuration(String(defaults.duration ?? 60));
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${duration.trim() !== '' ? 'bg-brand text-black' : 'text-zinc-500'}`}
                      >
                        {t('durationCustom')}
                      </button>
                    </div>
                  </div>
                  {duration.trim() === '' ? (
                    <p className="text-[11px] leading-4 text-zinc-500">
                      {t('maxDurationAutoHint')} ({Number(defaults.duration ?? 60)} s)
                    </p>
                  ) : (
                    <>
                      <SliderRow
                        label={t('maxDuration')}
                        value={duration}
                        fallback={Number(defaults.duration ?? 60)}
                        min={10}
                        max={MAX_DURATION_SECONDS}
                        step={5}
                        suffix=" s"
                        onChange={setDuration}
                      />
                      <p className="text-[11px] leading-4 text-zinc-500">{t('maxDurationHint')}</p>
                    </>
                  )}
                </div>
                <SliderRow
                  label={t('ditSteps')}
                  value={steps}
                  fallback={Number(defaults.steps ?? 30)}
                  min={8}
                  max={80}
                  step={1}
                  onChange={setSteps}
                />
                <SliderRow
                  label={t('cfgScale')}
                  value={ditCfg}
                  fallback={Number(defaults.dit_cfg ?? 1.7)}
                  min={1}
                  max={5}
                  step={0.1}
                  onChange={setDitCfg}
                />
                <SliderRow
                  label={t('variationsBatch')}
                  value={synthBatch}
                  fallback={Number(defaults.synth_batch_size ?? 1)}
                  min={1}
                  max={4}
                  step={1}
                  onChange={setSynthBatch}
                />
                <Switch checked={randomizeSeed} onChange={setRandomizeSeed} label={t('randomizeSeed')} />
                {!randomizeSeed && (
                  <Field label={t('seedShort')}>
                    <input value={seed} onChange={event => setSeed(event.target.value)} placeholder={placeholder('seed')} inputMode="numeric" className={CONTROL} />
                  </Field>
                )}
                {totalTracks > 1 && (
                  <p className="text-[11px] text-zinc-500">{t('renderCountPrefix')} <b className="text-zinc-700 dark:text-zinc-200">{totalTracks}</b></p>
                )}
                <Stage title={t('stageLm')} hint={t('stageLmHint')}>
                  <div className="space-y-3">
                    <SliderRow label={t('cfgScale')} value={lmCfg} fallback={Number(defaults.lm_cfg ?? 1.5)} min={1} max={5} step={0.1} onChange={setLmCfg} />
                    <SliderRow label={t('topK')} value={lmTopK} fallback={Number(defaults.lm_top_k ?? 50)} min={1} max={200} step={1} onChange={setLmTopK} />
                    <Field label={t('lmSeedShort')}>
                      <input value={lmSeed} onChange={event => setLmSeed(event.target.value)} placeholder={placeholder('lm_seed')} inputMode="numeric" className={CONTROL} />
                    </Field>
                  </div>
                </Stage>
                <Stage title={t('stageOutput')} hint={t('stageOutputHint')}>
                  <SliderRow label={t('peakClipLabel')} value={peakClip} fallback={Number(defaults.peak_clip ?? 10)} min={0} max={30} step={1} onChange={setPeakClip} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Field label={t('mp3Bitrate')}>
                      <select value={mp3Bitrate || String(defaults.mp3_bitrate ?? 128)} onChange={event => setMp3Bitrate(event.target.value)} disabled={format !== 'mp3'} className={CONTROL}>
                        {['128', '192', '256', '320'].map(rate => <option key={rate} value={rate}>{rate} kbps</option>)}
                      </select>
                    </Field>
                    <Field label={t('outputFormat')}>
                      <select value={format} onChange={event => setFormat(event.target.value as Music3Request['output_format'])} className={CONTROL}>
                        <option value="mp3">MP3</option>
                        <option value="wav16">WAV16</option>
                        <option value="wav24">WAV24</option>
                        <option value="wav32">WAV32</option>
                      </select>
                    </Field>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-zinc-500">{t('peakClipHint')}</p>
                </Stage>
                <Stage title={t('componentOverride')} hint={t('componentOverrideHint')}>
                  <div className="space-y-2">
                    {roles.map(role => (
                      <div key={role.key} className="grid grid-cols-[64px_1fr] items-center gap-2">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{role.label}</span>
                        <select
                          value={models[role.key] ?? ''}
                          onChange={event => setModels(current => {
                            const next = { ...current };
                            if (event.target.value) next[role.key] = event.target.value;
                            else delete next[role.key];
                            return next;
                          })}
                          className={CONTROL}
                        >
                          <option value="">
                            {(() => {
                              const inUse = setup?.profile_files?.[role.key as keyof ProfileFiles];
                              return inUse ? `${t('profileDefault')} · ${inUse.replace('MiniMax-Music3-', '')}` : t('profileDefault');
                            })()}
                          </option>
                          {role.options.map(option => <option key={option} value={option}>{option.replace('MiniMax-Music3-', '')}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  {Object.keys(models).length > 0 && Object.keys(models).length < 5 && (
                    <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">{t('componentOverridePartial')}</p>
                  )}
                </Stage>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('mm3:open-settings', { detail: 'models' }))}
              className="text-left hover:text-brand"
              title={t('changeProfileHint')}
            >
              {t('profile')}: <b className="text-zinc-700 underline decoration-dotted underline-offset-2 dark:text-zinc-200">{profileLabel}</b>
            </button>
            <button type="button" onClick={() => void refreshSetup().catch(() => undefined)} className="hover:text-brand">{t('refresh')}</button>
          </div>
          {setup?.hardware?.reason && <p className="px-1 text-[10px] text-zinc-400">{setup.hardware.reason}</p>}
          {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-700 dark:text-red-200">{error}</div>}
        </div>
      </div>

      <footer className="shrink-0 border-t border-zinc-200 bg-zinc-50/95 p-4 backdrop-blur dark:border-white/5 dark:bg-suno-panel/95">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={activeJobCount >= 10}
          className={CTA_PRIMARY}
        >
          {isGenerating || activeJobCount > 0 ? (
            <Square size={18} />
          ) : (
            <Sparkles size={18} />
          )}
          {t('create')}
          {activeJobCount > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{activeJobCount}/10</span>}
        </button>
      </footer>
    </section>
  );
};
