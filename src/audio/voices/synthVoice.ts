import * as Tone from 'tone';
import type { SynthTrackSettings } from '@/model/types';
import { midiToFreq } from '@/model/scale';
import { getPreset } from '../synthPresets';
import { resolveSynthParams, type ResolvedSynth } from '../macros';

const MAX_VOICES = 8;
/** extra time after the envelope's release before a voice counts as silent */
const RELEASE_PAD = 0.1;
/** live playback: free voices that have been silent this long (seconds) */
const IDLE_FREE_SEC = 1;

interface PooledVoice {
  synth: Tone.MonoSynth;
  /** audio time the voice is silent again (Infinity while a live note is held) */
  freeAt: number;
  /** audio time of its latest note (Tone can't restart a voice at or before this) */
  lastStart: number;
  /** frequency of a held live note, so `release` can find it */
  heldFreq?: number;
}

/**
 * One synth track's instrument:
 * voices (MonoSynth) → Tone filter → [vibrato, only when it's turned up] → "Space" room
 * reverb → track input.
 *
 * Voices are pooled by hand instead of with Tone.PolySynth: we know when every scheduled note
 * ends, so a finished voice is reused right away, and in live playback voices that have been
 * silent for a second are freed. (Tone keeps finished voices running, and each one costs about
 * as much audio-thread time as half a sounding note.)
 */
export class SynthVoice {
  private readonly bus = new Tone.Gain(Tone.dbToGain(-8));
  readonly toneFilter = new Tone.Filter({ type: 'lowpass', frequency: 4000, rolloff: -12, Q: 0.5 });
  private vibrato: Tone.Vibrato | null = null;
  /** "Space": a small convolution room (one ConvolverNode, cheap to run) */
  readonly space = new Tone.Reverb({ decay: 1.6, preDelay: 0.01, wet: 0 });
  private settings: SynthTrackSettings | null = null;
  private voiceOptions: NonNullable<ConstructorParameters<typeof Tone.MonoSynth>[0]> = {};
  private releaseSec = 0.5;
  private voices: PooledVoice[] = [];
  private pruneTimer: ReturnType<typeof setInterval> | undefined;
  octaveShift = 0;

  constructor(settings: SynthTrackSettings, dest: Tone.InputNode) {
    this.bus.connect(this.toneFilter);
    this.toneFilter.connect(this.space);
    this.space.connect(dest);
    this.apply(settings);
    if (!(this.bus.context instanceof Tone.OfflineContext))
      this.pruneTimer = setInterval(() => this.prune(), 500);
  }

  /** How many voices exist right now (sounding or waiting to be freed). */
  get voiceCount() {
    return this.voices.length;
  }

  /**
   * A voice that's silent by `time`, else a new one, else (at the limit) the one that frees
   * first. Null if every voice already starts a note at or after `time` (the note is dropped,
   * as Tone's PolySynth does).
   */
  private voiceAt(time: number): PooledVoice | null {
    const free = this.voices.find((v) => v.freeAt <= time && v.lastStart < time);
    if (free) return free;
    if (this.voices.length < MAX_VOICES) {
      const synth = new Tone.MonoSynth(this.voiceOptions).connect(this.bus);
      const v: PooledVoice = { synth, freeAt: 0, lastStart: -Infinity };
      this.voices.push(v);
      return v;
    }
    let steal: PooledVoice | null = null;
    for (const v of this.voices)
      if (v.lastStart < time && (!steal || v.freeAt < steal.freeAt)) steal = v;
    return steal;
  }

  /** Free voices that have been silent for a while (live playback only). */
  prune(now = this.bus.context.currentTime) {
    const keep: PooledVoice[] = [];
    for (const v of this.voices) {
      if (v.freeAt + IDLE_FREE_SEC < now) v.synth.dispose();
      else keep.push(v);
    }
    this.voices = keep;
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
    this.voiceOptions = {
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
    };
    this.releaseSec = p.release;
    for (const v of this.voices) v.synth.set(this.voiceOptions);
    if (!skip?.tone) this.toneFilter.frequency.rampTo(p.toneCutoffHz, 0.03);
    this.setVibrato(p.vibratoRate, p.vibratoDepth);
    if (!skip?.space) this.space.wet.rampTo(p.spaceWet, 0.03);
  }

  /** Insert the vibrato only while its depth is above zero (its LFO always costs CPU). */
  private setVibrato(rate: number, depth: number) {
    if (depth <= 0) {
      if (!this.vibrato) return;
      this.toneFilter.disconnect();
      this.toneFilter.connect(this.space);
      this.vibrato.dispose();
      this.vibrato = null;
      return;
    }
    if (!this.vibrato) {
      this.vibrato = new Tone.Vibrato({ frequency: rate, depth });
      this.toneFilter.disconnect();
      this.toneFilter.chain(this.vibrato, this.space);
      return;
    }
    this.vibrato.frequency.value = rate;
    this.vibrato.depth.rampTo(depth, 0.03);
  }

  /** Is the vibrato in the chain? (for tests) */
  get hasVibrato() {
    return this.vibrato !== null;
  }

  trigger(midi: number, durationSec: number, time: number, velocity: number) {
    const freq = midiToFreq(midi + this.octaveShift * 12);
    const dur = Math.max(0.02, durationSec);
    const v = this.voiceAt(time);
    if (!v) return;
    v.heldFreq = undefined;
    v.lastStart = time;
    v.freeAt = time + dur + this.releaseSec + RELEASE_PAD;
    v.synth.triggerAttackRelease(freq, dur, time, velocity);
  }

  /** Start a held note (live playing); returns what `release` needs. */
  attack(midi: number, time: number, velocity: number): number {
    const freq = midiToFreq(midi + this.octaveShift * 12);
    const v = this.voiceAt(time);
    if (!v) return freq;
    v.lastStart = time;
    v.heldFreq = freq;
    v.freeAt = Infinity;
    v.synth.triggerAttack(freq, time, velocity);
    return freq;
  }

  release(freq: number, time: number) {
    const v = this.voices.find((x) => x.heldFreq === freq && x.freeAt === Infinity);
    if (!v) return;
    v.heldFreq = undefined;
    v.freeAt = time + this.releaseSec + RELEASE_PAD;
    v.synth.triggerRelease(time);
  }

  releaseAll() {
    const now = this.bus.context.currentTime;
    for (const v of this.voices) {
      if (v.freeAt <= now) continue;
      v.heldFreq = undefined;
      v.freeAt = now + this.releaseSec + RELEASE_PAD;
      v.synth.triggerRelease(now);
    }
  }

  dispose() {
    clearInterval(this.pruneTimer);
    for (const v of this.voices) v.synth.dispose();
    this.voices = [];
    this.bus.dispose();
    this.toneFilter.dispose();
    this.vibrato?.dispose();
    this.space.dispose();
  }
}
