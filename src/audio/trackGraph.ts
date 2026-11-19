import * as Tone from 'tone';
import type { Track } from '@/model/types';
import { MIN_VOLUME_DB } from '@/model/constants';

export function channelDb(db: number): number {
  return db <= MIN_VOLUME_DB ? -Infinity : db;
}

export interface InsertNode {
  input: Tone.InputNode;
  output: Tone.ToneAudioNode;
}

/**
 * Per-track signal chain: input → (effect inserts) → Channel (volume/pan/mute) → master.
 * Voices connect to `input`.
 */
export class TrackGraph {
  readonly input = new Tone.Gain(1);
  /** dips briefly while the effect chain is rewired, so changes don't click */
  private readonly pre = new Tone.Gain(1);
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
    this.pre.connect(this.channel);
  }

  update(track: Track, audible: boolean) {
    this.channel.volume.rampTo(channelDb(track.volumeDb), 0.02);
    this.channel.pan.rampTo(track.pan, 0.02);
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
    prev.connect(this.channel);
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
    this.channel.dispose();
  }
}
