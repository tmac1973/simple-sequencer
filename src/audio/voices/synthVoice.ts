import * as Tone from 'tone';
import type { SynthTrackSettings } from '@/model/types';
import { midiToFreq } from '@/model/scale';
import { getPreset } from '../synthPresets';
import { resolveSynthParams, type ResolvedSynth } from '../macros';

/**
 * One synth track's instrument:
 * PolySynth(MonoSynth) → Tone filter → vibrato → "Space" reverb → track input.
 */
export class SynthVoice {
  readonly poly: Tone.PolySynth<Tone.MonoSynth>;
  readonly toneFilter = new Tone.Filter({ type: 'lowpass', frequency: 4000, rolloff: -12, Q: 0.5 });
  readonly vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 });
  readonly space = new Tone.Freeverb({ roomSize: 0.6, dampening: 3500, wet: 0 });
  private settings: SynthTrackSettings | null = null;
  octaveShift = 0;

  constructor(settings: SynthTrackSettings, dest: Tone.InputNode) {
    this.poly = new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 8 });
    this.poly.chain(this.toneFilter, this.vibrato, this.space);
    this.space.connect(dest);
    this.poly.volume.value = -8;
    this.apply(settings);
  }

  params(): ResolvedSynth | null {
    if (!this.settings) return null;
    return resolveSynthParams(
      getPreset(this.settings.presetId),
      this.settings.macros,
      this.settings.advanced,
    );
  }

  /** `skip` = macros currently driven by automation (leave those params alone). */
  apply(settings: SynthTrackSettings, skip?: { tone?: boolean; space?: boolean }) {
    if (this.settings === settings) return;
    this.settings = settings;
    const preset = getPreset(settings.presetId);
    const p = resolveSynthParams(preset, settings.macros, settings.advanced);
    this.octaveShift = preset.octaveShift;
    this.poly.set({
      oscillator: { type: p.oscType } as Tone.OmniOscillatorOptions,
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
      filter: { Q: p.filterQ, type: 'lowpass', rolloff: -24 },
      filterEnvelope: {
        attack: Math.max(0.001, p.attack),
        decay: 0.15 + p.decay * 0.5,
        sustain: 0.35,
        release: p.release,
        baseFrequency: p.filterCutoffHz,
        octaves: p.filterEnvAmount,
      },
      portamento: p.glide,
    });
    if (!skip?.tone) this.toneFilter.frequency.rampTo(p.toneCutoffHz, 0.03);
    this.vibrato.frequency.value = p.vibratoRate;
    this.vibrato.depth.rampTo(p.vibratoDepth, 0.03);
    if (!skip?.space) this.space.wet.rampTo(p.spaceWet, 0.03);
  }

  trigger(midi: number, durationSec: number, time: number, velocity: number) {
    const freq = midiToFreq(midi + this.octaveShift * 12);
    this.poly.triggerAttackRelease(freq, Math.max(0.02, durationSec), time, velocity);
  }

  releaseAll() {
    this.poly.releaseAll();
  }

  dispose() {
    this.poly.dispose();
    this.toneFilter.dispose();
    this.vibrato.dispose();
    this.space.dispose();
  }
}
