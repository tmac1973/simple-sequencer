import type { SynthAdvanced, SynthMacros } from '@/model/types';
import type { SynthPreset } from './synthPresets';

export interface ResolvedSynth extends SynthAdvanced {
  /** post-synth lowpass ("Tone" macro) */
  toneCutoffHz: number;
  /** "Space" reverb wet */
  spaceWet: number;
}

const expMap = (v: number, lo: number, hi: number) => lo * (hi / lo) ** v;

export const toneToHz = (v: number) => expMap(v, 200, 12000);
export const spaceToWet = (v: number) => v * 0.45;

/**
 * Turn preset + friendly macros (+ any Advanced overrides) into concrete synth parameters.
 * - Tone: cutoff 200 Hz → 12 kHz (exponential)
 * - Punch: attack slow → fast, filter-envelope 0 → 3 octaves
 * - Space: reverb wet 0 → 0.45
 * - Length: decay 0.1 → 2 s, release 0.05 → 3 s
 */
export function resolveSynthParams(
  preset: SynthPreset,
  m: SynthMacros,
  adv: Partial<SynthAdvanced>,
): ResolvedSynth {
  const [slow, fast] = preset.attackRange;
  const base: ResolvedSynth = {
    oscType: preset.oscType,
    attack: expMap(m.punch, slow, fast),
    decay: expMap(m.length, 0.1, 2) * preset.lengthScale,
    sustain: preset.sustain,
    release: expMap(m.length, 0.05, 3) * preset.lengthScale,
    filterCutoffHz: preset.filterCutoffHz,
    filterQ: preset.filterQ,
    filterEnvAmount: m.punch * 3,
    vibratoRate: preset.vibratoRate ?? 5,
    vibratoDepth: preset.vibratoDepth ?? 0,
    glide: preset.glide ?? 0,
    toneCutoffHz: toneToHz(m.tone),
    spaceWet: spaceToWet(m.space),
  };
  return { ...base, ...stripUndefined(adv) };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
