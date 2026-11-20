import { useState } from 'react';
import type { OscType, SynthAdvanced, Track } from '@/model/types';
import { CATEGORY_LABEL, PRESETS, getPreset, type PresetCategory } from '@/audio/synthPresets';
import { resolveSynthParams } from '@/audio/macros';
import { engine } from '@/audio/engine';
import { useSongStore } from '@/store/songStore';
import { Knob } from '../components/Knob';
import { Chip } from '../components/controls';
import { tip } from '../tooltips';
import { fmtPan, fmtPct, knobToPan, panToKnob } from './format';
import { useAutoKnob } from '../hooks/useAutoKnob';
import styles from './Inspector.module.css';
import { convertLabel, convertTrack } from '../convertTrack';

const OSC: { value: OscType; label: string }[] = [
  { value: 'sine', label: 'Sine (pure)' },
  { value: 'triangle', label: 'Triangle (soft)' },
  { value: 'sawtooth', label: 'Saw (buzzy)' },
  { value: 'square', label: 'Square (hollow)' },
  { value: 'fmsine', label: 'FM (bell-like)' },
  { value: 'fatsawtooth', label: 'Fat saw (wide)' },
  { value: 'fatsquare', label: 'Fat square (organ-ish)' },
  { value: 'fattriangle', label: 'Fat triangle (soft & wide)' },
  { value: 'amsine', label: 'AM (breathy)' },
  { value: 'fmsquare', label: 'FM square (growly)' },
];

interface AdvDef {
  key: Exclude<keyof SynthAdvanced, 'oscType'>;
  label: string;
  lo: number;
  hi: number;
  exp?: boolean;
  fmt: (v: number) => string;
}
const sec = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
const ADV: AdvDef[] = [
  { key: 'attack', label: 'Attack', lo: 0.001, hi: 2, exp: true, fmt: sec },
  { key: 'decay', label: 'Decay', lo: 0.02, hi: 4, exp: true, fmt: sec },
  { key: 'sustain', label: 'Sustain', lo: 0, hi: 1, fmt: fmtPct },
  { key: 'release', label: 'Release', lo: 0.02, hi: 5, exp: true, fmt: sec },
  {
    key: 'filterCutoffHz',
    label: 'Filter',
    lo: 60,
    hi: 8000,
    exp: true,
    fmt: (v) => `${Math.round(v)} Hz`,
  },
  { key: 'filterQ', label: 'Resonance', lo: 0.3, hi: 12, exp: true, fmt: (v) => v.toFixed(1) },
  { key: 'filterEnvAmount', label: 'Filter env', lo: 0, hi: 5, fmt: (v) => `${v.toFixed(1)} oct` },
  { key: 'vibratoRate', label: 'Vibrato rate', lo: 0.5, hi: 10, fmt: (v) => `${v.toFixed(1)} Hz` },
  { key: 'vibratoDepth', label: 'Vibrato', lo: 0, hi: 1, fmt: fmtPct },
  { key: 'glide', label: 'Glide', lo: 0, hi: 0.3, fmt: sec },
];
const toKnob = (d: AdvDef, v: number) =>
  d.exp ? Math.log(v / d.lo) / Math.log(d.hi / d.lo) : (v - d.lo) / (d.hi - d.lo);
const fromKnob = (d: AdvDef, k: number) =>
  d.exp ? d.lo * (d.hi / d.lo) ** k : d.lo + k * (d.hi - d.lo);

