import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { GraphSet, scheduleBeat } from './engine';
import { DEV_SAMPLES } from './devSamples';
import { SampleRegistry } from './sampleRegistry';
import { createSampleTrack, createSong } from '@/model/factories';
import { softClip, CLIP_CEILING } from './master';

describe('engine (offline)', () => {
  it('renders a 1-bar song with the first transient at the start (plus limiter latency)', async () => {
    SampleRegistry.register('dev:kick', await DEV_SAMPLES['dev:kick']!());
    const t = createSampleTrack({ sampleId: 'dev:kick' });
    t.patterns[0]!.steps = [0, 4, 8, 12].map((index) => ({ index, velocity: 1 }));
    t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
    const song = createSong({ bpm: 120, lengthBars: 1, tracks: [t] });
    const ctx = { playMode: 'song' as const, selectedTrackId: null, selectedPatternId: {} };
    const out = await Tone.Offline(
      () => {
        const g = new GraphSet(song);
        for (let b = 0; b < 4; b++) scheduleBeat(g, song, ctx, b, b * 0.5);
      },
      2.2,
      1,
      44100,
    );
    const d = out.getChannelData(0);
    let first = -1;
    let peak = 0;
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]!);
      if (first < 0 && a > 0.01) first = i;
      peak = Math.max(peak, a);
    }
    expect(first).toBeGreaterThanOrEqual(0);
    // The master limiter (DynamicsCompressor) adds a constant ~6 ms lookahead delay in Chromium.
    expect(first).toBeLessThan(64 + 300);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(CLIP_CEILING + 1e-3);
  });

  it('soft clipper is transparent below -6 dBFS and never exceeds the ceiling', () => {
    expect(softClip(0.3)).toBe(0.3);
    expect(softClip(5)).toBeLessThanOrEqual(CLIP_CEILING);
    expect(softClip(-5)).toBeGreaterThanOrEqual(-CLIP_CEILING);
  });
});
