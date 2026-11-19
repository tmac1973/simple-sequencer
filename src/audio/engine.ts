import type { SampleTrackSettings, Song, Track } from '@/model/types';
import { createSong, DEFAULT_SAMPLE_EDIT } from '@/model/factories';
import { BEATS_PER_BAR, beatSeconds } from '@/model/timing';
import { audioNow, ensureAudioStarted } from './context';
import { createMaster, type MasterBus } from './master';
import { SampleRegistry } from './sampleRegistry';
import {
  BeatClock,
  computeBeatEvents,
  isAudible,
  songBeatFor,
  type PlayContext,
  type ScheduledEvent,
} from './scheduler';
import { TrackGraph } from './trackGraph';
import { triggerSample } from './voices/sampleVoice';
import { SynthVoice } from './voices/synthVoice';
import { toneToHz } from './voices/sampleTiming';
import { FX_DEFS, type FxInstance } from './effects/registry';
import type { FxSlot } from '@/model/types';
import * as Tone from 'tone';
import { degreeToMidi } from '@/model/scale';
import { automatedSet, resetAutomation, scheduleAutomation } from './automation';
import { valueAt, targetKey } from '@/model/automation';
import type { AutomationTarget } from '@/model/types';

/**
 * All audio nodes for one song, built in whatever Tone context is current
 * (the live context, or an OfflineContext inside Tone.Offline for export).
 */
export class GraphSet {
  readonly master: MasterBus;
  readonly tracks = new Map<string, TrackGraph>();
  readonly synths = new Map<string, SynthVoice>();
  /** per sample track: the "Tone" lowpass every hit goes through */
  readonly sampleTone = new Map<string, Tone.Filter>();
  /** effect instances by slot id */
  readonly fx = new Map<string, { slot: FxSlot; inst: FxInstance }>();
  private lastFx = new Map<string, FxSlot[]>();
  /** "<trackId>|<targetKey>" of params automation is driving right now (only while playing) */
  automated = new Set<string>();

  constructor(song: Song) {
    this.master = createMaster();
    this.sync(song);
  }

  sync(song: Song) {
    const anySolo = song.tracks.some((t) => t.solo);
    const ids = new Set(song.tracks.map((t) => t.id));
    for (const [id, v] of this.synths) {
      const t = song.tracks.find((x) => x.id === id);
      if (!t || t.kind !== 'synth') {
        v.dispose();
        this.synths.delete(id);
      }
    }
    for (const [id, f] of this.sampleTone) {
      const t = song.tracks.find((x) => x.id === id);
      if (!t || t.kind !== 'sample') {
        f.dispose();
        this.sampleTone.delete(id);
      }
    }
    for (const [id, g] of this.tracks) {
      if (!ids.has(id)) {
        g.dispose();
        this.tracks.delete(id);
      }
    }
    for (const t of song.tracks) {
      const audible = isAudible(t, anySolo);
      let g = this.tracks.get(t.id);
      const auto = (k: string) => this.automated.has(`${t.id}|${k}`);
      if (g) g.update(t, audible, { volume: auto('track:volume'), pan: auto('track:pan') });
      else {
        g = new TrackGraph(t, this.master.input, audible);
        this.tracks.set(t.id, g);
      }
      if (t.kind === 'sample' && t.sample) {
        const hz = toneToHz(t.sample.tone);
        const f = this.sampleTone.get(t.id);
        if (f) {
          if (!auto('sampleTone')) f.frequency.rampTo(hz, 0.02);
        } else
          this.sampleTone.set(
            t.id,
            new Tone.Filter({ type: 'lowpass', frequency: hz, rolloff: -12, Q: 0.5 }).connect(
              g.input,
            ),
          );
      }
      if (t.kind === 'synth' && t.synth) {
        const v = this.synths.get(t.id);
        if (v) v.apply(t.synth, { tone: auto('macro:tone'), space: auto('macro:space') });
        else this.synths.set(t.id, new SynthVoice(t.synth, g.input));
      }
      this.syncFx(t, g, song.bpm);
    }
    // effects of deleted tracks
    const liveSlots = new Set(song.tracks.flatMap((t) => t.fx.map((f) => f.id)));
    for (const [id, e] of this.fx) {
      if (!liveSlots.has(id)) {
        e.inst.dispose();
        this.fx.delete(id);
      }
    }
    for (const id of this.lastFx.keys()) if (!ids.has(id)) this.lastFx.delete(id);
  }

