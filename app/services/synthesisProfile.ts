import type { Music3Request } from '../types';

/** Only controls the engine really accepts. Model precision is chosen in Model Manager. */
export type SynthesisProfile = 'fast' | 'standard' | 'lossless' | 'custom';
type AudioFormat = Music3Request['output_format'];
const PROFILES: Record<Exclude<SynthesisProfile, 'custom'>, { steps: string; format: AudioFormat }> = {
  fast: { steps: '16', format: 'mp3' },
  standard: { steps: '30', format: 'mp3' },
  lossless: { steps: '30', format: 'wav24' },
};

export function synthesisProfileValues(profile: SynthesisProfile) {
  return profile === 'custom' ? null : PROFILES[profile];
}

export function currentSynthesisProfile(steps: string, format: AudioFormat): SynthesisProfile {
  const effectiveSteps = steps.trim() || '30';
  if (effectiveSteps === '16' && format === 'mp3') return 'fast';
  if (effectiveSteps === '30' && format === 'mp3') return 'standard';
  if (effectiveSteps === '30' && format === 'wav24') return 'lossless';
  return 'custom';
}
