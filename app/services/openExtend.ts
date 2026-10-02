import type { Song } from '../types';

/** Open the Extend dialog for a library track that carries its audio codes. */
export function openExtendSong(song: Song): void {
  window.dispatchEvent(new CustomEvent('mm3:extend-song', { detail: song }));
}