  private syncFx(t: Track, g: TrackGraph, bpm: number) {
    for (const slot of t.fx) {
      const e = this.fx.get(slot.id);
      if (!e) {
        this.fx.set(slot.id, { slot, inst: FX_DEFS[slot.type].create(slot.params, bpm) });
        continue;
      }
      if (e.slot !== slot) {
        for (const [k, v] of Object.entries(slot.params))
          if (e.slot.params[k] !== v && !this.automated.has(`${t.id}|fx:${slot.id}:${k}`))
            e.inst.set(k, v);
        e.slot = slot;
      }
      e.inst.setTempo?.(bpm);
    }
    if (this.lastFx.get(t.id) !== t.fx) {
      for (const old of this.lastFx.get(t.id) ?? []) {
        if (!t.fx.some((f) => f.id === old.id)) {
          const e = this.fx.get(old.id);
          // let the rewire finish before disposing
          if (e)
            setTimeout(
              () => e.inst.dispose(),
              e.inst.input.context instanceof Tone.OfflineContext ? 0 : 100,
            );
          this.fx.delete(old.id);
        }
      }
      this.lastFx.set(t.id, t.fx);
      g.setInserts(t.fx.filter((f) => f.enabled).map((f) => this.fx.get(f.id)!.inst));
    }
  }

  /** Resolves when async effect parts (reverb impulses, worklets) are ready. */
  ready(): Promise<void> {
    return Promise.all([
      ...[...this.fx.values()].map((e) => e.inst.ready),
      ...[...this.synths.values()].map((v) => v.space.ready),
    ]).then(() => undefined);
  }

  releaseAll() {
    for (const v of this.synths.values()) v.releaseAll();
  }

  /** Where sample voices for a track connect. */
  sampleInput(trackId: string): Tone.InputNode | undefined {
    return this.sampleTone.get(trackId) ?? this.tracks.get(trackId)?.input;
  }

  dispose() {
    for (const e of this.fx.values()) e.inst.dispose();
    this.fx.clear();
    for (const f of this.sampleTone.values()) f.dispose();
    this.sampleTone.clear();
    for (const v of this.synths.values()) v.dispose();
    this.synths.clear();
    for (const g of this.tracks.values()) g.dispose();
    this.tracks.clear();
    this.master.dispose();
  }
}

function dispatchEvent(
  graphs: GraphSet,
  track: Track,
  ev: ScheduledEvent,
  at: number,
  beatSec: number,
  song: Song,
) {
  const g = graphs.tracks.get(track.id);
  if (!g) return;
  const sIn = graphs.sampleInput(track.id) ?? g.input;
  if (ev.kind === 'hit' && track.sample) {
    const buf = SampleRegistry.getLoaded(track.sample.sampleId);
    const hold = track.sample.edit.loop ? (ev.lengthBeats ?? 0.25) * beatSec : undefined;
    if (buf) triggerSample(sIn, buf, at, ev.velocity, track.sample, 1, hold);
    return;
  }
  if (ev.kind !== 'note' || ev.degree === undefined) return;
  const midi = degreeToMidi(ev.degree, song.key);
  const dur = (ev.lengthBeats ?? 0.25) * beatSec;
  if (track.kind === 'synth') {
    graphs.synths.get(track.id)?.trigger(midi, dur, at, ev.velocity);
  } else if (track.sample) {
    const buf = SampleRegistry.getLoaded(track.sample.sampleId);
    const rate = 2 ** ((midi - track.sample.rootMidi) / 12);
    if (buf) triggerSample(sIn, buf, at, ev.velocity, track.sample, rate, dur);
  }
}

/**
 * Everything that happens for one beat. Live playback and offline export both call this,
 * so they always sound the same.
 */
export function scheduleBeat(
  graphs: GraphSet,
  song: Song,
  ctx: PlayContext,
  songBeat: number,
  time: number,
  jump = false,
) {
  const beatSec = beatSeconds(song.bpm);
  for (const ev of computeBeatEvents(song, ctx, songBeat)) {
    const track = song.tracks.find((t) => t.id === ev.trackId);
    if (track) dispatchEvent(graphs, track, ev, time + ev.offsetBeats * beatSec, beatSec, song);
  }
  scheduleAutomation(graphs, song, songBeat, time, beatSec, jump);
}

export function warmSamples(song: Song) {
  for (const t of song.tracks) if (t.sample) SampleRegistry.warm(t.sample.sampleId);
}

interface QueuedBeat {
  time: number;
  songBeat: number;
  beatSec: number;
}

export interface PlayPosition {
  /** fractional absolute song beat */
  beat: number;
  bar: number;
}

class Engine {
  private graphs: GraphSet | null = null;
  private song: Song | null = null;
  private ctx: PlayContext = { playMode: 'pattern', selectedTrackId: null, selectedPatternId: {} };
  private fromBar = 0;
  private queue: QueuedBeat[] = [];
  private clock = new BeatClock(
    () => audioNow(),
    () => (this.song ? beatSeconds(this.song.bpm) : 0.5),
    (counter, time) => this.onBeat(counter, time),
  );

  get playing() {
    return this.clock.running;
  }

