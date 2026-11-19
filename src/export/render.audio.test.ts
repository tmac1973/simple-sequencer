import { describe, it, expect } from 'vitest';
import { renderSong } from './render';
import { SampleRegistry } from '@/audio/sampleRegistry';
import { DEV_SAMPLES } from '@/audio/devSamples';
import { createSampleTrack, createSong } from '@/model/factories';
import { CLIP_CEILING } from '@/audio/master';

const ctx = { playMode: 'song' as const, selectedTrackId: null, selectedPatternId: {} };

describe('offline render', () => {
  it('starts on time, has the right length, and never exceeds the ceiling with 10 stacked tracks', async () => {
    SampleRegistry.register('dev:kick', await DEV_SAMPLES['dev:kick']!());
    const tracks = Array.from({ length: 10 }, () => {
      const t = createSampleTrack({ sampleId: 'dev:kick', volumeDb: 6 });
      t.patterns[0]!.steps = [0, 4, 8, 12].map((index) => ({ index, velocity: 1 }));
      t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
      return t;
    });
    const song = createSong({ bpm: 120, lengthBars: 1, tracks });
    const buf = await renderSong(song, ctx, 'song');
    expect(buf.duration).toBeCloseTo(2 + 2, 1); // 1 bar at 120 BPM + 2 s tail
    const d = buf.getChannelData(0);
    let first = -1;
    let peak = 0;
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]!);
      if (first < 0 && a > 0.01) first = i;
      peak = Math.max(peak, a);
    }
    expect(first).toBeLessThan(64 + 300); // + limiter lookahead
    expect(peak).toBeLessThanOrEqual(CLIP_CEILING + 1e-4);
    expect(20 * Math.log10(peak)).toBeLessThanOrEqual(-0.29);
  });
});
