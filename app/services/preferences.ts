/**
 * Local taste memory: liked / disliked tracks teach the writing assistant
 * what to lean toward and what to avoid — without fine-tuning Music3 itself.
 */

import { Song } from '../types';
import { captionSummary } from './examples';

export const LIKED_SONG_IDS_KEY = 'minimax-music3-native-liked-song-ids';
export const DISLIKED_SONG_IDS_KEY = 'minimax-music3-native-disliked-song-ids';

function loadIdSet(key: string): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, ids: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function loadLikedSongIds(): Set<string> {
  return loadIdSet(LIKED_SONG_IDS_KEY);
}

export function saveLikedSongIds(ids: Set<string>): void {
  saveIdSet(LIKED_SONG_IDS_KEY, ids);
}

export function loadDislikedSongIds(): Set<string> {
  return loadIdSet(DISLIKED_SONG_IDS_KEY);
}

export function saveDislikedSongIds(ids: Set<string>): void {
  saveIdSet(DISLIKED_SONG_IDS_KEY, ids);
}

/** Short, model-usable sketch of a track's musical identity. */
function preferenceSketch(song: Song): string {
  const summary = captionSummary(song.style || '').slice(0, 280).trim();
  const styleHead = (song.style || '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' | ')
    .slice(0, 320);
  const title = (song.title || 'untitled').slice(0, 60);
  const body = summary || styleHead || '(no caption)';
  return `"${title}": ${body}`;
}

/**
 * Instruction block appended to assistant writes so drafts follow the user's
 * thumbs-up / thumbs-down history. Empty when there is nothing to learn from.
 */
export function buildPreferenceInstruction(
  songs: Song[],
  likedIds: Set<string>,
  dislikedIds: Set<string>,
): string {
  const byId = new Map(songs.map((song) => [song.id, song]));
  const liked = [...likedIds]
    .map((id) => byId.get(id))
    .filter((song): song is Song => Boolean(song?.style?.trim()))
    .slice(0, 3);
  const disliked = [...dislikedIds]
    .map((id) => byId.get(id))
    .filter((song): song is Song => Boolean(song?.style?.trim()))
    .slice(0, 3);

  if (liked.length === 0 && disliked.length === 0) return '';

  const lines: string[] = [
    'User taste from this studio library (local likes/dislikes — follow these preferences):',
  ];
  if (liked.length > 0) {
    lines.push('LEAN TOWARD the energy, instrumentation density, vocal character, and production detail of these liked tracks (do not copy titles or lyric lines):');
    liked.forEach((song, index) => lines.push(`${index + 1}. ${preferenceSketch(song)}`));
  }
  if (disliked.length > 0) {
    lines.push('AVOID the thin/generic/empty arrangement patterns and sonic choices of these disliked tracks:');
    disliked.forEach((song, index) => lines.push(`${index + 1}. ${preferenceSketch(song)}`));
  }
  lines.push('Still invent a fresh song; preferences steer style and fullness, not plagiarism.');
  return lines.join('\n');
}