  setSong(song: Song) {
    this.song = song;
    warmSamples(song);
    if (this.graphs && this.clock.running) this.graphs.automated = automatedSet(song);
    this.graphs?.sync(song);
  }

  setPlayContext(ctx: PlayContext) {
    this.ctx = ctx;
  }

  /** Create the live graph (after the audio context may start). */
  ensureGraphs(): GraphSet | null {
    if (!this.graphs && this.song) this.graphs = new GraphSet(this.song);
    return this.graphs;
  }

  getGraphs() {
    return this.graphs;
  }

  private playToken = 0;

  async play(fromBar = 0) {
    if (!this.song) return;
    const token = ++this.playToken;
    await ensureAudioStarted();
    if (token !== this.playToken) return; // stopped while starting
    const g = this.ensureGraphs();
    if (g) g.automated = automatedSet(this.song);
    this.fromBar = fromBar;
    this.queue = [];
    this.lastBeat = null;
    this.clock.start(audioNow() + 0.06);
  }

  private lastBeat: number | null = null;

  stop() {
    this.playToken++;
    this.clock.stop();
    this.queue = [];
    const g = this.graphs;
    if (g) {
      g.releaseAll();
      g.automated = new Set();
      if (this.song) resetAutomation(g, this.song, audioNow());
    }
  }

  /** Current automated value (0–1) of a target while playing, else null. */
  onParamValue(trackId: string, target: AutomationTarget): number | null {
    const pos = this.position();
    const t = this.song?.tracks.find((x) => x.id === trackId);
    if (!pos || !t) return null;
    const key = targetKey(target);
    const lane = t.automation.find((l) => targetKey(l.target) === key);
    return lane ? valueAt(lane, pos.beat / BEATS_PER_BAR) : null;
  }

  /** Play one note on a track right now (piano-roll audition). */
  async auditionNote(trackId: string, degree: number, velocity = 0.8) {
    if (!this.song) return;
    await ensureAudioStarted();
    const graphs = this.ensureGraphs();
    const track = this.song.tracks.find((t) => t.id === trackId);
    if (!graphs || !track) return;
    const ev: ScheduledEvent = {
      trackId,
      kind: 'note',
      offsetBeats: 0,
      velocity,
      degree,
      lengthBeats: 0.5,
    };
    dispatchEvent(graphs, track, ev, audioNow() + 0.02, beatSeconds(this.song.bpm), this.song);
  }

  /** Audition a sound right now, straight to the master bus. */
  async preview(sampleId: string, settings?: SampleTrackSettings, midi?: number) {
    await ensureAudioStarted();
    const graphs = this.ensureGraphs() ?? (this.graphs = new GraphSet(this.song ?? emptySong()));
    const buf = await SampleRegistry.get(sampleId);
    const s = settings ?? {
      sampleId,
      melodic: false,
      rootMidi: 60,
      tone: 1,
      edit: { ...DEFAULT_SAMPLE_EDIT },
    };
    const rate = midi !== undefined ? 2 ** ((midi - s.rootMidi) / 12) : 1;
    this.stopPreview();
    const dest = new Tone.Gain(1).connect(graphs.master.input);
    this.previewOut = dest;
    triggerSample(
      dest,
      buf,
      audioNow() + 0.02,
      0.9,
      s,
      rate,
      s.edit.loop ? 2 : Math.min(buf.duration * 4, 6),
    );
  }

  private previewOut: Tone.Gain | null = null;

  /** Cut off any sound being previewed. */
  stopPreview() {
    const p = this.previewOut;
    if (!p) return;
    this.previewOut = null;
    p.gain.rampTo(0, 0.02);
    setTimeout(() => p.dispose(), 100);
  }

  private onBeat(counter: number, time: number) {
    const song = this.song;
    const graphs = this.graphs;
    if (!song || !graphs) return;
    const songBeat = songBeatFor(song, this.ctx, counter, this.fromBar);
    const jump = this.lastBeat === null || songBeat !== this.lastBeat + 1;
    this.lastBeat = songBeat;
    scheduleBeat(graphs, song, this.ctx, songBeat, time, jump);
    this.queue.push({ time, songBeat, beatSec: beatSeconds(song.bpm) });
    if (this.queue.length > 64) this.queue.splice(0, this.queue.length - 64);
  }

  /** Where the listener is right now (accounts for lookahead). Null when stopped. */
  position(): PlayPosition | null {
    if (!this.clock.running) return null;
    const now = audioNow();
    let cur: QueuedBeat | undefined;
    for (const q of this.queue) if (q.time <= now) cur = q;
    if (!cur) return null;
    const frac = Math.min(0.999, (now - cur.time) / cur.beatSec);
    const beat = cur.songBeat + frac;
    return { beat, bar: Math.floor(beat / BEATS_PER_BAR) };
  }
}

const emptySong = () => createSong();

export const engine = new Engine();
