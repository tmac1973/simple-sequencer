import * as Tone from 'tone';
import { GraphSet, scheduleBeat } from '@/audio/engine';
import { DELAY_BEATS, choiceIndex } from '@/audio/effects/registry';
import { automatedSet } from '@/audio/automation';
import { getLoopRegion, type PlayContext } from '@/audio/scheduler';
import { SampleRegistry } from '@/audio/sampleRegistry';
import { BEATS_PER_BAR, beatSeconds } from '@/model/timing';
import type { Song } from '@/model/types';

export type RenderRange = 'song' | { loopRepeats: 1 | 2 | 4 | 8 };

export const MAX_TAIL = 10;

/** Seconds of sound after the last bar: longest reverb, delay echoes (to −60 dB), at least 2 s. */
export function tailSeconds(song: Song): number {
  let tail = 2;
  for (const t of song.tracks) {
    for (const f of t.fx) {
      if (!f.enabled) continue;
      if (f.type === 'reverb') tail = Math.max(tail, 0.5 * 16 ** (f.params.size ?? 0.5));
      if (f.type === 'delay') {
        const sec =
          (DELAY_BEATS[choiceIndex(f.params.time ?? 0.4, DELAY_BEATS.length)]! * 60) / song.bpm;
        const fb = Math.max(0.05, (f.params.feedback ?? 0.4) * 0.85);
        tail = Math.max(tail, (sec * Math.log(0.001)) / Math.log(fb));
      }
    }
  }
  return Math.min(MAX_TAIL, tail);
}

export interface RenderPlan {
  /** song beats to schedule, in order */
  beats: number[];
  /** beats where playback "jumps" (start or loop restart) */
  jumps: Set<number>;
  ctx: PlayContext;
  musicSeconds: number;
  totalSeconds: number;
}

export function planRender(song: Song, ctx: PlayContext, range: RenderRange): RenderPlan {
  const beatSec = beatSeconds(song.bpm);
  let beats: number[];
  const jumps = new Set<number>([0]);
  let playCtx: PlayContext;
  if (range === 'song') {
    playCtx = { ...ctx, playMode: 'song' };
    beats = Array.from({ length: song.lengthBars * BEATS_PER_BAR }, (_, i) => i);
  } else {
    playCtx = { ...ctx, playMode: 'pattern' };
    const r = getLoopRegion(song, playCtx);
    const n = r.lengthBars * BEATS_PER_BAR;
    beats = Array.from(
      { length: n * range.loopRepeats },
      (_, i) => r.startBar * BEATS_PER_BAR + (i % n),
    );
    for (let k = 1; k < range.loopRepeats; k++) jumps.add(k * n);
  }
  const musicSeconds = beats.length * beatSec;
  return {
    beats,
    jumps,
    ctx: playCtx,
    musicSeconds,
    totalSeconds: musicSeconds + tailSeconds(song),
  };
}

/** Load every sound the song needs (throws if one can't be loaded). */
export async function preloadSongSamples(song: Song) {
  const ids = [
    ...new Set(song.tracks.map((t) => t.sample?.sampleId).filter((x): x is string => !!x)),
  ];
  await Promise.all(ids.map((id) => SampleRegistry.get(id)));
}

/**
 * Render offline through the exact same engine code as live playback
 * (voices, sample edits, effects, automation, limiter).
 */
export async function renderSong(
  song: Song,
  ctx: PlayContext,
  range: RenderRange,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  await preloadSongSamples(song);
  const plan = planRender(song, ctx, range);
  const beatSec = beatSeconds(song.bpm);
  const out = await Tone.Offline(
    async () => {
      const g = new GraphSet(song);
      g.automated = automatedSet(song);
      await g.ready();
      plan.beats.forEach((b, i) =>
        scheduleBeat(g, song, plan.ctx, b, i * beatSec, plan.jumps.has(i)),
      );
    },
    plan.totalSeconds,
    2,
    sampleRate,
  );
  return out.get() as AudioBuffer;
}
