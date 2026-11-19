import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { GraphSet, scheduleBeat } from './engine';
import { createLane, createSampleTrack, createSong } from '@/model/factories';
import { SampleRegistry } from './sampleRegistry';

describe('automation (offline)', () => {
  it('a volume lane changes loudness between the two halves', async () => {
    const tone = new AudioBuffer({ length: 44100 * 3, numberOfChannels: 1, sampleRate: 44100 });
    const d = tone.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i / 10) * 0.5;
    SampleRegistry.register('test:drone', tone);
    const t = createSampleTrack({ sampleId: 'test:drone' });
    t.patterns[0]!.steps = [{ index: 0, velocity: 1 }];
    t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
    t.automation = [
      createLane({ kind: 'track', param: 'volume' }, [
        { bar: 0, value: 0.7 },
        { bar: 0.5, value: 0.7 },
        { bar: 0.5, value: 0.1 },
      ]),
    ];
    const song = createSong({ bpm: 120, lengthBars: 1, tracks: [t] });
    const ctx = { playMode: 'song' as const, selectedTrackId: null, selectedPatternId: {} };
    const out = await Tone.Offline(
      () => {
        const g = new GraphSet(song);
        for (let b = 0; b < 4; b++) scheduleBeat(g, song, ctx, b, b * 0.5, b === 0);
      },
      2,
      1,
      44100,
    );
    const x = out.getChannelData(0);
    const rms = (a: number, z: number) => {
      let s = 0;
      for (let i = a; i < z; i++) s += x[i]! * x[i]!;
      return Math.sqrt(s / (z - a));
    };
    expect(rms(0, 40000)).toBeGreaterThan(rms(48000, 88000) * 5);
  });
});
