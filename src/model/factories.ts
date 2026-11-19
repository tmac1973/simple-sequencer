import { nanoid } from 'nanoid';
import { DEFAULT_BPM, DEFAULT_SONG_BARS, TRACK_COLORS } from './constants';
import type {
  AutomationLane,
  AutomationTarget,
  FxSlot,
  FxType,
  Pattern,
  PatternLength,
  SampleEdit,
  Song,
  StepsPerBar,
  SynthMacros,
  Track,
} from './types';

export const newId = (): string => nanoid(10);

export const DEFAULT_SAMPLE_EDIT: SampleEdit = {
  start: 0,
  end: 1,
  reverse: false,
  loop: false,
  loopStart: 0,
  tuneSemitones: 0,
  fadeOut: 0,
  normalize: false,
};

export const DEFAULT_MACROS: SynthMacros = { tone: 0.55, punch: 0.5, space: 0.2, length: 0.5 };

export function createSong(init: Partial<Omit<Song, 'format' | 'version'>> = {}): Song {
  const now = Date.now();
  return {
    format: 'simple-sequencer-song',
    version: 1,
    id: init.id ?? newId(),
    name: init.name ?? 'Untitled song',
    bpm: init.bpm ?? DEFAULT_BPM,
    swing: init.swing ?? 0,
    key: init.key ?? { root: 0, scale: 'minor' },
    lengthBars: init.lengthBars ?? DEFAULT_SONG_BARS,
    tracks: init.tracks ?? [],
    createdAt: init.createdAt ?? now,
    updatedAt: init.updatedAt ?? now,
  };
}

export function createPattern(init: Partial<Pattern> = {}): Pattern {
  return {
    id: init.id ?? newId(),
    name: init.name ?? 'A',
    lengthBars: (init.lengthBars ?? 1) as PatternLength,
    stepsPerBar: (init.stepsPerBar ?? 16) as StepsPerBar,
    steps: init.steps ?? [],
    notes: init.notes ?? [],
  };
}

export function nextColor(existing: Track[]): string {
  const used = new Set(existing.map((t) => t.color));
  return (
    TRACK_COLORS.find((c) => !used.has(c)) ?? TRACK_COLORS[existing.length % TRACK_COLORS.length]!
  );
}

interface TrackInit {
  name?: string;
  color?: string;
  volumeDb?: number;
  pan?: number;
  patterns?: Pattern[];
}

function baseTrack(kind: Track['kind'], init: TrackInit, existing: Track[]): Track {
  return {
    id: newId(),
    name: init.name ?? (kind === 'synth' ? 'Synth' : 'Drum'),
    color: init.color ?? nextColor(existing),
    kind,
    volumeDb: init.volumeDb ?? 0,
    pan: init.pan ?? 0,
    mute: false,
    solo: false,
    patterns: init.patterns ?? [createPattern()],
    blocks: [],
    fx: [],
    automation: [],
  };
}

export function createSampleTrack(
  init: TrackInit & { sampleId?: string; melodic?: boolean; rootMidi?: number } = {},
  existing: Track[] = [],
): Track {
  return {
    ...baseTrack('sample', init, existing),
    sample: {
      sampleId: init.sampleId ?? 'dev:kick',
      melodic: init.melodic ?? false,
      rootMidi: init.rootMidi ?? 60,
      edit: { ...DEFAULT_SAMPLE_EDIT },
      tone: 1,
    },
  };
}

export function createSynthTrack(
  init: TrackInit & { presetId?: string; macros?: Partial<SynthMacros> } = {},
  existing: Track[] = [],
): Track {
  return {
    ...baseTrack('synth', { name: 'Bass', ...init }, existing),
    synth: {
      presetId: init.presetId ?? 'warm-bass',
      macros: { ...DEFAULT_MACROS, ...init.macros },
      advanced: {},
    },
  };
}

/** First unused letter A–Z, or null when all 26 are taken. */
export function nextPatternName(patterns: Pattern[]): string | null {
  const used = new Set(patterns.map((p) => p.name));
  for (let i = 0; i < 26; i++) {
    const n = String.fromCharCode(65 + i);
    if (!used.has(n)) return n;
  }
  return null;
}

export function createFxSlot(type: FxType, params: Record<string, number> = {}): FxSlot {
  return { id: newId(), type, enabled: true, params: { ...params } };
}

export function createLane(
  target: AutomationTarget,
  points: AutomationLane['points'] = [],
): AutomationLane {
  return { id: newId(), target, points, visible: true };
}

/** Deep copy of a track with fresh ids (pattern references remapped). */
export function cloneTrackWithNewIds(track: Track): Track {
  const copy: Track = structuredClone(track);
  copy.id = newId();
  const map = new Map<string, string>();
  for (const p of copy.patterns) {
    const nid = newId();
    map.set(p.id, nid);
    p.id = nid;
  }
  for (const b of copy.blocks) {
    b.id = newId();
    b.patternId = map.get(b.patternId) ?? b.patternId;
  }
  const fxMap = new Map<string, string>();
  for (const f of copy.fx) {
    const nid = newId();
    fxMap.set(f.id, nid);
    f.id = nid;
  }
  for (const l of copy.automation) {
    l.id = newId();
    if (l.target.kind === 'fx')
      l.target = { ...l.target, fxId: fxMap.get(l.target.fxId) ?? l.target.fxId };
  }
  copy.solo = false;
  return copy;
}
