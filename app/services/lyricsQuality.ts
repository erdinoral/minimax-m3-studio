/** A second writing pass for English drafts only; other languages keep their existing path. */
type GenreCue = { pattern: RegExp; guide: string };

/** Auto defaults to English only when the user has not requested another sung language. */
export function useEnglishLyricsCraft(language: string, styles: string, seed: string): boolean {
  if (language === 'en') return true;
  if (language !== 'auto' || seed.trim()) return false;
  return !/\b(turkish|türkçe|turkce|russian|japanese|chinese|korean|spanish|french|german|italian|arabic|portuguese|hindi)\b/i.test(styles);
}

// Original craft observations, not a database of published lyrics or artist imitations.
const GENRE_CUES: GenreCue[] = [
  { pattern: /\b(phonk|drift phonk|memphis phonk)\b/i, guide: `Phonk: write for a chopped, repeated vocal phrase over a beat, not a long gothic rock ballad. Use sparse, percussive English, one concrete scene or attitude, and a two-to-six-word refrain that can survive repetition. Keep verses short and leave room for the track. Cowbell, bass, tempo and energy are production directions, never sung lyric words. Avoid stock darkness/ghost/venom/underground imagery unless the user's own brief specifically calls for it.

Original micro-examples of vocal economy (not songs to quote; invent different words and images for this track):
Example A: [verse] / Rain on the side glass / Missed the last exit / [chorus] / Keep it moving / Keep it moving
Example B: [verse] / Phone face down / Engine still warm / [chorus] / Don't look back / Don't look back` },
  { pattern: /\b(hip[- ]?hop|rap|trap|drill)\b/i, guide: 'Hip-hop/rap: use a distinct speaking voice, internal rhythm and punchy line endings; advance the scene or argument with each bar. Avoid filler flexes and borrowed catchphrases. Original fragment for cadence only: "You kept the receipt / I kept the address / neither of us went back."' },
  { pattern: /\b(r&b|rnb|soul|neo[- ]?soul)\b/i, guide: 'R&B/soul: write intimate, conversational lines with room for held vowels and a compact emotional refrain. Let subtext and small physical details carry the feeling. Original fragment: "Your cup is still here / I wash around it."' },
  { pattern: /\b(country|americana|folk)\b/i, guide: 'Country/folk: anchor the story in a believable place, object or action; make each verse change the situation. Earn the chorus with a plainspoken turn instead of a stock slogan. Original fragment: "The porch bulb burned till morning / I finally took the spare key down."' },
  { pattern: /\b(punk|pop[- ]?punk)\b/i, guide: 'Punk/pop-punk: favour direct, urgent language, short breath-length lines and a chantable chorus. Keep the attitude specific rather than stacking generic rebellion phrases. Original fragment: "We wrote our names on the shutdown notice / crossed them out at dawn."' },
  { pattern: /\b(metal|grunge|hard[- ]?rock)\b/i, guide: 'Heavy rock/metal: use decisive images and strong stressed words that survive a loud arrangement; contrast narrative verses with a concise repeatable refrain. Original fragment: "I held the door against the water / heard the hinges give."' },
  { pattern: /\b(rock)\b/i, guide: 'Rock: centre a human decision or conflict rather than a list of loud-sound adjectives; give the chorus a clean line that can be shouted without losing meaning. Original fragment: "I left the radio running / so the house would sound alive."' },
  { pattern: /\b(house|dance|edm|disco|electronic|synthpop|techno|trance)\b/i, guide: 'Dance/electronic: keep the central vocal phrase short and rhythmically repeatable; use verses for one vivid moment, not dense exposition over a beat. Original fragment: "The room goes blue / I see you move / stay till the lights come up."' },
  { pattern: /\b(reggaeton|dembow|latin[- ]?pop|bachata)\b/i, guide: 'Latin dance: favour a playful, embodied exchange and a concise rhythmic response; avoid random Spanish words as decoration when the song language is English. Original fragment: "You take one step / I take two back / then we meet in the middle."' },
  { pattern: /\b(afrobeats?|afropop|amapiano)\b/i, guide: 'Afropop/amapiano: use light, conversational phrasing and a buoyant call-and-response hook with space between lines; avoid invented slang or cultural clichés. Original fragment: "Call when you get there / I will leave the light on."' },
  { pattern: /\b(lo[- ]?fi|chillhop|bedroom[- ]?pop)\b/i, guide: 'Lo-fi/bedroom pop: use an ordinary intimate detail and unhurried lines; avoid filling every bar with words or repeating a generic "late-night" mood. Original fragment: "The kettle clicks off / I let the message wait."' },
  { pattern: /\b(shoegaze|dream[- ]?pop|ambient|trip[- ]?hop)\b/i, guide: 'Atmospheric styles: keep a few concrete images and a spare recurring phrase that leaves room for texture; do not write a dense plot or empty surreal word salad. Original fragment: "The hallway light stays on / long after you leave."' },
  { pattern: /\b(cinematic|orchestral|soundtrack|classical)\b/i, guide: 'Cinematic/orchestral vocal: build a clear emotional turn with fewer, durable lines rather than narrating every musical swell; if instrumental, do not invent sung words. Original fragment: "The bridge is still standing / though the road is gone."' },
  { pattern: /\b(arabesque)\b/i, guide: 'Arabesque in English: use direct emotional address, a specific wound or absence, and a refrain that can bear a long held note; avoid translating stock melodrama word for word. Original fragment: "I kept your chair beside the window / though you never came."' },
  { pattern: /\b(reggae|dub|ska)\b/i, guide: 'Reggae/ska: let the lyric carry a clear perspective and an easy repeated answer; do not reduce the genre to beaches or generic peace slogans. Original fragment: "They closed the gate at sunrise / we found another way through."' },
  { pattern: /\b(blues)\b/i, guide: 'Blues: build a concrete complaint or wry observation, then turn the final line rather than repeating a generic sad adjective. Original fragment: "My landlord fixed the window / now the cold comes through the floor."' },
  { pattern: /\b(jazz|swing)\b/i, guide: 'Jazz/swing vocal: allow conversational phrasing, a precise image and a small twist that leaves room for syncopation. Original fragment: "I ordered coffee for two / and drank the second one slowly."' },
  { pattern: /\b(gospel)\b/i, guide: 'Gospel: move from specific struggle to a communal, singable answer; make the refrain affirmative without vague inspirational filler. Original fragment: "One voice from the back row / then every hand rose up."' },
  { pattern: /\b(funk)\b/i, guide: 'Funk: favour short playful phrases, a conversational call-and-response and rhythmic gaps; keep the hook physical but not a list of instruments. Original fragment: "You say wait / I say watch / the whole room turns."' },
  { pattern: /\b(indie|alternative|alt[- ]?pop)\b/i, guide: 'Indie/alternative: allow an unusual but clear image and a slightly conversational turn; avoid vague melancholy and make the hook emotionally legible on first listen. Original fragment: "You labelled every box / except the one with our photographs."' },
  { pattern: /\b(ballad|acoustic|singer[- ]?songwriter)\b/i, guide: 'Ballad/acoustic: leave space for a small revealing detail and a restrained refrain; emotional intensity should grow from the story, not from larger adjectives. Original fragment: "I learned your new address / from a card I never sent."' },
  { pattern: /\b(pop)\b/i, guide: 'Pop: establish the core emotional situation quickly, use plain memorable words in the chorus, and make repeated hooks identical while verses add fresh detail. Original fragment: "I had the words ready / till you walked in smiling."' },
];

