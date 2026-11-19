import type { Note, PatternLength, Step, StepsPerBar } from '@/model/types';

/**
 * A "pattern idea" is a ready-made pattern a beginner can drop into their song. Drum ideas are
 * made of kit parts (kick, snare, …) that get matched to the song's drum tracks. Basslines,
 * chords and melodies are stored as scale steps, like every note in the app, so they fit any key.
 */

export type IdeaCategory = 'groove' | 'fill' | 'perc' | 'bass' | 'chords' | 'melody';

export const IDEA_CATEGORIES: { id: IdeaCategory; label: string; drums: boolean }[] = [
  { id: 'groove', label: '🥁 Drum grooves', drums: true },
  { id: 'fill', label: '💥 Fills & builds', drums: true },
  { id: 'perc', label: '🪘 Percussion', drums: true },
  { id: 'bass', label: '〰️ Basslines', drums: false },
  { id: 'chords', label: '🎹 Chords', drums: false },
  { id: 'melody', label: '🎵 Melodies', drums: false },
];

export const isDrumCategory = (c: IdeaCategory) => c === 'groove' || c === 'fill' || c === 'perc';

export type Genre =
  | 'hiphop'
  | 'lofi'
  | 'trap'
  | 'house'
  | 'disco'
  | 'electronic'
  | 'dnb'
  | 'triphop'
  | 'funk'
  | 'rock'
  | 'blues'
  | 'jazz'
  | 'reggae'
  | 'latin'
  | 'pop';

export const GENRES: { id: Genre; label: string }[] = [
  { id: 'hiphop', label: 'Hip-hop' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'trap', label: 'Trap' },
  { id: 'house', label: 'House' },
  { id: 'disco', label: 'Disco' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'dnb', label: 'Drum & bass' },
  { id: 'triphop', label: 'Trip-hop' },
  { id: 'funk', label: 'Funk' },
  { id: 'rock', label: 'Rock' },
  { id: 'blues', label: 'Blues' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'reggae', label: 'Reggae' },
  { id: 'latin', label: 'Latin' },
  { id: 'pop', label: 'Pop' },
];

export type DrumPart =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'openhat'
  | 'rim'
  | 'tom'
  | 'tomhi'
  | 'ride'
  | 'shaker'
  | 'conga'
  | 'cowbell';

/** Display order and names for parts (also the name of a track created for a part). */
export const PARTS: { id: DrumPart; label: string }[] = [
  { id: 'kick', label: 'Kick' },
  { id: 'snare', label: 'Snare' },
  { id: 'clap', label: 'Clap' },
  { id: 'hat', label: 'Hi-hat' },
  { id: 'openhat', label: 'Open hat' },
  { id: 'rim', label: 'Rim' },
  { id: 'tom', label: 'Low tom' },
  { id: 'tomhi', label: 'High tom' },
  { id: 'ride', label: 'Ride' },
  { id: 'shaker', label: 'Shaker' },
  { id: 'conga', label: 'Conga' },
  { id: 'cowbell', label: 'Cowbell' },
];

export const partLabel = (p: DrumPart) => PARTS.find((x) => x.id === p)!.label;

export type KitId = 'dusty' | '808' | 'club' | 'analog';

/** The sound used when a part needs a new track, per bundled kit. */
export const KITS: Record<KitId, Record<DrumPart, string>> = {
  dusty: {
    kick: 'lib:dusty-kick',
    snare: 'lib:dusty-snare',
    clap: 'lib:dusty-snap',
    hat: 'lib:dusty-hat',
    openhat: 'lib:dusty-hat-open',
    rim: 'lib:808-rim',
    tom: 'lib:dusty-tom-lo',
    tomhi: 'lib:dusty-tom-hi',
    ride: 'lib:dusty-ride',
    shaker: 'lib:club-perc-shaker',
    conga: 'lib:club-perc-bong',
    cowbell: 'lib:dusty-cowbell',
  },
  '808': {
    kick: 'lib:808-kick',
    snare: 'lib:808-snare',
    clap: 'lib:808-clap',
    hat: 'lib:808-hat',
    openhat: 'lib:808-hat-open',
    rim: 'lib:808-rim',
    tom: 'lib:808-tom',
    tomhi: 'lib:dusty-tom-hi',
    ride: 'lib:dusty-ride',
    shaker: 'lib:club-perc-shaker',
    conga: 'lib:club-perc-bong',
    cowbell: 'lib:dusty-cowbell',
  },
  club: {
    kick: 'lib:club-kick',
    snare: 'lib:club-snare',
    clap: 'lib:club-clap',
    hat: 'lib:club-hat',
    openhat: 'lib:club-hat-open',
    rim: 'lib:808-rim',
    tom: 'lib:dusty-tom-lo',
    tomhi: 'lib:dusty-tom-hi',
    ride: 'lib:dusty-ride',
    shaker: 'lib:club-perc-shaker',
    conga: 'lib:club-perc-bong',
    cowbell: 'lib:dusty-cowbell',
  },
  analog: {
    kick: 'lib:analog-kick',
    snare: 'lib:analog-snare',
    clap: 'lib:analog-clap',
    hat: 'lib:analog-hat',
    openhat: 'lib:analog-hat-open',
    rim: 'lib:analog-perc-hat',
    tom: 'lib:808-tom',
    tomhi: 'lib:dusty-tom-hi',
    ride: 'lib:dusty-ride',
    shaker: 'lib:club-perc-shaker',
    conga: 'lib:club-perc-bong',
    cowbell: 'lib:dusty-cowbell',
  },
};

