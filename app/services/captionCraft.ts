/** Ground enrichment in the actual lyric sequence, including repeated choruses. */
export function captionCraftInstruction(lyrics: string, duration?: string): string {
  const sections = Array.from(lyrics.matchAll(/^\s*\[([a-z][a-z0-9-]*)\]\s*$/gim), match => match[1].toLowerCase());
  const counts: Record<string, number> = {};
  const timeline = sections.map(section => `${section} #${counts[section] = (counts[section] || 0) + 1}`).join(' → ');
  const seconds = Number(duration);
  return [
    'Melody is the priority: define one short, singable lead motif or instrumental hook in plain musical terms. Specify its rhythmic placement, ascending/descending/repeated contour, phrase length and a clear response phrase. Do not invent exact pitches, key, interval names or time stamps when the user did not provide them.',
    'Carry the same recognizable motif from verse to chorus; make the chorus hook more memorable through register, phrasing or rhythmic emphasis, not by switching genre. Let the bridge contrast and the final chorus resolve or intensify the motif.',
    'For vocals, align the strongest melodic accent with the lyrical hook and leave enough breath between phrases. For instrumental music assign the hook only to an instrument already named or stylistically natural; do not request vocals.',
    'Enrichment means specific musical decisions, not a longer list of adjectives. Give the hook a concrete rhythmic or melodic role and evolve it within the requested style.',
    'Give each existing section an energy level, foreground instrument, bass/percussion behavior and transition into the next section. Describe instrument entries/exits and vocal delivery changes. Keep these decisions consistent across all three fields.',
    'Repeated choruses retain the same hook and identity, with deliberate changes in density, backing vocals or register when the brief permits. Do not make every section a maximum-energy climax.',
    'Describe spatial placement and dynamics in plain musical language; avoid contradictory mixes such as simultaneously dry/intimate and huge/reverberant unless separated by section.',
    'Preserve the supplied lyrics and explicit constraints. Do not invent extra genres, instruments, named artists, exact key or exact BPM. Do not treat moods or lyrics as measured audio characteristics.',
    timeline ? `Authoritative section order (each occurrence matters): ${timeline}. Cover every occurrence in this order; do not add, remove or rearrange lyric sections.` : 'No tagged lyric timeline is supplied: do not claim a measured section structure.',
    Number.isFinite(seconds) && seconds > 0 ? `Duration ceiling: ${seconds} seconds. Keep the plan feasible inside this ceiling; no fake precise section timestamps.` : '',
  ].filter(Boolean).join('\n\n');
}
