/** The file extension a stored song downloads with, from the media type the studio served it as. */
export function audioExtension(mediaType: string): string {
  const type = mediaType.split(';')[0].trim().toLowerCase();
  if (type === 'audio/flac' || type === 'audio/x-flac') return 'flac';
  if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave') return 'wav';
  return 'mp3';
}