export const KIT_NAMES: Record<KitId, string> = {
  dusty: 'Dusty Kit',
  '808': '808 Kit',
  club: 'Club Kit',
  analog: 'Analog Kit',
};

export interface PatternIdea {
  id: string;
  name: string;
  category: IdeaCategory;
  genres: Genre[];
  /** one short plain-English line */
  description: string;
  /** suggested tempo range */
  bpm: [number, number];
  /** suggested swing (0–0.75); omitted = straight */
  swing?: number;
  bars: PatternLength;
  grid: StepsPerBar;
  /** drum ideas: hits per kit part */
  parts?: Partial<Record<DrumPart, Step[]>>;
  /** note ideas: scale steps of a 7-note scale (0 = key root, octave 3) */
  notes?: Note[];
  /** ids of ideas that go well with this one */
  pairsWith?: string[];
  /** the kit to use for new tracks when the song has no drums yet */
  kit?: KitId;
}

const VEL: Record<string, number> = { X: 1, x: 0.85, o: 0.6, g: 0.3 };

/**
 * Parse a drum line: one character per step. `X` loud, `x` normal, `o` medium, `g` ghost,
 * `1`–`9` = 10–90% velocity, `.` rest. Spaces and `|` are only for readability.
 */
export function hitsOf(line: string): Step[] {
  const steps: Step[] = [];
  [...line.replace(/[\s|]/g, '')].forEach((ch, index) => {
    if (ch === '.') return;
    const v = VEL[ch] ?? (/[1-9]/.test(ch) ? Number(ch) / 10 : NaN);
    if (Number.isNaN(v)) throw new Error(`Bad drum character "${ch}" in "${line}"`);
    steps.push({ index, velocity: v });
  });
  return steps;
}

/** Number of steps a drum line spans (for validation). */
export const lineLength = (line: string) => line.replace(/[\s|]/g, '').length;

export interface DrumIdeaSpec extends Omit<PatternIdea, 'parts' | 'notes' | 'bars' | 'grid'> {
  bars?: PatternLength;
  grid?: StepsPerBar;
  lines: Partial<Record<DrumPart, string>>;
}

/** Build a drum idea; throws if a line doesn't fill the pattern exactly. */
export function drumIdea(spec: DrumIdeaSpec): PatternIdea {
  const { lines, ...rest } = spec;
  const bars = spec.bars ?? 1;
  const grid = spec.grid ?? 16;
  const parts: Partial<Record<DrumPart, Step[]>> = {};
  for (const [part, line] of Object.entries(lines) as [DrumPart, string][]) {
    if (lineLength(line) !== bars * grid)
      throw new Error(
        `${spec.id}: ${part} line has ${lineLength(line)} steps, expected ${bars * grid}`,
      );
    parts[part] = hitsOf(line);
  }
  return { ...rest, bars, grid, parts };
}

/** [start, length, degree, velocity?] */
export type NoteTuple = [number, number, number, number?];

export const notesOf = (list: NoteTuple[], vel = 0.8): Note[] =>
  list.map(([start, length, degree, v]) => ({ start, length, degree, velocity: v ?? vel }));

/** Several chords: each entry is [start, length, degrees[]]. */
export function chordsOf(list: [number, number, number[]][], vel = 0.65): Note[] {
  return list.flatMap(([start, length, degrees]) =>
    degrees.map((degree) => ({ start, length, degree, velocity: vel })),
  );
}
