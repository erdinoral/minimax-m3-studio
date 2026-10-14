import { describe, expect, it } from 'vitest';
import { englishGenreLyricGuide, englishLyricsPolishInstruction, usableEnglishLyricsEdit, useEnglishLyricsCraft } from './lyricsQuality';

describe('English lyric polish', () => {
  const draft = '[verse]\nA road at night\n\n[chorus]\nI come home';

  it('asks for a stable chorus hook and singable English', () => {
    const instruction = englishLyricsPolishInstruction(draft, 'indie folk', 60);
    expect(instruction).toContain('exact hook line in every repeated chorus');
    expect(instruction).toContain('natural English');
    expect(instruction).toContain('indie folk');
  });

  it('accepts an edit only when its section timeline stays intact', () => {
    expect(usableEnglishLyricsEdit(draft, '[verse]\nThe porch light burns\n\n[chorus]\nI come home')).toBe(true);
    expect(usableEnglishLyricsEdit(draft, '[chorus]\nI come home\n\n[verse]\nThe porch light burns')).toBe(false);
    expect(usableEnglishLyricsEdit(draft, '')).toBe(false);
  });

  it('adapts craft to the named genre without borrowing published lyrics', () => {
    expect(englishGenreLyricGuide('country americana')).toContain('believable place');
    expect(englishGenreLyricGuide('synthpop dance')).toContain('rhythmically repeatable');
    expect(englishGenreLyricGuide('indie folk')).toContain('unusual but clear image');
    expect(englishGenreLyricGuide('indie folk')).not.toContain('Hip-hop/rap');
    const phonk = englishGenreLyricGuide('drift phonk');
    expect(phonk).toContain('Original micro-examples');
    expect(phonk).toContain('Cowbell, bass, tempo and energy are production directions');
    expect(englishGenreLyricGuide('deep house')).not.toContain('Original micro-examples');
    expect(englishGenreLyricGuide('lo-fi bedroom pop')).toContain('kettle clicks off');
    expect(englishGenreLyricGuide('unlisted microgenre')).toContain('specific narrator');
  });

  it('leaves other-language and supplied lyric drafts out of the English-only path', () => {
    expect(useEnglishLyricsCraft('en', 'phonk', '')).toBe(true);
    expect(useEnglishLyricsCraft('auto', 'phonk', '')).toBe(true);
    expect(useEnglishLyricsCraft('auto', 'Turkish phonk', '')).toBe(false);
    expect(useEnglishLyricsCraft('auto', 'phonk', 'özledim')).toBe(false);
    expect(useEnglishLyricsCraft('tr', 'phonk', '')).toBe(false);
  });
});