export function englishGenreLyricGuide(styles: string): string {
  const cues = GENRE_CUES.filter(cue => cue.pattern.test(styles)).slice(0, 2);
  return [
    'Genre-aware songwriting direction (derive original craft, never quote or closely imitate an existing song or artist):',
    ...(cues.length ? cues.map(cue => cue.guide) : ['Choose a specific narrator, scene and emotional turn that fit the stated style; give the chorus one concise repeatable idea. Original fragment for specificity only: "I found your note under the seat / after I sold the car."']),
    'All fragments above were written for this app. They demonstrate line economy and specificity only: never repeat, paraphrase, or continue their wording in the new song.',
  ].join('\n');
}

export function englishLyricsPolishInstruction(draft: string, styles: string, durationSeconds: number): string {
  return [
    'Edit the following English song lyrics as a songwriter, not as a producer. Return complete lyrics only in the lyrics field.',
    'Give the chorus one short, concrete, memorable hook line. Keep that exact hook line in every repeated chorus.',
    'Make each verse reveal a new image, action, or turn in the story; do not restate the chorus in different words.',
    'Replace generic emotions, stock phrases and forced rhymes with specific, natural English. Prefer clear vowels, conversational stress and lines that can be sung in one breath.',
    'Keep the existing section tags, their order and the approximate number of lines per section. Do not add production notes or change the song language.',
    `Keep the words comfortably within ${Math.round(durationSeconds)} seconds; put the main payoff in a chorus, not only in the outro.`,
    styles.trim() ? `Sound and emotional direction:\n${styles.trim()}` : '',
    englishGenreLyricGuide(styles),
    `Draft to edit:\n${draft.trim()}`,
  ].filter(Boolean).join('\n\n');
}

const sectionTags = (lyrics: string): string[] => lyrics.match(/^\s*\[[a-z][a-z0-9-]*\]\s*$/gim)?.map(tag => tag.trim().toLowerCase()) ?? [];

/** Reject an edit that silently drops or reorders parts the caption must follow. */
export function usableEnglishLyricsEdit(original: string, edited: string): boolean {
  if (!edited.trim() || edited.length > original.length * 1.6) return false;
  const before = sectionTags(original);
  const after = sectionTags(edited);
  return before.length > 0 && before.length === after.length && before.every((tag, index) => tag === after[index]);
}
