import type { Song } from '../types';

/** Navigate Create → Cover with this library track as the reference. */
export function openCoverFromSong(song: Song): void {
  window.dispatchEvent(new CustomEvent('mm3:cover-from-song', { detail: song }));
}
