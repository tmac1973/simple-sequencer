import { describe, it, expect } from 'vitest';
import { engine } from './engine';
import { DEV_SAMPLES } from './devSamples';
import { SampleRegistry } from './sampleRegistry';
import { createSampleTrack, createSong } from '@/model/factories';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('stand-alone song preview (pattern ideas)', () => {
  it('loops on its own graph and leaves the real song alone', async () => {
    SampleRegistry.register('dev:kick', await DEV_SAMPLES['dev:kick']!());
    const real = createSong({ tracks: [createSampleTrack({ sampleId: 'dev:kick' })] });
    engine.setSong(real);
    const before = engine.getGraphs();

    const t = createSampleTrack({ sampleId: 'dev:kick' });
    t.patterns[0]!.steps = [{ index: 0, velocity: 1 }];
    t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
    const preview = createSong({ bpm: 120, lengthBars: 1, tracks: [t] });

    const p = engine.previewSong(preview);
    expect(engine.previewingSong).toBe(true);
    await p;
    await wait(150);
    expect(engine.previewingSong).toBe(true);
    expect(engine.playing).toBe(false); // the song's own transport didn't start
    expect(engine.getGraphs()).toBe(before);

    engine.stopSongPreview();
    expect(engine.previewingSong).toBe(false);
  });

  it('a newer preview or stop cancels one that is still loading', async () => {
    const mk = () => {
      const t = createSampleTrack({ sampleId: 'dev:kick' });
      t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
      return createSong({ lengthBars: 1, tracks: [t] });
    };
    const first = engine.previewSong(mk());
    engine.stopSongPreview();
    await first;
    expect(engine.previewingSong).toBe(false);

    // starting the real song stops a preview
    await engine.previewSong(mk());
    expect(engine.previewingSong).toBe(true);
    engine.setSong(mk());
    await engine.play();
    expect(engine.previewingSong).toBe(false);
    engine.stop();
  });
});
