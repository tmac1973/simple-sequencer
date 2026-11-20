import * as Tone from 'tone';
import type { Track } from '@/model/types';
import { MIN_VOLUME_DB } from '@/model/constants';
import { DUCK_ATTACK } from '@/model/groove';

export function channelDb(db: number): number {
  return db <= MIN_VOLUME_DB ? -Infinity : db;
}

export interface InsertNode {
  input: Tone.InputNode;
  output: Tone.ToneAudioNode;
}

/**
 * Per-track signal chain: input → (effect inserts) → duck → Channel (volume/pan/mute) → master.
 * Voices connect to `input`.
 */
export class TrackGraph {
  readonly input = new Tone.Gain(1);
  /** dips briefly while the effect chain is rewired, so changes don't click */
  private readonly pre = new Tone.Gain(1);
  /** the sidechain "pump": dips each time the track it ducks to hits */
  readonly duck = new Tone.Gain(1);
  private lastDip: { time: number; depth: number; tau: number; from: number } | null = null;
  readonly channel: Tone.Channel;
  private inserts: InsertNode[] = [];
  private rewireTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(track: Track, destination: Tone.InputNode, audible: boolean) {
    this.channel = new Tone.Channel({
      volume: channelDb(track.volumeDb),
      pan: track.pan,
      mute: !audible,
    });
    this.channel.connect(destination);
    this.input.connect(this.pre);
    this.pre.connect(this.duck);
    this.duck.connect(this.channel);
  }

  /** The duck gain at `time`, following the dips scheduled so far. */
  private duckValueAt(time: number): number {
    const d = this.lastDip;
    if (!d || time <= d.time) return d ? d.from : 1;
    const low = 1 - d.depth;
    if (time < d.time + DUCK_ATTACK)
      return d.from + ((low - d.from) * (time - d.time)) / DUCK_ATTACK;
    return 1 - d.depth * Math.exp(-(time - d.time - DUCK_ATTACK) / d.tau);
  }

  /** Dip to (1 − depth) at `time`, then swell back with time constant `tau` seconds. */
  dip(time: number, depth: number, tau: number) {
    const g = this.duck.gain;
    const from = this.duckValueAt(time);
    const low = Math.min(from, 1 - depth);
    g.cancelScheduledValues(time);
    g.setValueAtTime(from, time);
    g.linearRampToValueAtTime(low, time + DUCK_ATTACK);
    g.setTargetAtTime(1, time + DUCK_ATTACK, tau);
    this.lastDip = { time, depth: 1 - low, tau, from };
  }

  /** Stop pumping: straight back to full volume. */
  resetDuck(now: number) {
    this.lastDip = null;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(1, now);
  }

  /** `skip` = params currently driven by automation. */
  update(track: Track, audible: boolean, skip?: { volume?: boolean; pan?: boolean }) {
    if (!skip?.volume) this.channel.volume.rampTo(channelDb(track.volumeDb), 0.02);
    if (!skip?.pan) this.channel.pan.rampTo(track.pan, 0.02);
    if (this.channel.mute !== !audible) this.channel.mute = !audible;
  }

  private wire(nodes: InsertNode[]) {
    this.pre.disconnect();
    for (const n of this.inserts) n.output.disconnect();
    this.inserts = nodes;
    let prev: Tone.ToneAudioNode = this.pre;
    for (const n of nodes) {
      prev.connect(n.input);
      prev = n.output;
    }
    prev.connect(this.duck);
  }

  /** Rewire the insert chain (pre → a → b → … → channel), with a 30 ms dip when live. */
  setInserts(nodes: InsertNode[]) {
    const same =
      nodes.length === this.inserts.length && nodes.every((n, i) => n === this.inserts[i]);
    if (same) return;
    if (this.pre.context instanceof Tone.OfflineContext) {
      this.wire(nodes);
      return;
    }
    clearTimeout(this.rewireTimer);
    this.pre.gain.rampTo(0, 0.015);
    this.rewireTimer = setTimeout(() => {
      this.wire(nodes);
      this.pre.gain.rampTo(1, 0.015);
    }, 18);
  }

  dispose() {
    clearTimeout(this.rewireTimer);
    this.input.dispose();
    this.pre.dispose();
    this.duck.dispose();
    this.channel.dispose();
  }
}
