import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { SynthVoice } from './voices/synthVoice';
import { createSynthTrack } from '@/model/factories';
import { midiToFreq } from '@/model/scale';
import { PRESETS } from './synthPresets';

function dominantFreq(data: Float32Array, sr: number): number {
  // zero-crossing estimate over the steady middle part
  let crossings = 0;
  const from = Math.floor(data.length * 0.2);
  const to = Math.floor(data.length * 0.7);
  for (let i = from + 1; i < to; i++) if (data[i - 1]! <= 0 && data[i]! > 0) crossings++;
  return crossings / ((to - from) / sr);
}

describe('synth voice', () => {
  it('plays the expected pitch', async () => {
    const t = createSynthTrack({ presetId: 'sub-bass', macros: { tone: 1, space: 0 } });
    const midi = 57; // A3 → with octaveShift -1 → A2 = 110 Hz
    const out = await Tone.Offline(
      () => {
        const dest = new Tone.Gain().toDestination();
        const v = new SynthVoice(t.synth!, dest);
        v.trigger(midi, 0.8, 0, 1);
      },
      0.8,
      1,
      44100,
    );
    const f = dominantFreq(out.getChannelData(0), 44100);
    expect(Math.abs(f - midiToFreq(midi - 12)) / midiToFreq(midi - 12)).toBeLessThan(0.02);
  });

  it.each(PRESETS.map((p) => p.id))('preset %s makes a clean, audible sound', async (presetId) => {
    const t = createSynthTrack({ presetId, macros: { space: 0 } });
    const out = await Tone.Offline(
      () => {
        const dest = new Tone.Gain().toDestination();
        const v = new SynthVoice(t.synth!, dest);
        v.trigger(60, 1, 0, 0.9);
      },
      1.2,
      1,
      44100,
    );
    const d = out.getChannelData(0);
    let peak = 0;
    let bad = false;
    for (const x of d) {
      if (!Number.isFinite(x)) bad = true;
      peak = Math.max(peak, Math.abs(x));
    }
    expect(bad).toBe(false);
    expect(peak).toBeGreaterThan(0.02);
    expect(peak).toBeLessThan(1.5);
  });

  it('reuses finished voices instead of piling them up', async () => {
    const t = createSynthTrack({ presetId: 'soft-pluck', macros: { length: 0 } });
    let counts: number[] = [];
    await Tone.Offline(
      () => {
        const v = new SynthVoice(t.synth!, new Tone.Gain().toDestination());
        // 16 short notes one after another: one voice is enough
        for (let i = 0; i < 16; i++) v.trigger(60, 0.05, i * 0.5, 0.8);
        counts.push(v.voiceCount);
        // a 4-note chord needs 4
        for (const m of [60, 64, 67, 71]) v.trigger(m, 1, 9, 0.8);
        counts.push(v.voiceCount);
        // more than 8 at once never grows past 8 (extra notes at the same instant are dropped)
        for (let i = 0; i < 12; i++) v.trigger(60 + i, 2, 12, 0.8);
        counts.push(v.voiceCount);
        // a later note steals the voice that frees first
        v.trigger(50, 0.5, 12.5, 0.8);
        counts.push(v.voiceCount);
      },
      0.1,
      1,
      44100,
    );
    expect(counts).toEqual([1, 4, 8, 8]);
    counts = [];
  });

  it('frees voices that have been silent for a while', async () => {
    const t = createSynthTrack({ presetId: 'soft-pluck', macros: { length: 0 } });
    await Tone.Offline(
      () => {
        const v = new SynthVoice(t.synth!, new Tone.Gain().toDestination());
        for (const m of [60, 64, 67]) v.trigger(m, 0.1, 0, 0.8);
        v.prune(0.5);
        expect(v.voiceCount).toBe(3);
        v.prune(5);
        expect(v.voiceCount).toBe(0);
        // and plays again afterwards
        v.trigger(60, 0.1, 6, 0.8);
        expect(v.voiceCount).toBe(1);
      },
      0.1,
      1,
      44100,
    );
  });

  it('holds live notes until released', async () => {
    const t = createSynthTrack({ presetId: 'soft-pluck' });
    await Tone.Offline(
      () => {
        const v = new SynthVoice(t.synth!, new Tone.Gain().toDestination());
        const f = v.attack(60, 0, 0.8);
        v.prune(100);
        expect(v.voiceCount).toBe(1);
        v.release(f, 0.2);
        v.prune(100);
        expect(v.voiceCount).toBe(0);
      },
      0.1,
      1,
      44100,
    );
  });

  it('only builds the vibrato when a preset uses it', async () => {
    const withVib = PRESETS.find((p) => (p.vibratoDepth ?? 0) > 0)!;
    const without = PRESETS.find((p) => !p.vibratoDepth)!;
    await Tone.Offline(
      () => {
        const dest = new Tone.Gain().toDestination();
        const a = new SynthVoice(createSynthTrack({ presetId: without.id }).synth!, dest);
        const b = new SynthVoice(createSynthTrack({ presetId: withVib.id }).synth!, dest);
        expect(a.hasVibrato).toBe(false);
        expect(b.hasVibrato).toBe(true);
        b.apply({
          ...createSynthTrack({ presetId: withVib.id }).synth!,
          advanced: { vibratoDepth: 0 },
        });
        expect(b.hasVibrato).toBe(false);
      },
      0.1,
      1,
      44100,
    );
  });
});
