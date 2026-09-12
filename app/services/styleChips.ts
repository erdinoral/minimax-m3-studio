/** Curated style chips — click appends into the writable Styles field. */
export const STYLE_CHIPS: string[] = [
  'keman',
  'kpop girl group',
  '1940s',
  'hula',
  'female vocals',
  'male vocals',
  'phonk',
  'synthwave',
  'lo-fi',
  'jazz',
  'acoustic guitar',
  'electric guitar',
  'piano',
  'orchestra',
  'trap drums',
  '808 bass',
  'cowbell',
  'disco',
  'metal',
  'R&B',
  'ballad',
  'hip hop',
  'ambient',
  'cinematic',
  'folk',
  'salsa',
  'turkish pop',
  'arabesque',
  'choir',
  'saxophone',
  'distorted bass',
];

const USAGE_KEY = 'mm3.styleChipUsage.v1';

type ChipUsage = { count: number; lastUsed: number };
type UsageMap = Record<string, ChipUsage>;

function styleTokens(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function chipKey(chip: string): string {
  return chip.trim().toLowerCase();
}

function readUsage(): UsageMap {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UsageMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeUsage(map: UsageMap) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(map));
  } catch {
    // private mode / quota — ignore
  }
}

/** Bump recency + frequency when a chip is added (not when removed). */
export function recordStyleChipUse(chip: string) {
  const key = chipKey(chip);
  if (!key) return;
  const map = readUsage();
  const prev = map[key];
  map[key] = {
    count: (prev?.count ?? 0) + 1,
    lastUsed: Date.now(),
  };
  writeUsage(map);
}

/** Record every known chip currently present in the Styles field (e.g. on Create). */
export function recordStylesTextChips(text: string) {
  const tokens = new Set(styleTokens(text).map(chipKey));
  for (const chip of STYLE_CHIPS) {
    if (tokens.has(chipKey(chip))) recordStyleChipUse(chip);
  }
}

/**
 * Preset chips ordered: recently used first, then most used, then catalog order.
 * Custom free-text tags are not listed here — only STYLE_CHIPS.
 */
export function orderedStyleChips(catalog: string[] = STYLE_CHIPS): string[] {
  const usage = readUsage();
  const index = new Map(catalog.map((chip, i) => [chipKey(chip), i]));
  return [...catalog].sort((a, b) => {
    const ua = usage[chipKey(a)];
    const ub = usage[chipKey(b)];
    const la = ua?.lastUsed ?? 0;
    const lb = ub?.lastUsed ?? 0;
    if (la !== lb) return lb - la;
    const ca = ua?.count ?? 0;
    const cb = ub?.count ?? 0;
    if (ca !== cb) return cb - ca;
    return (index.get(chipKey(a)) ?? 0) - (index.get(chipKey(b)) ?? 0);
  });
}

export function styleTextHasChip(text: string, chip: string): boolean {
  const needle = chipKey(chip);
  return styleTokens(text).some((part) => chipKey(part) === needle);
}

/** Add or remove a preset chip inside free-form styles text (comma-separated tags). */
export function toggleStyleInText(text: string, chip: string): string {
  const parts = styleTokens(text);
  const idx = parts.findIndex((part) => chipKey(part) === chipKey(chip));
  if (idx >= 0) {
    parts.splice(idx, 1);
    return parts.join(', ');
  }
  recordStyleChipUse(chip);
  parts.push(chip);
  return parts.join(', ');
}

/** Merge the Styles field into the caption sent to the engine. */
export function appendStylesToCaption(caption: string, stylesText: string): string {
  const styles = stylesText.trim();
  if (!styles) return caption.trim();
  const block = /^styles\s*:/i.test(styles) ? styles : `Styles: ${styles}`;
  const base = caption.trim();
  const withStyles = base ? `${base}\n${block}` : block;
  const expanded = expandStylesForCaption(styles);
  if (!expanded) return withStyles;
  return `${withStyles}\nInstrument lock (from Styles — must be audible):\n${expanded}`;
}

