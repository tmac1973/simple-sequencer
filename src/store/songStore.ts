import { create } from 'zustand';
import type { Draft } from 'immer';
import {
  MAX_BPM,
  MAX_FX_PER_TRACK,
  MAX_PATTERNS_PER_TRACK,
  MAX_SONG_BARS,
  MAX_SWING,
  MAX_TRACKS,
  MIN_BPM,
} from '@/model/constants';
import {
  cloneTrackWithNewIds,
  createFxSlot,
  createLane,
  createPattern,
  createSampleTrack,
  createSong,
  createSynthTrack,
  newId,
  nextPatternName,
} from '@/model/factories';
import { clampDb } from '@/model/mixing';
import { pruneLanes, targetKey, targetStatic, valueAt } from '@/model/automation';
import { DEFAULT_LFO, LFO_RATES } from '@/model/lfo';
import { deleteBars, duplicateBars, insertBars } from '@/model/bars';
import { defaultDuck, defaultDuckSource, DUCK_RELEASES } from '@/model/groove';
import { dropMissingDuckSources } from '@/model/schema';
import { convertTrackKind } from '@/model/convertTrack';
import type {
  AutomationLane,
  AutomationPoint,
  LfoSettings,
  AutomationTarget,
  DuckSettings,
  FxType,
  Note,
  Pattern,
  PatternLength,
  SampleTrackSettings,
  Song,
  SongKey,
  Step,
  StepsPerBar,
  SynthTrackSettings,
  Track,
  TrackKind,
} from '@/model/types';
import { emptyHistory, record, redo, undo, type HistoryState } from './history';
import { applyIdea, type ApplyResult, type IdeaPlan } from '@/library/ideas/apply';
import type { PatternIdea } from '@/library/ideas/model';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type D = Draft<Song>;

function track(d: D, id: string): Draft<Track> | undefined {
  return d.tracks.find((t) => t.id === id);
}

function pattern(d: D, trackId: string, patternId: string): Draft<Pattern> | undefined {
  return track(d, trackId)?.patterns.find((p) => p.id === patternId);
}

/** Rescale step/note positions when switching between 16 and 24 steps per bar. */
function convertGrid(p: Draft<Pattern>, to: StepsPerBar) {
  if (p.stepsPerBar === to) return;
  const ratio = to / p.stepsPerBar;
  const total = p.lengthBars * to;
  const seen = new Set<number>();
  p.steps = p.steps
    .map((s) => ({ ...s, index: Math.round(s.index * ratio) }))
    .filter((s) => s.index < total && !seen.has(s.index) && (seen.add(s.index), true));
  const seenNotes = new Set<string>();
  p.notes = p.notes
    .map((n) => ({
      ...n,
      start: Math.round(n.start * ratio),
      length: Math.max(1, Math.round(n.length * ratio)),
    }))
    .filter((n) => {
      const k = `${n.start}:${n.degree}`;
      if (n.start >= total || seenNotes.has(k)) return false;
      seenNotes.add(k);
      return true;
    });
  p.stepsPerBar = to;
}

export interface SongStore extends HistoryState {
  song: Song;
  undo(): void;
  redo(): void;
  loadSong(song: Song): void;

  setName(name: string): void;
  setBpm(bpm: number, gestureId?: string): void;
  setSwing(swing: number, gestureId?: string): void;
  setKey(key: SongKey): void;
  setLength(bars: number): void;
  /** Whole-song bar editing (0-based bars). Each returns false if it couldn't be done. */
  insertBars(at: number, count: number): boolean;
  duplicateBars(from: number, count: number): boolean;
  deleteBars(from: number, count: number): boolean;

  addTrack(kind: TrackKind, init?: Partial<Track>): string | null;
  duplicateTrack(trackId: string): string | null;
  /** synth ↔ sample; returns how many automation lanes couldn't come along, or null */
  convertTrack(trackId: string): { droppedLanes: number } | null;
  removeTrack(trackId: string): void;
  moveTrack(trackId: string, toIndex: number): void;
  renameTrack(trackId: string, name: string): void;
  setTrackColor(trackId: string, color: string): void;
  setVolume(trackId: string, db: number, gestureId?: string): void;
  setPan(trackId: string, pan: number, gestureId?: string): void;
  toggleMute(trackId: string): void;
  toggleSolo(trackId: string): void;

