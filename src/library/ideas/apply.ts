import { MAX_PATTERNS_PER_TRACK, MAX_SONG_BARS, MAX_TRACKS } from '@/model/constants';
import { createPattern, createSampleTrack, createSynthTrack, newId } from '@/model/factories';
import { SCALES } from '@/model/scale';
import { blockAt } from '@/model/timing';
import type { Note, Pattern, ScaleName, Song, Track } from '@/model/types';
import { usesNotes } from '@/audio/scheduler';
import {
  isDrumCategory,
  KIT_NAMES,
  KITS,
  PARTS,
  partLabel,
  type DrumPart,
  type IdeaCategory,
  type KitId,
  type PatternIdea,
} from './model';

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Ideas are written for 7-note scales. For a 5-note (pentatonic) key, move each note to the
 * nearest note of that scale so it still sounds right.
 */
export function fitDegree(degree: number, scale: ScaleName): number {
  const iv = SCALES[scale].intervals;
  if (iv.length === 7) return degree;
  const parent = SCALES[scale === 'majorPentatonic' ? 'major' : 'minor'].intervals;
  const semis = Math.floor(degree / 7) * 12 + parent[mod(degree, 7)]!;
  const n = iv.length;
  let best = 0;
  let bestDist = Infinity;
  for (let d = Math.floor(degree / 7) * n - n; d <= Math.floor(degree / 7) * n + 2 * n; d++) {
    const s = Math.floor(d / n) * 12 + iv[mod(d, n)]!;
    const dist = Math.abs(s - semis);
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

export function fitNotes(notes: Note[], scale: ScaleName): Note[] {
  const seen = new Set<string>();
  const out: Note[] = [];
  for (const n of notes) {
    const degree = fitDegree(n.degree, scale);
    const k = `${n.start}:${degree}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...n, degree });
  }
  return out;
}

const PART_BY_ID: [RegExp, DrumPart][] = [
  [/hat-open/, 'openhat'],
  [/analog-perc-hat|-rim|808-tick/, 'rim'],
  [/crash|splash|elec-cymbal/, 'crash'],
  [/tambourine/, 'tambourine'],
  [/claves/, 'clave'],
  [/bongo/, 'bongo'],
  [/agogo/, 'cowbell'],
  [/-kick|808-boom|808-zum/, 'kick'],
  [/-snare/, 'snare'],
  [/clap|snap/, 'clap'],
  [/-hat/, 'hat'],
  [/tom-hi/, 'tomhi'],
  [/tom/, 'tom'],
  [/ride/, 'ride'],
  [/cowbell/, 'cowbell'],
  [/shaker|cabasa/, 'shaker'],
  [/bong|conga/, 'conga'],
];

const PART_BY_NAME: [RegExp, DrumPart][] = [
  [/open/, 'openhat'],
  [/crash|splash/, 'crash'],
  [/tamb/, 'tambourine'],
  [/clave/, 'clave'],
  [/bongo/, 'bongo'],
  [/kick|\bbd\b|bass ?drum/, 'kick'],
  [/snare|\bsd\b/, 'snare'],
  [/clap|snap/, 'clap'],
  [/hat|\bhh\b/, 'hat'],
  [/rim|stick/, 'rim'],
  [/high tom|hi tom/, 'tomhi'],
  [/tom/, 'tom'],
  [/ride|cymbal/, 'ride'],
  [/shak/, 'shaker'],
  [/conga|bong/, 'conga'],
  [/cowbell|bell/, 'cowbell'],
];

/** Which kit part a drum track plays: its sound's category first, then its name. */
export function partOfTrack(t: Track): DrumPart | null {
  if (t.kind !== 'sample' || !t.sample || t.sample.melodic) return null;
  const id = t.sample.sampleId;
  if (id.startsWith('lib:')) for (const [re, p] of PART_BY_ID) if (re.test(id)) return p;
  const name = t.name.toLowerCase();
  for (const [re, p] of PART_BY_NAME) if (re.test(name)) return p;
  return null;
}

/** The bundled kit most of the song's drums come from. */
export function songKit(song: Song): KitId | null {
  const count = new Map<KitId, number>();
  for (const t of song.tracks) {
    const m = /^lib:(dusty|808|club|analog)-/.exec(t.sample?.sampleId ?? '');
    if (m && partOfTrack(t)) count.set(m[1] as KitId, (count.get(m[1] as KitId) ?? 0) + 1);
  }
  let best: KitId | null = null;
  for (const [k, n] of count) if (!best || n > count.get(best)!) best = k;
  return best;
}

/** Synth used when a note idea needs a new track. */
const NEW_NOTE_TRACK: Record<
  Exclude<IdeaCategory, 'groove' | 'fill' | 'perc'>,
  { name: string; presetId: string }
> = {
  bass: { name: 'Bass', presetId: 'warm-bass' },
  chords: { name: 'Keys', presetId: 'electric-piano' },
  melody: { name: 'Lead', presetId: 'soft-pluck' },
};

export interface PartAssignment {
  part: DrumPart;
  label: string;
  /** existing track, or null = a new track will be added */
  trackId: string | null;
  trackName: string;
  /** sound for a new track */
  sampleId?: string;
}

export interface IdeaPlan {
  ideaId: string;
  mode: 'use' | 'new';
  /** the pattern letter written on every involved track */
  patternName: string;
  /** drum ideas: part → track */
  parts: PartAssignment[];
  /** drum parts left out because the song already has 16 tracks */
  skipped: DrumPart[];
  /** note ideas: the track that gets the notes (null = new synth track) */
  noteTrack?: { trackId: string | null; trackName: string; presetId?: string };
  /** the kit new drum tracks come from */
  kit?: KitId;
  /** why the idea can't be applied (shown instead of the buttons) */
  problem?: string;
}

export interface Selection {
  trackId: string | null;
  patternId: string | null;
}

function firstFreeLetter(tracks: Track[]): string | null {
  const used = new Set(tracks.flatMap((t) => t.patterns.map((p) => p.name)));
  for (let i = 0; i < 26; i++) {
    const n = String.fromCharCode(65 + i);
    if (!used.has(n)) return n;
  }
  return null;
}

/** Work out exactly what applying an idea would do, without changing anything. */
export function planIdea(
  song: Song,
  idea: PatternIdea,
  sel: Selection,
  mode: 'use' | 'new',
): IdeaPlan {
  const selTrack = song.tracks.find((t) => t.id === sel.trackId) ?? null;
  const selPattern =
    selTrack?.patterns.find((p) => p.id === sel.patternId) ?? selTrack?.patterns[0];
  const plan: IdeaPlan = {
    ideaId: idea.id,
    mode,
    patternName: selPattern?.name ?? 'A',
    parts: [],
    skipped: [],
  };
  let involved: Track[] = [];
  let slots = MAX_TRACKS - song.tracks.length;

  if (isDrumCategory(idea.category)) {
    const kit = songKit(song) ?? idea.kit ?? 'dusty';
    plan.kit = kit;
    const taken = new Set<string>();
    for (const { id: part } of PARTS) {
      if (!idea.parts?.[part]) continue;
      const matches = song.tracks.filter((t) => partOfTrack(t) === part && !taken.has(t.id));
      const t = matches.find((x) => x.id === selTrack?.id) ?? matches[0];
      if (t) {
        taken.add(t.id);
        involved.push(t);
        plan.parts.push({ part, label: partLabel(part), trackId: t.id, trackName: t.name });
      } else if (slots > 0) {
        slots--;
        plan.parts.push({
          part,
          label: partLabel(part),
          trackId: null,
          trackName: partLabel(part),
          sampleId: KITS[kit][part],
        });
      } else plan.skipped.push(part);
    }
    if (plan.parts.length === 0)
      plan.problem = 'The song is full (16 tracks), so there is no room for new drum tracks.';
  } else {
    if (selTrack && usesNotes(selTrack)) {
      involved = [selTrack];
      plan.noteTrack = { trackId: selTrack.id, trackName: selTrack.name };
    } else if (slots > 0) {
      const nt = NEW_NOTE_TRACK[idea.category as keyof typeof NEW_NOTE_TRACK];
      plan.noteTrack = { trackId: null, trackName: nt.name, presetId: nt.presetId };
      plan.patternName = 'A';
    } else
      plan.problem =
        'Pick a synth or melodic track first (the song is full, so a new one can’t be added).';
  }

  if (mode === 'new') {
    const letter = firstFreeLetter(involved);
    if (!letter || involved.some((t) => t.patterns.length >= MAX_PATTERNS_PER_TRACK))
      plan.problem ??= 'These tracks already use every pattern letter. Use “replace” instead.';
    plan.patternName = letter ?? plan.patternName;
  }
  return plan;
}

/** Re-lay back-to-back blocks of a pattern after its length changed, so it still plays fully. */
function respaceBlocks(t: Track, patternId: string, oldLen: number, newLen: number) {
  const mine = t.blocks
    .filter((b) => b.patternId === patternId)
    .sort((a, b) => a.startBar - b.startBar);
  if (mine.length === 0) return;
  const others = t.blocks.filter((b) => b.patternId !== patternId);
  const out: Track['blocks'] = [];
  let i = 0;
  while (i < mine.length) {
    let j = i;
    while (j + 1 < mine.length && mine[j + 1]!.startBar === mine[j]!.startBar + oldLen) j++;
    const start = mine[i]!.startBar;
    const end = mine[j]!.startBar + oldLen;
    for (let s = start; s < end; s += newLen) out.push({ id: newId(), patternId, startBar: s });
    i = j + 1;
  }
  t.blocks = [...others, ...out].sort((a, b) => a.startBar - b.startBar);
}

function writePattern(
  t: Track,
  name: string,
  idea: PatternIdea,
  song: Song,
  part?: DrumPart,
): Pattern {
  let p = t.patterns.find((x) => x.name === name);
  const oldLen = p?.lengthBars;
  if (!p) {
    p = createPattern({ name });
    t.patterns.push(p);
  }
  p.lengthBars = idea.bars;
  p.stepsPerBar = idea.grid;
  p.steps = part ? (idea.parts?.[part] ?? []).map((s) => ({ ...s })) : [];
  p.notes = part ? [] : fitNotes(idea.notes ?? [], song.key.scale);
  if (oldLen !== undefined && oldLen !== idea.bars) respaceBlocks(t, p.id, oldLen, idea.bars);
  return p;
}

function paintAt(t: Track, patternId: string, bar: number, len: number) {
  if (t.blocks.some((b) => b.startBar === bar && b.patternId === patternId)) return;
  t.blocks = t.blocks.filter((b) => b.startBar < bar || b.startBar >= bar + len);
  t.blocks.push({ id: newId(), patternId, startBar: bar });
  t.blocks.sort((a, b) => a.startBar - b.startBar);
}

export interface ApplyResult {
  /** trackId → the pattern the idea was written into */
  patterns: Record<string, string>;
  /** the track to show in the editor afterwards */
  focusTrackId: string;
  addedTrackIds: string[];
}

/**
 * Apply a plan to a song in place (call it inside an Immer recipe so it's one undo step).
 * Drum ideas line the kit up on the timeline: wherever one of its tracks already plays the
 * pattern, the others play it too; if it isn't placed yet, it goes in at the first bar where
 * all of its tracks are free.
 */
export function applyIdea(
  song: Song,
  idea: PatternIdea,
  plan: IdeaPlan,
  opts: { setFeel: boolean; selectedTrackId?: string | null },
): ApplyResult | null {
  if (plan.problem) return null;
  const result: ApplyResult = { patterns: {}, focusTrackId: '', addedTrackIds: [] };

  if (opts.setFeel) {
    const [lo, hi] = idea.bpm;
    if (song.bpm < lo || song.bpm > hi) song.bpm = Math.round((lo + hi) / 2);
    song.swing = idea.swing ?? 0;
  }

  if (plan.noteTrack) {
    let t = song.tracks.find((x) => x.id === plan.noteTrack!.trackId);
    if (!t) {
      t = createSynthTrack(
        { name: plan.noteTrack.trackName, presetId: plan.noteTrack.presetId, patterns: [] },
        song.tracks,
      );
      song.tracks.push(t);
      t = song.tracks[song.tracks.length - 1]!;
      result.addedTrackIds.push(t.id);
    }
    const p = writePattern(t, plan.patternName, idea, song);
    result.patterns[t.id] = p.id;
    result.focusTrackId = t.id;
    return result;
  }

  const involved: Track[] = [];
  let insertAt = song.tracks.reduce((at, t, i) => (partOfTrack(t) ? i + 1 : at), 0);
  for (const a of plan.parts) {
    let t = song.tracks.find((x) => x.id === a.trackId);
    if (!t) {
      if (song.tracks.length >= MAX_TRACKS) continue;
      const nt = createSampleTrack(
        { name: a.trackName, sampleId: a.sampleId, patterns: [] },
        song.tracks,
      );
      song.tracks.splice(insertAt, 0, nt);
      t = song.tracks[insertAt]!;
      insertAt++;
      result.addedTrackIds.push(t.id);
    }
    const p = writePattern(t, plan.patternName, idea, song, a.part);
    result.patterns[t.id] = p.id;
    involved.push(t);
  }

  // line the kit up on the timeline
  const anchors = new Set<number>();
  if (plan.mode === 'use')
    for (const t of involved)
      for (const b of t.blocks) if (b.patternId === result.patterns[t.id]) anchors.add(b.startBar);
  if (anchors.size === 0) {
    for (let s = 0; s + idea.bars <= MAX_SONG_BARS; s++) {
      let free = true;
      for (const t of involved)
        for (let b = s; b < s + idea.bars && free; b++) if (blockAt(t, b)) free = false;
      if (free) {
        anchors.add(s);
        break;
      }
    }
  }
  for (const bar of anchors) {
    for (const t of involved) paintAt(t, result.patterns[t.id]!, bar, idea.bars);
    song.lengthBars = Math.min(MAX_SONG_BARS, Math.max(song.lengthBars, bar + idea.bars));
  }

  result.focusTrackId =
    involved.find((t) => t.id === opts.selectedTrackId)?.id ?? involved[0]?.id ?? '';
  return result;
}

/**
 * A small stand-alone song that loops just the idea on the tracks it would use, with the song's
 * own sounds, effects and key. Nothing in the real song changes.
 */
export function buildPreviewSong(
  song: Song,
  idea: PatternIdea,
  plan: IdeaPlan,
  setFeel: boolean,
): Song | null {
  const copy: Song = structuredClone(song);
  const r = applyIdea(copy, idea, plan, { setFeel });
  if (!r) return null;
  const tracks = copy.tracks
    .filter((t) => r.patterns[t.id])
    .map((t) => ({
      ...t,
      mute: false,
      solo: false,
      automation: [],
      blocks: [{ id: newId(), patternId: r.patterns[t.id]!, startBar: 0 }],
    }));
  return { ...copy, tracks, lengthBars: idea.bars };
}

/** Plain-English description of where things go, for the apply bar. */
export function describeKit(plan: IdeaPlan): string {
  return plan.kit ? KIT_NAMES[plan.kit] : '';
}
