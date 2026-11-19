import type { Song, Track } from '@/model/types';
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

/**
 * All audio nodes for one song, built in whatever Tone context is current
 * (the live context, or an OfflineContext inside Tone.Offline for export).
 */
export class GraphSet {
  readonly master: MasterBus;
  readonly tracks = new Map<string, TrackGraph>();

  constructor(song: Song) {
    this.master = createMaster();
    this.sync(song);
  }

  sync(song: Song) {
    const anySolo = song.tracks.some((t) => t.solo);
    const ids = new Set(song.tracks.map((t) => t.id));
    for (const [id, g] of this.tracks) {
      if (!ids.has(id)) {
        g.dispose();
        this.tracks.delete(id);
      }
    }
    for (const t of song.tracks) {
      const audible = isAudible(t, anySolo);
      const g = this.tracks.get(t.id);
      if (g) g.update(t, audible);
      else this.tracks.set(t.id, new TrackGraph(t, this.master.input, audible));
    }
  }

  dispose() {
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
  _beatSec: number,
) {
  const g = graphs.tracks.get(track.id);
  if (!g) return;
  if (ev.kind === 'hit' && track.sample) {
    const buf = SampleRegistry.getLoaded(track.sample.sampleId);
    if (buf) triggerSample(g.input, buf, at, ev.velocity, track.sample);
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
) {
  const beatSec = beatSeconds(song.bpm);
  for (const ev of computeBeatEvents(song, ctx, songBeat)) {
    const track = song.tracks.find((t) => t.id === ev.trackId);
    if (track) dispatchEvent(graphs, track, ev, time + ev.offsetBeats * beatSec, beatSec);
  }
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

  async play(fromBar = 0) {
    if (!this.song) return;
    await ensureAudioStarted();
    this.ensureGraphs();
    this.fromBar = fromBar;
    this.queue = [];
    this.clock.start(audioNow() + 0.06);
  }

  stop() {
    this.clock.stop();
    this.queue = [];
  }

  private onBeat(counter: number, time: number) {
    const song = this.song;
    const graphs = this.graphs;
    if (!song || !graphs) return;
    const songBeat = songBeatFor(song, this.ctx, counter, this.fromBar);
    scheduleBeat(graphs, song, this.ctx, songBeat, time);
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

export const engine = new Engine();
