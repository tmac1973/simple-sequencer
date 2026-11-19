import * as Tone from 'tone';
import type { Track } from '@/model/types';
import { MIN_VOLUME_DB } from '@/model/constants';

export function channelDb(db: number): number {
  return db <= MIN_VOLUME_DB ? -Infinity : db;
}

/**
 * Per-track signal chain: input → (effect inserts) → Channel (volume/pan/mute) → master.
 * Voices connect to `input`.
 */
export class TrackGraph {
  readonly input = new Tone.Gain(1);
  readonly channel: Tone.Channel;
  private inserts: Tone.ToneAudioNode[] = [];

  constructor(track: Track, destination: Tone.InputNode, audible: boolean) {
    this.channel = new Tone.Channel({
      volume: channelDb(track.volumeDb),
      pan: track.pan,
      mute: !audible,
    });
    this.channel.connect(destination);
    this.input.connect(this.channel);
  }

  update(track: Track, audible: boolean) {
    this.channel.volume.rampTo(channelDb(track.volumeDb), 0.02);
    this.channel.pan.rampTo(track.pan, 0.02);
    if (this.channel.mute !== !audible) this.channel.mute = !audible;
  }

  /** Rewire the insert chain (input → a → b → … → channel). */
  setInserts(nodes: Tone.ToneAudioNode[]) {
    this.input.disconnect();
    for (const n of this.inserts) if (!nodes.includes(n)) n.disconnect();
    this.inserts = nodes;
    if (nodes.length === 0) {
      this.input.connect(this.channel);
      return;
    }
    let prev: Tone.ToneAudioNode = this.input;
    for (const n of nodes) {
      n.disconnect();
      prev.connect(n);
      prev = n;
    }
    prev.connect(this.channel);
  }

  dispose() {
    this.input.dispose();
    this.channel.dispose();
  }
}
