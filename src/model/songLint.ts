import { MAX_FX_PER_TRACK, MAX_PATTERNS_PER_TRACK, MAX_TRACKS } from './constants';
import { migrateSong, SongFormatError, validateSong } from './schema';
import type { Song } from './types';

/**
 * Checks a song file the way the app reads it, plus the mistakes the app quietly fixes or
 * ignores (unknown sounds, blocks pointing nowhere, steps outside the pattern…). Used by
 * scripts/validate-song.mjs for songs made outside the app.
 */
export interface LintResult {
  /** the app would refuse to open the file */
  errors: string[];
  /** the file opens, but something is probably not what you meant */
  warnings: string[];
  song: Song | null;
}

export interface LintCatalog {
  /** built-in sound id → its root note (undefined for drum/FX sounds) */
  sounds: Map<string, number | undefined>;
  presetIds: Set<string>;
  /** `user:` sound ids shipped in the .zip next to the song */
  userSounds?: Set<string>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const id of ids) (seen.has(id) ? out : seen).add(id);
  return [...out];
}

export function lintSong(raw: unknown, catalog: LintCatalog): LintResult {
  let song: Song;
  try {
    song = validateSong(migrateSong(raw));
  } catch (e) {
    if (e instanceof SongFormatError) return { errors: [e.message], warnings: [], song: null };
    throw e;
  }
  const w: string[] = [];
  const rawTracks = isObj(raw) ? list(raw.tracks) : [];

  if (song.tracks.length > MAX_TRACKS)
    w.push(
      `The song has ${song.tracks.length} tracks; the editor is built for up to ${MAX_TRACKS}.`,
    );
  for (const id of dupes(song.tracks.map((t) => t.id)))
    w.push(`Two or more tracks share the id "${id}". Track ids must be unique.`);

  song.tracks.forEach((t, ti) => {
    const at = `tracks[${ti}] "${t.name}"`;
    const rawT = isObj(rawTracks[ti]) ? (rawTracks[ti] as Obj) : {};

    // things validateSong drops without saying so
    const rawBlocks = list(rawT.blocks);
    if (rawBlocks.length > t.blocks.length) {
      const ids = new Set(t.patterns.map((p) => p.id));
      for (const b of rawBlocks)
        if (isObj(b) && !ids.has(str(b.patternId)))
          w.push(
            `${at}: block "${str(b.id)}" points to pattern "${str(b.patternId)}", which isn't on this track, so it's dropped.`,
          );
    }
    const rawLanes = list(rawT.automation);
    if (rawLanes.length > t.automation.length)
      w.push(
        `${at}: ${rawLanes.length - t.automation.length} automation lane(s) point to an effect or lane that isn't on this track, so they're dropped.`,
      );
    if (isObj(rawT.duck) && !t.duck)
      w.push(
        `${at}: duck.sourceId "${str(rawT.duck.sourceId)}" isn't another track in this song, so the pump is removed.`,
      );

    // ids and limits
    if (t.patterns.length > MAX_PATTERNS_PER_TRACK)
      w.push(
        `${at}: ${t.patterns.length} patterns; the editor allows up to ${MAX_PATTERNS_PER_TRACK}.`,
      );
    if (t.fx.length > MAX_FX_PER_TRACK)
      w.push(`${at}: ${t.fx.length} effects; the editor allows up to ${MAX_FX_PER_TRACK}.`);
    for (const [what, ids] of [
      ['patterns', t.patterns.map((p) => p.id)],
      ['blocks', t.blocks.map((b) => b.id)],
      ['effects', t.fx.map((f) => f.id)],
      ['automation lanes', t.automation.map((l) => l.id)],
    ] as const)
      for (const id of dupes(ids)) w.push(`${at}: two or more ${what} share the id "${id}".`);

    // sounds and presets
    if (t.sample) {
      const id = t.sample.sampleId;
      if (id.startsWith('user:')) {
        if (!catalog.userSounds?.has(id))
          w.push(
            `${at}: "${id}" is one of your own sounds, but it isn't in this file. Ship it in a .zip (samples/index.json) or the track stays silent.`,
          );
      } else if (!catalog.sounds.has(id)) {
        w.push(`${at}: there's no built-in sound "${id}", so this track stays silent.`);
      } else {
        const root = catalog.sounds.get(id);
        if (t.sample.melodic && root !== undefined && root !== t.sample.rootMidi)
          w.push(
            `${at}: "${id}" was recorded at MIDI ${root}, but rootMidi is ${t.sample.rootMidi}, so notes play out of tune.`,
          );
      }
      if (t.sample.edit.end <= t.sample.edit.start)
        w.push(`${at}: sample.edit.end should be after sample.edit.start, or nothing plays.`);
    }
    if (t.synth && !catalog.presetIds.has(t.synth.presetId))
      w.push(
        `${at}: there's no synth preset "${t.synth.presetId}", so it plays as the first preset (warm-bass).`,
      );

    // patterns
    const usesNotes = t.kind === 'synth' || !!t.sample?.melodic;
    for (const p of t.patterns) {
      const pat = `${at} pattern "${p.name}"`;
      const total = p.lengthBars * p.stepsPerBar;
      if (usesNotes && p.steps.length && !p.notes.length)
        w.push(
          `${pat}: has steps but no notes. ${t.kind === 'synth' ? 'Synth' : 'Melodic sample'} tracks play notes, so it's silent.`,
        );
      if (!usesNotes && p.notes.length && !p.steps.length)
        w.push(
          `${pat}: has notes but no steps. Drum tracks play steps (set sample.melodic to true to play notes).`,
        );
      const bad = p.steps.filter((s) => s.index >= total || !Number.isInteger(s.index));
      if (bad.length)
        w.push(
          `${pat}: ${bad.length} step(s) have an index outside 0–${total - 1} or aren't whole numbers, so they never play.`,
        );
      for (const i of dupes(p.steps.map((s) => String(s.index))))
        w.push(`${pat}: step ${i} is listed more than once.`);
      const late = p.notes.filter((n) => n.start >= total || !Number.isInteger(n.start));
      if (late.length)
        w.push(
          `${pat}: ${late.length} note(s) start outside 0–${total - 1} or aren't on a step, so they never play.`,
        );
      if (p.notes.some((n) => !Number.isInteger(n.degree)))
        w.push(`${pat}: note degrees should be whole numbers.`);
      if (!/^[A-Z]$/.test(p.name)) w.push(`${pat}: the app names patterns with one letter, A–Z.`);
    }

    // timeline
    const pats = new Map(t.patterns.map((p) => [p.id, p]));
    for (const b of t.blocks) {
      if (!Number.isInteger(b.startBar))
        w.push(`${at}: block "${b.id}" startBar should be a whole bar.`);
      if (b.startBar >= song.lengthBars)
        w.push(
          `${at}: block "${b.id}" starts at bar ${b.startBar}, after the song ends (lengthBars ${song.lengthBars}), so it never plays.`,
        );
      else if (b.startBar + (pats.get(b.patternId)?.lengthBars ?? 1) > song.lengthBars)
        w.push(`${at}: block "${b.id}" runs past the end of the song and is cut off.`);
    }

    // automation
    const targets = new Set<string>();
    for (const l of t.automation) {
      const lane = `${at} lane "${l.id}"`;
      const key = JSON.stringify(l.target);
      if (targets.has(key))
        w.push(`${lane}: another lane on this track already has the same target.`);
      targets.add(key);
      if (l.points.some((pt, i) => i > 0 && pt.bar < l.points[i - 1]!.bar))
        w.push(`${lane}: points should be sorted by bar.`);
      if (l.points.some((pt) => pt.bar > song.lengthBars))
        w.push(`${lane}: some points are after the end of the song.`);
      if (l.mode === 'lfo' && !l.lfo)
        w.push(`${lane}: mode is "lfo" but there are no lfo settings, so defaults are used.`);
      if (l.target.kind === 'synthMacro' && t.kind !== 'synth')
        w.push(`${lane}: synth macro lanes only work on synth tracks.`);
      if (l.target.kind === 'sampleTone' && t.kind !== 'sample')
        w.push(`${lane}: sampleTone lanes only work on sample tracks.`);
      if (l.target.kind === 'lfo') {
        const id = l.target.laneId;
        const src = t.automation.find((x) => x.id === id);
        if (src && src.mode !== 'lfo')
          w.push(`${lane}: lane "${id}" isn't a wobble (mode "lfo"), so this does nothing.`);
      }
    }
  });

  if (!song.tracks.some((t) => t.blocks.length))
    w.push('No track has any blocks on the timeline, so the song is silent in Song mode.');

  return { errors: [], warnings: w, song };
}
