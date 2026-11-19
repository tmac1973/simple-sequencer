import { FX_DEFS } from '@/audio/effects/registry';
import { targetKey } from '@/model/automation';
import { dbToSlider, sliderToDb } from '@/model/mixing';
import type { AutomationTarget, Track } from '@/model/types';
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