export function SynthSoundTab({ track }: { track: Track }) {
  const s = track.synth!;
  const a = useSongStore.getState();
  const [open, setOpen] = useState(false);
  const resolved = resolveSynthParams(getPreset(s.presetId), s.macros, s.advanced);
  const cats = Object.keys(CATEGORY_LABEL) as PresetCategory[];
  const toneA = useAutoKnob(track, { kind: 'synthMacro', macro: 'tone' });
  const spaceA = useAutoKnob(track, { kind: 'synthMacro', macro: 'space' });
  const panA = useAutoKnob(track, { kind: 'track', param: 'pan' });
  const setAdv = (patch: Partial<SynthAdvanced>, g?: string) =>
    a.setSynthSettings(track.id, { advanced: { ...s.advanced, ...patch } }, g);

  return (
    <>
      <div className="sect" {...tip('preset')}>
        Preset
      </div>
      {cats.map((c) => (
        <div key={c} style={{ marginBottom: 8 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            {CATEGORY_LABEL[c]}
          </div>
          <div className={styles.presets}>
            {PRESETS.filter((p) => p.category === c).map((p) => (
              <Chip
                key={p.id}
                on={p.id === s.presetId}
                tipKey="preset"
                onClick={() => {
                  a.setSynthSettings(track.id, { presetId: p.id });
                  setTimeout(() => void engine.auditionNote(track.id, 0), 30);
                }}
              >
                {p.name}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      <div className="sect" style={{ marginTop: 14 }}>
        Shape the sound
      </div>
      <div className={styles.knobs} style={{ marginTop: 4 }}>
        <Knob
          label="Tone"
          tipKey="macroTone"
          color={track.color}
          value={toneA.live ?? s.macros.tone}
          automated={toneA.automated}
          defaultValue={0.55}
          format={(v) => (v < 0.35 ? 'Darker' : v > 0.75 ? 'Brighter' : fmtPct(v))}
          onChange={(v, g) => a.setSynthMacro(track.id, 'tone', v, g)}
        />
        <Knob
          label="Punch"
          tipKey="macroPunch"
          color={track.color}
          value={s.macros.punch}
          defaultValue={0.5}
          onChange={(v, g) => a.setSynthMacro(track.id, 'punch', v, g)}
        />
        <Knob
          label="Space"
          tipKey="macroSpace"
          color={track.color}
          value={spaceA.live ?? s.macros.space}
          automated={spaceA.automated}
          defaultValue={0.2}
          onChange={(v, g) => a.setSynthMacro(track.id, 'space', v, g)}
        />
        <Knob
          label="Length"
          tipKey="macroLength"
          color={track.color}
          value={s.macros.length}
          defaultValue={0.5}
          onChange={(v, g) => a.setSynthMacro(track.id, 'length', v, g)}
        />
      </div>
      <div className={styles.knobs}>
        <Knob
          label="Pan"
          tipKey="pan"
          color={track.color}
          value={panA.live ?? panToKnob(track.pan)}
          automated={panA.automated}
          defaultValue={0.5}
          format={(v) => fmtPan(knobToPan(v))}
          onChange={(v, g) => a.setPan(track.id, knobToPan(v), g)}
        />
        <Knob
          label="Humanize"
          tipKey="humanize"
          color={track.color}
          value={track.humanize ?? 0}
          defaultValue={0}
          format={(v) => (v < 0.01 ? 'Off' : `${Math.round(v * 100)}%`)}
          onChange={(v, g) => a.setHumanize(track.id, v, g)}
        />
      </div>
      <button
        className={styles.adv}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        {...tip('advanced')}
      >
        {open ? '▾' : '▸'} Advanced settings
      </button>
      {open && (
        <>
          <div className={styles.lineField}>
            <span>Waveform</span>
            <select
              aria-label="Waveform"
              value={resolved.oscType}
              onChange={(e) => setAdv({ oscType: e.target.value as OscType })}
            >
              {OSC.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.advBody}>
            {ADV.map((d) => (
              <Knob
                key={d.key}
                label={d.label}
                size={42}
                color={s.advanced[d.key] !== undefined ? 'var(--warn)' : track.color}
                value={Math.min(1, Math.max(0, toKnob(d, resolved[d.key])))}
                format={() => d.fmt(resolved[d.key])}
                defaultValue={toKnob(
                  d,
                  resolveSynthParams(getPreset(s.presetId), s.macros, {})[d.key],
                )}
                onChange={(k, g) => setAdv({ [d.key]: fromKnob(d, k) }, g)}
              />
            ))}
          </div>
          <button
            style={{ marginTop: 10 }}
            onClick={() => a.setSynthSettings(track.id, { advanced: {} })}
            disabled={Object.keys(s.advanced).length === 0}
            {...tip('resetPreset')}
          >
            Reset to preset
          </button>
        </>
      )}
      <button
        className={styles.convertBtn}
        onClick={() => convertTrack(track.id)}
        {...tip('toSample')}
      >
        {convertLabel(track)}
      </button>
    </>
  );
}
