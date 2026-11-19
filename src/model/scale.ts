import type { ScaleName, SongKey } from './types';

export const SCALES: Record<ScaleName, { label: string; intervals: readonly number[] }> = {
  major: { label: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  dorian: { label: 'dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { label: 'mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  harmonicMinor: { label: 'harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  majorPentatonic: { label: 'major pentatonic', intervals: [0, 2, 4, 7, 9] },
  minorPentatonic: { label: 'minor pentatonic', intervals: [0, 3, 5, 7, 10] },
};

export const SCALE_ORDER: ScaleName[] = [
  'minor',
  'major',
  'dorian',
  'mixolydian',
  'harmonicMinor',
  'minorPentatonic',
  'majorPentatonic',
];

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
/** Roots (for major-type keys) conventionally spelled with flats. */
const FLAT_MAJOR_ROOTS = new Set([5, 10, 3, 8, 1, 6]);

export const ROOT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function scaleLength(scale: ScaleName): number {
  return SCALES[scale].intervals.length;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Scale degree → MIDI note. Degree 0 is the key root in octave 3 (C3 = MIDI 48). */
export function degreeToMidi(degree: number, key: SongKey): number {
  const iv = SCALES[key.scale].intervals;
  const n = iv.length;
  const octave = Math.floor(degree / n);
  return 48 + key.root + octave * 12 + iv[mod(degree, n)]!;
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function usesFlats(key: SongKey): boolean {
  const minorish =
    key.scale === 'minor' ||
    key.scale === 'dorian' ||
    key.scale === 'harmonicMinor' ||
    key.scale === 'minorPentatonic';
  const relMajor = minorish ? mod(key.root + 3, 12) : key.root;
  return FLAT_MAJOR_ROOTS.has(relMajor);
}

export function midiName(midi: number, key?: SongKey): string {
  const names = key && usesFlats(key) ? FLAT_NAMES : SHARP_NAMES;
  return `${names[mod(midi, 12)]}${Math.floor(midi / 12) - 1}`;
}

export function keyLabel(key: SongKey): string {
  return `${ROOT_NAMES[key.root]} ${SCALES[key.scale].label}`;
}
