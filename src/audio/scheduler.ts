import { BEATS_PER_BAR, blockAt, swingOffsetBeats } from '@/model/timing';
import type { Pattern, Song, Track } from '@/model/types';

/** The parts of UI state that change what plays. */
export interface PlayContext {
  playMode: 'pattern' | 'song';
  selectedTrackId: string | null;
  selectedPatternId: Record<string, string>;
}

export interface LoopRegion {
  startBar: number;
  lengthBars: number;
}

export interface ScheduledEvent {
  trackId: string;
  kind: 'hit' | 'note';
  /** beats after the start of the scheduled beat (includes swing) */
  offsetBeats: number;
  velocity: number;
  degree?: number;
  lengthBeats?: number;
}

export function selectedPattern(track: Track, ctx: PlayContext): Pattern {
  const id = ctx.selectedPatternId[track.id];
  return track.patterns.find((p) => p.id === id) ?? track.patterns[0]!;
}

/**
 * Pattern mode loops the selected pattern: the region starts at that pattern's first block on
 * the timeline (bar 0 if it isn't placed) and lasts the pattern's length. Song mode loops the song.
 */
export function getLoopRegion(song: Song, ctx: PlayContext): LoopRegion {
  if (ctx.playMode === 'song') return { startBar: 0, lengthBars: song.lengthBars };
  const track = song.tracks.find((t) => t.id === ctx.selectedTrackId) ?? song.tracks[0];
  if (!track) return { startBar: 0, lengthBars: 1 };
  const p = selectedPattern(track, ctx);
  const first = track.blocks
    .filter((b) => b.patternId === p.id)
    .reduce<number | null>((m, b) => (m === null || b.startBar < m ? b.startBar : m), null);
  return { startBar: first ?? 0, lengthBars: p.lengthBars };
}

/** Map the transport's beat counter (0, 1, 2… since play) to an absolute song beat. */
export function songBeatFor(
  song: Song,
  ctx: PlayContext,
  counter: number,
  fromBar: number,
): number {
  if (ctx.playMode === 'song') {
    const total = song.lengthBars * BEATS_PER_BAR;
    const start = Math.min(fromBar, song.lengthBars - 1) * BEATS_PER_BAR;
    return (start + counter) % total;
  }
  const r = getLoopRegion(song, ctx);
  return r.startBar * BEATS_PER_BAR + (counter % (r.lengthBars * BEATS_PER_BAR));
}

export function isAudible(track: Track, anySolo: boolean): boolean {
  return !track.mute && (!anySolo || track.solo);
}

export function usesNotes(track: Track): boolean {
  return track.kind === 'synth' || !!track.sample?.melodic;
}

/** Pure: every event that starts inside one beat of the song. */
export function computeBeatEvents(
  song: Song,
  ctx: PlayContext,
  songBeat: number,
): ScheduledEvent[] {
  const bar = Math.floor(songBeat / BEATS_PER_BAR);
  const beatInBar = songBeat % BEATS_PER_BAR;
  const anySolo = song.tracks.some((t) => t.solo);
  const region = ctx.playMode === 'pattern' ? getLoopRegion(song, ctx) : null;
  const selTrack = region
    ? (song.tracks.find((t) => t.id === ctx.selectedTrackId) ?? song.tracks[0])
    : undefined;
  const events: ScheduledEvent[] = [];

  for (const track of song.tracks) {
    if (!isAudible(track, anySolo)) continue;
    let pattern: Pattern;
    let patternBar: number;
    if (region && selTrack && track.id === selTrack.id) {
      pattern = selectedPattern(track, ctx);
      patternBar = (bar - region.startBar) % pattern.lengthBars;
    } else {
      const hit = blockAt(track, bar);
      if (!hit) continue;
      pattern = hit.pattern;
      patternBar = (bar - hit.block.startBar) % pattern.lengthBars;
    }
    const spb = pattern.stepsPerBar;
    const perBeat = spb / BEATS_PER_BAR;
    const base = patternBar * spb + beatInBar * perBeat;
    const stepBeats = 1 / perBeat;

    if (usesNotes(track)) {
      for (const n of pattern.notes) {
        const i = n.start - base;
        if (i < 0 || i >= perBeat) continue;
        events.push({
          trackId: track.id,
          kind: 'note',
          offsetBeats: i * stepBeats + swingOffsetBeats(n.start, spb, song.swing),
          velocity: n.velocity,
          degree: n.degree,
          lengthBeats: n.length * stepBeats,
        });
      }
    } else {
      for (const s of pattern.steps) {
        const i = s.index - base;
        if (i < 0 || i >= perBeat) continue;
        events.push({
          trackId: track.id,
          kind: 'hit',
          offsetBeats: i * stepBeats + swingOffsetBeats(s.index, spb, song.swing),
          velocity: s.velocity,
          lengthBeats: stepBeats,
        });
      }
    }
  }
  return events.sort((a, b) => a.offsetBeats - b.offsetBeats);
}

/**
 * Lookahead clock. A Worker drives the tick (so background tabs keep time), and every
 * beat that falls inside the lookahead window is handed to `onBeat(counter, time)`.
 */
export class BeatClock {
  private worker: Worker | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private counter = 0;
  running = false;

  constructor(
    private now: () => number,
    private beatSeconds: () => number,
    private onBeat: (counter: number, time: number) => void,
    private lookahead = 0.12,
    private tickMs = 25,
  ) {}

  start(at: number) {
    this.stop();
    this.nextTime = at;
    this.counter = 0;
    this.running = true;
    this.tick();
    const tick = () => this.tick();
    if (
      typeof Worker !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      try {
        const src =
          'let id;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
        this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        this.worker.onmessage = tick;
        this.worker.postMessage(this.tickMs);
        return;
      } catch {
        this.worker = null;
      }
    }
    this.interval = setInterval(tick, this.tickMs);
  }

  stop() {
    this.running = false;
    this.worker?.postMessage(0);
    this.worker?.terminate();
    this.worker = null;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private tick() {
    if (!this.running) return;
    const horizon = this.now() + this.lookahead;
    // Never fall far behind (e.g. after the tab was frozen): skip ahead instead of bursting.
    if (this.nextTime < this.now() - 0.5) this.nextTime = this.now() + 0.05;
    while (this.nextTime < horizon) {
      this.onBeat(this.counter, this.nextTime);
      this.nextTime += this.beatSeconds();
      this.counter++;
    }
  }
}

/**
 * Which step of `pattern` is sounding at fractional song beat `beat`, or null if that pattern
 * isn't the one playing on `track` right now.
 */
export function patternStepAt(
  song: Song,
  ctx: PlayContext,
  track: Track,
  pattern: Pattern,
  beat: number,
): number | null {
  const bar = Math.floor(beat / BEATS_PER_BAR);
  let patternBar: number;
  if (ctx.playMode === 'pattern' && (ctx.selectedTrackId ?? song.tracks[0]?.id) === track.id) {
    if (selectedPattern(track, ctx).id !== pattern.id) return null;
    const r = getLoopRegion(song, ctx);
    patternBar = (bar - r.startBar) % pattern.lengthBars;
  } else {
    const hit = blockAt(track, bar);
    if (!hit || hit.pattern.id !== pattern.id) return null;
    patternBar = (bar - hit.block.startBar) % pattern.lengthBars;
  }
  const inBar = beat - bar * BEATS_PER_BAR;
  return (
    patternBar * pattern.stepsPerBar + Math.floor((inBar * pattern.stepsPerBar) / BEATS_PER_BAR)
  );
}