  addPattern(trackId: string, copyFrom?: string): string | null;
  removePattern(trackId: string, patternId: string): void;
  setPatternLength(trackId: string, patternId: string, bars: PatternLength): void;
  setPatternGrid(trackId: string, patternId: string, spb: StepsPerBar): void;
  toggleStep(trackId: string, patternId: string, index: number, velocity?: number): void;
  setStepVelocity(
    trackId: string,
    patternId: string,
    index: number,
    v: number,
    gestureId?: string,
  ): void;
  addNote(trackId: string, patternId: string, note: Note | Note[]): void;
  moveNote(
    trackId: string,
    patternId: string,
    noteIndex: number,
    start: number,
    degree: number,
    gestureId?: string,
  ): void;
  resizeNote(
    trackId: string,
    patternId: string,
    noteIndex: number,
    length: number,
    gestureId?: string,
  ): void;
  setNoteVelocity(
    trackId: string,
    patternId: string,
    noteIndex: number,
    v: number,
    gestureId?: string,
  ): void;
  removeNote(trackId: string, patternId: string, noteIndex: number): void;
  /** How often a step plays (0.1–1). */
  setStepChance(trackId: string, patternId: string, index: number, c: number, g?: string): void;
  /** How often a note plays (0.1–1). */
  setNoteChance(trackId: string, patternId: string, noteIndex: number, c: number, g?: string): void;
  /** Add what was played during a recording take (all calls with one gestureId = one undo). */
  recordHits(
    trackId: string,
    patternId: string,
    hits: { steps?: Step[]; notes?: Note[] },
    gestureId: string,
  ): void;
  setHumanize(trackId: string, v: number, gestureId?: string): void;
  /** Change (or with null, remove) a track's ducking. */
  setDuck(trackId: string, patch: Partial<DuckSettings> | null, gestureId?: string): void;
  clearPattern(trackId: string, patternId: string): void;

  paintBlock(trackId: string, patternId: string, bar: number, gestureId?: string): void;
  removeBlock(trackId: string, blockId: string): void;
  removeBlockAt(trackId: string, bar: number, gestureId?: string): void;

  setSampleSettings(trackId: string, patch: Partial<SampleTrackSettings>, gestureId?: string): void;
  setSampleEdit(
    trackId: string,
    patch: Partial<SampleTrackSettings['edit']>,
    gestureId?: string,
  ): void;
  setSynthSettings(trackId: string, patch: Partial<SynthTrackSettings>, gestureId?: string): void;
  setSynthMacro(
    trackId: string,
    macro: keyof SynthTrackSettings['macros'],
    v: number,
    gestureId?: string,
  ): void;

  addFx(trackId: string, type: FxType, params?: Record<string, number>): string | null;
  removeFx(trackId: string, fxId: string): void;
  moveFx(trackId: string, fxId: string, toIndex: number): void;
  setFxParam(trackId: string, fxId: string, key: string, v: number, gestureId?: string): void;
  toggleFx(trackId: string, fxId: string): void;

  addLane(trackId: string, target: AutomationTarget, points?: AutomationPoint[]): string | null;
  removeLane(trackId: string, laneId: string): void;
  setLanePoints(
    trackId: string,
    laneId: string,
    points: AutomationPoint[],
    gestureId?: string,
  ): void;
  setLaneVisible(trackId: string, laneId: string, visible: boolean): void;
  /** Switch a lane between drawn points and a wobble (LFO). */
  setLaneMode(trackId: string, laneId: string, mode: 'draw' | 'lfo'): void;
  setLfo(trackId: string, laneId: string, patch: Partial<LfoSettings>, gestureId?: string): void;
  /** Make `target` wobble with these settings (adds the lane if needed). Returns the lane id. */
  addWobble(trackId: string, target: AutomationTarget, lfo: LfoSettings): string | null;

  /** Apply a pattern idea (see library/ideas/apply) as one undo step. */
  applyIdea(
    idea: PatternIdea,
    plan: IdeaPlan,
    setFeel: boolean,
    selectedTrackId?: string | null,
  ): ApplyResult | null;
}

