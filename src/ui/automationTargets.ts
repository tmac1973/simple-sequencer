import { FX_DEFS } from '@/audio/effects/registry';
import { targetKey } from '@/model/automation';
import { dbToSlider, sliderToDb } from '@/model/mixing';
import { LFO_RATE_SHORT, rateIndexOf } from '@/model/lfo';
import type { AutomationTarget, LfoSettings, Track } from '@/model/types';
import { fmtPan, fmtPct, knobToPan } from './inspector/format';

export interface TargetOption {
  target: AutomationTarget;
  label: string;
  format: (v: number) => string;
}

const fmtDb = (v: number) => {
  const d = sliderToDb(v);
  return !Number.isFinite(d) ? '−∞ dB' : `${d > 0 ? '+' : ''}${d.toFixed(1)} dB`;
};

/** Everything on a track that can have an automation lane. */
export function targetsFor(track: Track): TargetOption[] {
  const out: TargetOption[] = [
    { target: { kind: 'track', param: 'volume' }, label: 'Volume', format: fmtDb },
    { target: { kind: 'track', param: 'pan' }, label: 'Pan', format: (v) => fmtPan(knobToPan(v)) },
  ];
  if (track.kind === 'synth') {
    out.push({ target: { kind: 'synthMacro', macro: 'tone' }, label: 'Tone', format: fmtPct });
    out.push({ target: { kind: 'synthMacro', macro: 'space' }, label: 'Space', format: fmtPct });
  } else {
    out.push({ target: { kind: 'sampleTone' }, label: 'Tone', format: fmtPct });
  }
  for (const f of track.fx) {
    const d = FX_DEFS[f.type];
    for (const p of d.main)
      if (!p.choices)
        out.push({
          target: { kind: 'fx', fxId: f.id, param: p.key },
          label: `${d.name} · ${p.label}`,
          format: p.format,
        });
  }
  // each wobble's amount and speed can be automated too
  const base = [...out];
  for (const l of track.automation) {
    if (l.mode !== 'lfo') continue;
    const k = targetKey(l.target);
    const name = base.find((o) => targetKey(o.target) === k)?.label ?? 'Knob';
    out.push({
      target: { kind: 'lfo', laneId: l.id, param: 'amount' },
      label: `${name} · wobble amount`,
      format: fmtPct,
    });
    out.push({
      target: { kind: 'lfo', laneId: l.id, param: 'speed' },
      label: `${name} · wobble speed`,
      format: (v) => LFO_RATE_SHORT[rateIndexOf(v)]!,
    });
  }
  return out;
}

export function targetOption(track: Track, target: AutomationTarget): TargetOption {
  const k = targetKey(target);
  return (
    targetsFor(track).find((o) => targetKey(o.target) === k) ?? {
      target,
      label: 'Unknown',
      format: fmtPct,
    }
  );
}

export { dbToSlider };

export interface QuickWobble {
  id: string;
  label: string;
  target: AutomationTarget;
  lfo: LfoSettings;
}

/** One-click wobbles for a track (only ones that make sense for it). */
export function quickWobbles(track: Track): QuickWobble[] {
  const tone: AutomationTarget =
    track.kind === 'synth' ? { kind: 'synthMacro', macro: 'tone' } : { kind: 'sampleTone' };
  const vol = dbToSlider(track.volumeDb);
  return [
    {
      id: 'wobble',
      label: track.kind === 'synth' ? 'Wobble bass' : 'Filter wobble',
      target: tone,
      lfo: { shape: 'sine', rate: 1, depth: 0.7, center: 0.45 },
    },
    {
      id: 'tremolo',
      label: 'Tremolo',
      target: { kind: 'track', param: 'volume' },
      lfo: { shape: 'sine', rate: 0, depth: 0.3, center: Math.max(0.15, vol - 0.15) },
    },
    {
      id: 'autopan',
      label: 'Auto-pan',
      target: { kind: 'track', param: 'pan' },
      lfo: { shape: 'sine', rate: 4, depth: 0.8, center: 0.5 },
    },
    {
      id: 'sweep',
      label: 'Slow sweep',
      target: tone,
      lfo: { shape: 'triangle', rate: 7, depth: 0.6, center: 0.5 },
    },
  ];
}