/**
 * Split a stored library caption back into structured caption vs Styles chips.
 * Engine requests append `Styles:` / instrument-lock blocks; details UI shows them apart.
 */
export function splitStoredCaption(stored: string): { caption: string; styles: string } {
  const text = (stored || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { caption: '', styles: '' };

  const stylesLine = text.match(/^Styles:\s*(.+)$/im);
  const styles = stylesLine?.[1]?.trim() ?? '';

  let caption = text
    .replace(/^Styles:\s*.+$/im, '')
    .replace(/\n+Instrument lock \(from Styles[\s\S]*$/i, '')
    .replace(/\n+Exclude:\s*.+$/im, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!caption && !styles) return { caption: text, styles: '' };
  return { caption, styles };
}

/**
 * Weak style tags → concrete MiniMax caption constraints so the engine hears
 * the instrument instead of swallowing it into "generic drums".
 * Keys are lower-case; matching is token or substring against Styles text.
 */
const STYLE_EXPANSIONS: Record<string, string> = {
  cowbell:
    'Required percussion: dry metallic cowbell as a primary groove accent on offbeats and/or every beat in the chorus; name "cowbell" explicitly in Instrument Lifecycle (Primary or Secondary) and in Sonics & Production Profile — do not replace with generic percussion, shaker, or woodblock.',
  '808 bass':
    'Required bass: deep 808 sub-bass with long decay and audible pitch; name "808" in Primary layer and Sonics — do not substitute a soft round synth bass only.',
  '808':
    'Required bass: deep 808 sub-bass with long decay and audible pitch; name "808" in Primary layer and Sonics — do not substitute a soft round synth bass only.',
  keman:
    'Required lead/melody color: expressive violin (keman) with bowed phrases; name "violin" or "keman" in Instrument Lifecycle and Sonics — do not replace with generic strings pad only.',
  violin:
    'Required lead/melody color: expressive violin with bowed phrases; name "violin" in Instrument Lifecycle and Sonics — do not replace with generic strings pad only.',
  saxophone:
    'Required wind: saxophone lead or hook lines; name "saxophone" in Instrument Lifecycle and Sonics — do not replace with generic brass stabs only.',
  'acoustic guitar':
    'Required guitar: acoustic guitar as a clear rhythmic or melodic layer; name "acoustic guitar" in Instrument Lifecycle — do not replace with electric only.',
  'electric guitar':
    'Required guitar: electric guitar with defined tone; name "electric guitar" in Instrument Lifecycle — keep it audible in listed sections.',
  piano:
    'Required keys: piano as a clear harmonic or melodic voice; name "piano" in Instrument Lifecycle — do not replace with anonymous pad only.',
  'trap drums':
    'Required drums: trap kit (crisp hats, hard kicks, snappy snares); name trap drum elements in Groove & Foundation — do not flatten into soft indie drums.',
  'distorted bass':
    'Required bass: distorted / overdriven bass as a primary low-end character; name "distorted bass" in Primary layer and Sonics.',
  choir:
    'Required voices/texture: choir or stacked vocal pads where arrangement allows; name "choir" in Secondary layer or Vocal/Harmony — do not omit after promising it in Styles.',
  orchestra:
    'Required ensemble: orchestral layers (strings/brass/woodwinds as fits the genre); name orchestral instruments in Instrument Lifecycle — do not reduce to a single pad.',
};

/**
 * Build HARD instrument constraint lines from Styles tokens / free text.
 * Empty string when nothing matched.
 */
export function expandStylesForCaption(stylesText: string): string {
  const raw = stylesText.trim();
  if (!raw) return '';
  const lowered = raw.toLowerCase();
  const tokens = new Set(styleTokens(raw).map(chipKey));
  const lines: string[] = [];
  const seen = new Set<string>();

  const add = (key: string, line: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`- ${line}`);
  };

  // Longer keys first so "808 bass" wins over bare "808".
  const keys = Object.keys(STYLE_EXPANSIONS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const expansion = STYLE_EXPANSIONS[key];
    if (tokens.has(key) || lowered.includes(key)) {
      add(key, expansion);
    }
  }
  return lines.join('\n');
}