export const useSongStore = create<SongStore>((set, get) => {
  /** Run an undoable mutation. Returns true if anything changed. */
  const mutate = (label: string, recipe: (d: D) => void, gestureId?: string): boolean => {
    const { song, past, future } = get();
    const r = record(song, { past, future }, label, recipe, gestureId);
    if (!r) return false;
    set({ song: r.state, ...r.history });
    return true;
  };

  return {
    song: createSong(),
    ...emptyHistory(),

    undo() {
      const { song, past, future } = get();
      const r = undo(song, { past, future });
      if (r) set({ song: r.state, ...r.history });
    },
    redo() {
      const { song, past, future } = get();
      const r = redo(song, { past, future });
      if (r) set({ song: r.state, ...r.history });
    },
    loadSong(song) {
      set({ song, ...emptyHistory() });
    },

    setName: (name) => mutate('Rename song', (d) => void (d.name = name.slice(0, 80))),
    setBpm: (bpm, g) =>
      mutate('Tempo', (d) => void (d.bpm = clamp(Math.round(bpm), MIN_BPM, MAX_BPM)), g),
    setSwing: (s, g) => mutate('Swing', (d) => void (d.swing = clamp(s, 0, MAX_SWING)), g),
    setKey: (key) =>
      mutate(
        'Key',
        (d) => void (d.key = { root: clamp(Math.round(key.root), 0, 11), scale: key.scale }),
      ),
    setLength: (bars) =>
      mutate('Song length', (d) => void (d.lengthBars = clamp(Math.round(bars), 1, MAX_SONG_BARS))),

    insertBars: (at, count) =>
      mutate(
        `Insert ${count} bar${count > 1 ? 's' : ''}`,
        (d) => void insertBars(d as Song, at, count),
      ),
    duplicateBars: (from, count) =>
      mutate(
        `Duplicate ${count} bar${count > 1 ? 's' : ''}`,
        (d) => void duplicateBars(d as Song, from, count),
      ),
    deleteBars: (from, count) =>
      mutate(
        `Delete ${count} bar${count > 1 ? 's' : ''}`,
        (d) => void deleteBars(d as Song, from, count),
      ),

    addTrack(kind, init) {
      if (get().song.tracks.length >= MAX_TRACKS) return null;
      const t =
        kind === 'synth'
          ? createSynthTrack({}, get().song.tracks)
          : createSampleTrack({}, get().song.tracks);
      Object.assign(t, init ?? {});
      if (init?.sample) t.sample = { ...createSampleTrack().sample!, ...init.sample };
      if (init?.synth) t.synth = { ...createSynthTrack().synth!, ...init.synth };
      mutate('Add track', (d) => void d.tracks.push(t as Draft<Track>));
      return t.id;
    },
    duplicateTrack(trackId) {
      const { tracks } = get().song;
      const idx = tracks.findIndex((t) => t.id === trackId);
      if (idx < 0 || tracks.length >= MAX_TRACKS) return null;
      const copy = cloneTrackWithNewIds(tracks[idx]!);
      copy.name = `${copy.name} copy`.slice(0, 40);
      mutate('Duplicate track', (d) => void d.tracks.splice(idx + 1, 0, copy as Draft<Track>));
      return copy.id;
    },
    convertTrack(trackId) {
      const t = get().song.tracks.find((x) => x.id === trackId);
      if (!t) return null;
      const r = convertTrackKind(t);
      const label = r.track.kind === 'sample' ? 'Make sample track' : 'Make synth track';
      mutate(label, (d) => {
        const i = d.tracks.findIndex((x) => x.id === trackId);
        if (i >= 0) d.tracks[i] = r.track as Draft<Track>;
      });
      return { droppedLanes: r.droppedLanes };
    },
    removeTrack: (id) =>
      mutate('Delete track', (d) => {
        d.tracks = d.tracks.filter((t) => t.id !== id);
        // tracks that ducked to it stop ducking
        dropMissingDuckSources(d.tracks as Track[]);
      }),
    moveTrack: (id, to) =>
      mutate('Move track', (d) => {
        const i = d.tracks.findIndex((t) => t.id === id);
        if (i < 0) return;
        const [t] = d.tracks.splice(i, 1);
        d.tracks.splice(clamp(to, 0, d.tracks.length), 0, t!);
      }),
    renameTrack: (id, name) =>
      mutate('Rename track', (d) => {
        const t = track(d, id);
        if (t && name.trim()) t.name = name.trim().slice(0, 40);
      }),
    setTrackColor: (id, color) =>
      mutate('Track color', (d) => void (track(d, id) && (track(d, id)!.color = color))),
    setVolume: (id, db, g) =>
      mutate(
        'Volume',
        (d) => {
          const t = track(d, id);
          if (t) t.volumeDb = clampDb(db);
        },
        g,
      ),
    setPan: (id, pan, g) =>
      mutate(
        'Pan',
        (d) => {
          const t = track(d, id);
          if (t) t.pan = clamp(pan, -1, 1);
        },
        g,
      ),
    toggleMute: (id) =>
      mutate('Mute', (d) => void (track(d, id) && (track(d, id)!.mute = !track(d, id)!.mute))),
    toggleSolo: (id) =>
      mutate('Solo', (d) => void (track(d, id) && (track(d, id)!.solo = !track(d, id)!.solo))),

    addPattern(trackId, copyFrom) {
      const t = get().song.tracks.find((x) => x.id === trackId);
      if (!t || t.patterns.length >= MAX_PATTERNS_PER_TRACK) return null;
      const name = nextPatternName(t.patterns);
      if (!name) return null;
      const src = copyFrom ? t.patterns.find((p) => p.id === copyFrom) : undefined;
      const p = src
        ? { ...structuredClone(src), id: newId(), name }
        : createPattern({
            name,
            lengthBars: t.patterns[0]?.lengthBars ?? 1,
            stepsPerBar: t.patterns[0]?.stepsPerBar ?? 16,
          });
      mutate('New pattern', (d) => void track(d, trackId)!.patterns.push(p));
      return p.id;
    },
    removePattern: (trackId, patternId) =>
      mutate('Delete pattern', (d) => {
        const t = track(d, trackId);
        if (!t || t.patterns.length <= 1) return;
        t.patterns = t.patterns.filter((p) => p.id !== patternId);
        t.blocks = t.blocks.filter((b) => b.patternId !== patternId);
      }),
    setPatternLength: (trackId, patternId, bars) =>
      mutate('Pattern length', (d) => {
        const p = pattern(d, trackId, patternId);
        if (!p) return;
        p.lengthBars = bars;
        const total = bars * p.stepsPerBar;
        p.steps = p.steps.filter((s) => s.index < total);
        p.notes = p.notes.filter((n) => n.start < total);
        for (const n of p.notes) n.length = Math.min(n.length, total - n.start);
      }),
    setPatternGrid: (trackId, patternId, spb) =>
      mutate('Pattern grid', (d) => {
        const p = pattern(d, trackId, patternId);
        if (p) convertGrid(p, spb);
      }),
    toggleStep: (trackId, patternId, index, velocity = 0.8) =>
      mutate('Toggle step', (d) => {
        const p = pattern(d, trackId, patternId);
        if (!p || index < 0 || index >= p.lengthBars * p.stepsPerBar) return;
        const i = p.steps.findIndex((s) => s.index === index);
        if (i >= 0) p.steps.splice(i, 1);
        else p.steps.push({ index, velocity: clamp(velocity, 0.1, 1) });
      }),
    setStepVelocity: (trackId, patternId, index, v, g) =>
      mutate(
        'Step velocity',
        (d) => {
          const s = pattern(d, trackId, patternId)?.steps.find((x) => x.index === index);
          if (s) s.velocity = clamp(v, 0.1, 1);
        },
        g,
      ),
    addNote: (trackId, patternId, note) =>
      mutate('Add note', (d) => {
        const p = pattern(d, trackId, patternId);
        if (!p) return;
        const total = p.lengthBars * p.stepsPerBar;
        for (const n of Array.isArray(note) ? note : [note]) {
          if (n.start < 0 || n.start >= total) continue;
          if (p.notes.some((x) => x.start === n.start && x.degree === n.degree)) continue;
          p.notes.push({
            start: n.start,
            length: clamp(Math.round(n.length), 1, total - n.start),
            degree: Math.round(n.degree),
            velocity: clamp(n.velocity, 0.1, 1),
          });
        }
      }),
    moveNote: (trackId, patternId, i, start, degree, g) =>
      mutate(
        'Move note',
        (d) => {
          const p = pattern(d, trackId, patternId);
          const n = p?.notes[i];
          if (!p || !n) return;
          const total = p.lengthBars * p.stepsPerBar;
          n.start = clamp(Math.round(start), 0, total - 1);
          n.degree = clamp(Math.round(degree), -21, 35);
          n.length = Math.min(n.length, total - n.start);
        },
        g,
      ),
    resizeNote: (trackId, patternId, i, length, g) =>
      mutate(
        'Resize note',
        (d) => {
          const p = pattern(d, trackId, patternId);
          const n = p?.notes[i];
          if (!p || !n) return;
          n.length = clamp(Math.round(length), 1, p.lengthBars * p.stepsPerBar - n.start);
        },
        g,
      ),
    setNoteVelocity: (trackId, patternId, i, v, g) =>
      mutate(
        'Note velocity',
        (d) => {
          const n = pattern(d, trackId, patternId)?.notes[i];
          if (n) n.velocity = clamp(v, 0.1, 1);
        },
        g,
      ),
    setStepChance: (trackId, patternId, index, c, g) =>
      mutate(
        'Step chance',
        (d) => {
          const s = pattern(d, trackId, patternId)?.steps.find((x) => x.index === index);
          if (!s) return;
          if (c >= 0.995) delete s.chance;
          else s.chance = clamp(c, 0.1, 1);
        },
        g,
      ),
    setNoteChance: (trackId, patternId, i, c, g) =>
      mutate(
        'Note chance',
        (d) => {
          const n = pattern(d, trackId, patternId)?.notes[i];
          if (!n) return;
          if (c >= 0.995) delete n.chance;
          else n.chance = clamp(c, 0.1, 1);
        },
        g,
      ),
    recordHits: (trackId, patternId, hits, g) =>
      mutate(
        'Record',
        (d) => {
          const p = pattern(d, trackId, patternId);
          if (!p) return;
          const total = p.lengthBars * p.stepsPerBar;
          for (const h of hits.steps ?? []) {
            const index = Math.round(h.index);
            if (index < 0 || index >= total) continue;
            const v = clamp(h.velocity, 0.1, 1);
            const ex = p.steps.find((x) => x.index === index);
            if (ex) ex.velocity = Math.max(ex.velocity, v);
            else p.steps.push({ index, velocity: v });
          }
          p.steps.sort((a, b) => a.index - b.index);
          for (const n of hits.notes ?? []) {
            const start = Math.round(n.start);
            if (start < 0 || start >= total) continue;
            const length = clamp(Math.round(n.length), 1, total - start);
            const ex = p.notes.find((x) => x.start === start && x.degree === n.degree);
            if (ex) {
              ex.length = Math.max(ex.length, length);
              ex.velocity = Math.max(ex.velocity, clamp(n.velocity, 0.1, 1));
            } else
              p.notes.push({
                start,
                length,
                degree: Math.round(n.degree),
                velocity: clamp(n.velocity, 0.1, 1),
              });
          }
        },
        g,
      ),
    setHumanize: (trackId, v, g) =>
      mutate(
        'Humanize',
        (d) => {
          const t = track(d, trackId);
          if (!t) return;
          if (v <= 0.001) delete t.humanize;
          else t.humanize = clamp(v, 0, 1);
        },
        g,
      ),
    setDuck: (trackId, patch, g) =>
      mutate(
        patch ? 'Duck' : 'Remove duck',
        (d) => {
          const t = track(d, trackId);
          if (!t) return;
          if (!patch) {
            delete t.duck;
            return;
          }
          const sourceId =
            patch.sourceId ??
            t.duck?.sourceId ??
            defaultDuckSource(d.tracks as Track[], trackId)?.id;
          if (!sourceId || sourceId === trackId) return;
          t.duck = {
            ...(t.duck ?? defaultDuck(sourceId)),
            ...patch,
            sourceId,
          };
          t.duck.amount = clamp(t.duck.amount, 0, 1);
          t.duck.release = clamp(Math.round(t.duck.release), 0, DUCK_RELEASES.length - 1);
        },
        g,
      ),
    removeNote: (trackId, patternId, i) =>
      mutate('Delete note', (d) => void pattern(d, trackId, patternId)?.notes.splice(i, 1)),
    clearPattern: (trackId, patternId) =>
      mutate('Clear pattern', (d) => {
        const p = pattern(d, trackId, patternId);
        if (p) {
          p.steps = [];
          p.notes = [];
        }
      }),

    paintBlock: (trackId, patternId, bar, g) =>
      mutate(
        'Paint pattern',
        (d) => {
          const t = track(d, trackId);
          const p = t?.patterns.find((x) => x.id === patternId);
          if (!t || !p || bar < 0 || bar >= MAX_SONG_BARS) return;
          if (t.blocks.some((b) => b.startBar === bar && b.patternId === patternId)) return;
          const end = bar + p.lengthBars;
          t.blocks = t.blocks.filter((b) => b.startBar < bar || b.startBar >= end);
          t.blocks.push({ id: newId(), patternId, startBar: bar });
          t.blocks.sort((a, b) => a.startBar - b.startBar);
          if (end > d.lengthBars) d.lengthBars = Math.min(MAX_SONG_BARS, end);
        },
        g,
      ),
    removeBlock: (trackId, blockId) =>
      mutate('Remove block', (d) => {
        const t = track(d, trackId);
        if (t) t.blocks = t.blocks.filter((b) => b.id !== blockId);
      }),
    removeBlockAt: (trackId, bar, g) =>
      mutate(
        'Remove block',
        (d) => {
          const t = track(d, trackId);
          if (!t) return;
          let best: (typeof t.blocks)[number] | undefined;
          for (const b of t.blocks) {
            const p = t.patterns.find((x) => x.id === b.patternId);
            if (
              p &&
              b.startBar <= bar &&
              bar < b.startBar + p.lengthBars &&
              (!best || b.startBar > best.startBar)
            )
              best = b;
          }
          if (best) t.blocks = t.blocks.filter((b) => b !== best);
        },
        g,
      ),

    setSampleSettings: (trackId, patch, g) =>
      mutate(
        'Sound',
        (d) => {
          const t = track(d, trackId);
          if (t?.sample) Object.assign(t.sample, patch);
        },
        g,
      ),
    setSampleEdit: (trackId, patch, g) =>
      mutate(
        'Edit sample',
        (d) => {
          const t = track(d, trackId);
          if (t?.sample) Object.assign(t.sample.edit, patch);
        },
        g,
      ),
    setSynthSettings: (trackId, patch, g) =>
      mutate(
        'Synth',
        (d) => {
          const t = track(d, trackId);
          if (t?.synth) Object.assign(t.synth, patch);
        },
        g,
      ),
    setSynthMacro: (trackId, macro, v, g) =>
      mutate(
        'Synth knob',
        (d) => {
          const t = track(d, trackId);
          if (t?.synth) t.synth.macros[macro] = clamp(v, 0, 1);
        },
        g,
      ),

    addFx(trackId, type, params) {
      const t = get().song.tracks.find((x) => x.id === trackId);
      if (!t || t.fx.length >= MAX_FX_PER_TRACK) return null;
      const slot = createFxSlot(type, params);
      mutate('Add effect', (d) => void track(d, trackId)!.fx.push(slot));
      return slot.id;
    },
    removeFx: (trackId, fxId) =>
      mutate('Remove effect', (d) => {
        const t = track(d, trackId);
        if (!t) return;
        t.fx = t.fx.filter((f) => f.id !== fxId);
        t.automation = pruneLanes(t as Track) as typeof t.automation;
      }),
    moveFx: (trackId, fxId, to) =>
      mutate('Reorder effects', (d) => {
        const t = track(d, trackId);
        if (!t) return;
        const i = t.fx.findIndex((f) => f.id === fxId);
        if (i < 0) return;
        const [f] = t.fx.splice(i, 1);
        t.fx.splice(clamp(to, 0, t.fx.length), 0, f!);
      }),
    setFxParam: (trackId, fxId, key, v, g) =>
      mutate(
        'Effect knob',
        (d) => {
          const f = track(d, trackId)?.fx.find((x) => x.id === fxId);
          if (f) f.params[key] = clamp(v, 0, 1);
        },
        g,
      ),
    toggleFx: (trackId, fxId) =>
      mutate('Effect on/off', (d) => {
        const f = track(d, trackId)?.fx.find((x) => x.id === fxId);
        if (f) f.enabled = !f.enabled;
      }),

    addLane(trackId, target, points = []) {
      const t = get().song.tracks.find((x) => x.id === trackId);
      if (!t) return null;
      const lane = createLane(target, points);
      mutate('Add automation', (d) => void track(d, trackId)!.automation.push(lane));
      return lane.id;
    },
    removeLane: (trackId, laneId) =>
      mutate('Delete automation', (d) => {
        const t = track(d, trackId);
        if (!t) return;
        t.automation = t.automation.filter((l) => l.id !== laneId);
        // a wobble's amount/speed lanes go with it
        t.automation = pruneLanes(t as Track) as typeof t.automation;
      }),
    setLanePoints: (trackId, laneId, points, g) =>
      mutate(
        'Edit automation',
        (d) => {
          const l = track(d, trackId)?.automation.find((x) => x.id === laneId);
          if (!l) return;
          l.points = points
            .map((p) => ({ bar: Math.max(0, p.bar), value: clamp(p.value, 0, 1) }))
            .sort((a, b) => a.bar - b.bar);
        },
        g,
      ),
    setLaneMode: (trackId, laneId, mode) =>
      mutate(mode === 'lfo' ? 'Wobble on' : 'Wobble off', (d) => {
        const t = track(d, trackId);
        const l = t?.automation.find((x) => x.id === laneId);
        if (!t || !l || l.target.kind === 'lfo') return;
        l.mode = mode;
        if (mode === 'lfo' && !l.lfo) {
          const center = valueAt(l as AutomationLane, 0) ?? targetStatic(t as Track, l.target);
          l.lfo = { ...DEFAULT_LFO, center };
        }
      }),
    setLfo: (trackId, laneId, patch, g) =>
      mutate(
        'Wobble',
        (d) => {
          const l = track(d, trackId)?.automation.find((x) => x.id === laneId);
          if (!l) return;
          const next = { ...DEFAULT_LFO, ...l.lfo, ...patch };
          next.depth = clamp(next.depth, 0, 1);
          next.center = clamp(next.center, 0, 1);
          next.rate = clamp(Math.round(next.rate), 0, LFO_RATES.length - 1);
          l.lfo = next;
        },
        g,
      ),
    addWobble(trackId, target, lfo) {
      const t = get().song.tracks.find((x) => x.id === trackId);
      if (!t) return null;
      const existing = t.automation.find((l) => targetKey(l.target) === targetKey(target));
      const id = existing?.id ?? newId();
      mutate('Add wobble', (d) => {
        const dt = track(d, trackId)!;
        const l = dt.automation.find((x) => x.id === id);
        if (l) {
          l.mode = 'lfo';
          l.lfo = { ...lfo };
          l.visible = true;
        } else
          dt.automation.push({
            id,
            target,
            points: [],
            visible: true,
            mode: 'lfo',
            lfo: { ...lfo },
          });
      });
      return id;
    },
    setLaneVisible: (trackId, laneId, visible) =>
      mutate('Show automation', (d) => {
        const l = track(d, trackId)?.automation.find((x) => x.id === laneId);
        if (l) l.visible = visible;
      }),

    applyIdea(idea, plan, setFeel, selectedTrackId) {
      let result: ApplyResult | null = null;
      mutate(plan.mode === 'new' ? 'Add pattern idea' : 'Use pattern idea', (d) => {
        result = applyIdea(d as Song, idea, plan, { setFeel, selectedTrackId });
      });
      return result;
    },
  };
});

/** Convenience non-hook accessor for engine/tests. */
export const songActions = () => useSongStore.getState();
