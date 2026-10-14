import { describe, expect, it } from 'vitest';
import { captionCraftInstruction } from './captionCraft';

describe('caption enrichment grounding', () => {
  it('keeps repeated sections in their original order without copying lyrics', () => {
    const instruction = captionCraftInstruction('[verse]\nprivate line\n[chorus]\nhook\n[verse]\nline\n[chorus]\nhook', '60');
    expect(instruction).toContain('verse #1 → chorus #1 → verse #2 → chorus #2');
    expect(instruction).toContain('60 seconds');
    expect(instruction).not.toContain('private line');
    expect(instruction).toContain('ascending/descending/repeated contour');
    expect(instruction).toContain('chorus hook');
  });
  it('does not invent section timings or accept malformed tags as a timeline', () => {
    const instruction = captionCraftInstruction('[verse] sung words', 'invalid');
    expect(instruction).toContain('No tagged lyric timeline');
    expect(instruction).not.toContain('Duration ceiling:');
  });
});
