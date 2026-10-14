import { describe, expect, it } from 'vitest';
import { currentSynthesisProfile, synthesisProfileValues } from './synthesisProfile';

describe('synthesis profiles', () => {
  it('keeps the engine-supported 30-step default and changes actual output format', () => {
    expect(currentSynthesisProfile('', 'mp3')).toBe('standard');
    expect(synthesisProfileValues('lossless')).toEqual({ steps: '30', format: 'wav24' });
    expect(synthesisProfileValues('standard')).toEqual({ steps: '30', format: 'mp3' });
  });
  it('does not claim that an arbitrary step count is a quality preset', () => {
    expect(currentSynthesisProfile('50', 'mp3')).toBe('custom');
    expect(currentSynthesisProfile('30', 'wav32')).toBe('custom');
  });
});
