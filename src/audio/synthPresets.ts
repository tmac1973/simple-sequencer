import type { OscType } from '@/model/types';
import { registerPresetNames } from '@/library/presetNames';

export type PresetCategory = 'bass' | 'keys' | 'pad' | 'lead' | 'pluck';

export interface SynthPreset {
  id: string;
  name: string;
  category: PresetCategory;
  oscType: OscType;
  sustain: number;
  /** base cutoff of each voice's own filter (opened by the filter envelope) */
  filterCutoffHz: number;
  filterQ: number;
  /** attack seconds at Punch 0 → Punch 1 */
  attackRange: [number, number];
  /** multiplies the Length macro's decay/release */
  lengthScale: number;
  polyphonic: boolean;
  octaveShift: number;
  glide?: number;
  vibratoDepth?: number;
  vibratoRate?: number;
}

export const PRESETS: SynthPreset[] = [
  {
    id: 'warm-bass',
    name: 'Warm Bass',
    category: 'bass',
    oscType: 'sawtooth',
    sustain: 0.7,
    filterCutoffHz: 110,
    filterQ: 2,
    attackRange: [0.03, 0.002],
    lengthScale: 0.7,
    polyphonic: false,
    octaveShift: -1,
    glide: 0.01,
  },
  {
    id: 'sub-bass',
    name: 'Sub Bass',
    category: 'bass',
    oscType: 'sine',
    sustain: 0.9,
    filterCutoffHz: 900,
    filterQ: 0.5,
    attackRange: [0.02, 0.003],
    lengthScale: 0.8,
    polyphonic: false,
    octaveShift: -1,
  },
  {
    id: 'reese-bass',
    name: 'Reese Bass',
    category: 'bass',
    oscType: 'fatsawtooth',
    sustain: 0.8,
    filterCutoffHz: 140,
    filterQ: 3,
    attackRange: [0.04, 0.004],
    lengthScale: 0.8,
    polyphonic: false,
    octaveShift: -1,
  },
  {
    id: 'dusty-keys',
    name: 'Dusty Keys',
    category: 'keys',
    oscType: 'triangle',
    sustain: 0.35,
    filterCutoffHz: 700,
    filterQ: 1,
    attackRange: [0.03, 0.002],
    lengthScale: 1,
    polyphonic: true,
    octaveShift: 0,
    vibratoDepth: 0.05,
    vibratoRate: 4,
  },
  {
    id: 'electric-piano',
    name: 'Electric Piano',
    category: 'keys',
    oscType: 'fmsine',
    sustain: 0.25,
    filterCutoffHz: 1500,
    filterQ: 0.7,
    attackRange: [0.02, 0.001],
    lengthScale: 1.2,
    polyphonic: true,
    octaveShift: 0,
  },
  {
    id: 'soft-pad',
    name: 'Soft Pad',
    category: 'pad',
    oscType: 'fatsawtooth',
    sustain: 0.85,
    filterCutoffHz: 350,
    filterQ: 1,
    attackRange: [0.9, 0.12],
    lengthScale: 1.6,
    polyphonic: true,
    octaveShift: 0,
  },
  {
    id: 'soft-pluck',
    name: 'Soft Pluck',
    category: 'pluck',
    oscType: 'triangle',
    sustain: 0,
    filterCutoffHz: 500,
    filterQ: 1.5,
    attackRange: [0.01, 0.001],
    lengthScale: 0.6,
    polyphonic: true,
    octaveShift: 1,
  },
  {
    id: 'bright-lead',
    name: 'Bright Lead',
    category: 'lead',
    oscType: 'sawtooth',
    sustain: 0.6,
    filterCutoffHz: 1200,
    filterQ: 2,
    attackRange: [0.03, 0.002],
    lengthScale: 0.8,
    polyphonic: false,
    octaveShift: 1,
    glide: 0.03,
    vibratoDepth: 0.1,
    vibratoRate: 5,
  },
  {
    id: 'bell',
    name: 'Bell',
    category: 'pluck',
    oscType: 'fmsine',
    sustain: 0,
    filterCutoffHz: 3000,
    filterQ: 0.7,
    attackRange: [0.01, 0.001],
    lengthScale: 1.8,
    polyphonic: true,
    octaveShift: 1,
  },
  {
    id: 'retro-square',
    name: 'Retro Square',
    category: 'lead',
    oscType: 'square',
    sustain: 0.5,
    filterCutoffHz: 2500,
    filterQ: 0.7,
    attackRange: [0.01, 0.001],
    lengthScale: 0.6,
    polyphonic: false,
    octaveShift: 0,
  },
];

export const CATEGORY_LABEL: Record<PresetCategory, string> = {
  bass: 'Bass',
  keys: 'Keys',
  pad: 'Pads',
  lead: 'Leads',
  pluck: 'Plucks & bells',
};

export function getPreset(id: string): SynthPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
}

registerPresetNames(PRESETS.map((p) => [p.id, p.name]));
