import { useRef } from 'react';
import { engine } from '@/audio/engine';
import { newId } from '@/model/factories';
import type { SampleEdit } from '@/model/types';
import { soundInfo } from '@/library/soundNames';
import { useSongStore } from '@/store/songStore';
import { Knob } from '../components/Knob';
import { Modal, Toggle } from '../components/controls';
import { Waveform } from '../components/Waveform';
import { useSelection } from '../hooks/selection';
import { fmtPct, fmtSemis, knobToPitch, pitchToKnob } from '../inspector/format';
import { tip } from '../tooltips';

type Handle = 'start' | 'end' | 'loopStart';

export function SampleEditorModal({ onClose }: { onClose: () => void }) {
  const { track } = useSelection();
  const wave = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: Handle; g: string } | null>(null);
  const a = useSongStore.getState();
  if (!track?.sample) {
    return (
      <Modal
        title="Edit sample"
        onClose={onClose}
        width={520}
        footer={<button onClick={onClose}>Close</button>}
      >
        <p className="muted">Select a drum or sample track first.</p>
      </Modal>
    );
  }
  const s = track.sample;
  const e = s.edit;
  const set = (patch: Partial<SampleEdit>, g?: string) => a.setSampleEdit(track.id, patch, g);
  // Displayed positions follow the waveform direction (mirrored when reversed).
  const disp = (v: number) => (e.reverse ? 1 - v : v);
  const left = Math.min(disp(e.start), disp(e.end));
  const right = Math.max(disp(e.start), disp(e.end));

  const fracAt = (clientX: number) => {
    const r = wave.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const f = disp(fracAt(ev.clientX)); // back to sample-forward position
    if (d.h === 'start') set({ start: Math.min(f, e.end - 0.01) }, d.g);
    else if (d.h === 'end') set({ end: Math.max(f, e.start + 0.01) }, d.g);
    else set({ loopStart: Math.max(e.start, Math.min(e.end - 0.01, f)) }, d.g);
  };
  const handle = (h: Handle, pos: number, color: string, label: string, tipText: string) => (
    <div
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(pos * 100)}
      tabIndex={0}
      data-tip={tipText}
      onPointerDown={(ev) => {
        ev.stopPropagation();
        (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
        drag.current = { h, g: newId() };
      }}
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
      onKeyDown={(ev) => {
        const step = ev.shiftKey ? 0.002 : 0.01;
        const dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        ev.preventDefault();
        const cur = h === 'start' ? e.start : h === 'end' ? e.end : e.loopStart;
        const nv = Math.max(0, Math.min(1, cur + dir * step * (e.reverse ? -1 : 1)));
        if (h === 'start') set({ start: Math.min(nv, e.end - 0.01) });
        else if (h === 'end') set({ end: Math.max(nv, e.start + 0.01) });
        else set({ loopStart: Math.max(e.start, Math.min(e.end - 0.01, nv)) });
      }}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `calc(${pos * 100}% - 8px)`,
        width: 16,
        cursor: 'ew-resize',
        zIndex: 2,
      }}
    >
      <div
        style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 4, background: color }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 16,
          height: 16,
          borderRadius: 4,
          background: color,
        }}
      />
    </div>
  );

  return (
    <Modal
      title={
        <>
          Edit sample · <span className="muted">{soundInfo(s.sampleId).name}</span>
        </>
      }
      onClose={() => {
        engine.stopPreview();
        onClose();
      }}
      width={860}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            Edits only change this track. The original sound stays as it is.
          </span>
          <button
            data-tip="resetEdit"
            onClick={() =>
              a.setSampleEdit(track.id, {
                start: 0,
                end: 1,
                reverse: false,
                loop: false,
                loopStart: 0,
                tuneSemitones: 0,
                fadeOut: 0,
                normalize: false,
              })
            }
          >
            Reset
          </button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div
        ref={wave}
        style={{
          position: 'relative',
          height: 170,
          borderRadius: 12,
          background: '#151720',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
        aria-label="Waveform"
      >
        <Waveform sampleId={s.sampleId} color={track.color} height={170} reverse={e.reverse} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${left * 100}%`,
            background: 'rgba(0,0,0,.62)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${right * 100}%`,
            right: 0,
            background: 'rgba(0,0,0,.62)',
          }}
        />
        {handle(
          e.reverse ? 'end' : 'start',
          left,
          'var(--warn)',
          'Start',
          'Start|Drag to cut silence off the beginning.',
        )}
        {handle(
          e.reverse ? 'start' : 'end',
          right,
          'var(--warn)',
          'End',
          'End|Drag to shorten the sound.',
        )}
        {e.loop &&
          !e.reverse &&
          handle(
            'loopStart',
            e.loopStart,
            'var(--good)',
            'Loop point',
            'Loop point|While a note is held, the sound repeats from here to the end.',
          )}
      </div>
      <div
        style={{ display: 'flex', gap: 22, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}
      >
        <button onClick={() => void engine.preview(s.sampleId, s)} {...tip('preview')}>
          ▶ Preview
        </button>
        <label
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          data-tip="Reverse|Play the sound backwards."
        >
          ⇄ Reverse <Toggle on={e.reverse} onChange={(v) => set({ reverse: v })} label="Reverse" />
        </label>
        <label
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          data-tip="Loop|Repeat the sound while a note is held (great for pads and long melodic notes)."
        >
          🔁 Loop{' '}
          <Toggle
            on={e.loop}
            onChange={(v) =>
              set({ loop: v, loopStart: v ? Math.max(e.start, e.loopStart) : e.loopStart })
            }
            label="Loop"
          />
        </label>
        <label
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          data-tip="Normalize|Make the sound as loud as it can be without distorting."
        >
          Normalize{' '}
          <Toggle on={e.normalize} onChange={(v) => set({ normalize: v })} label="Normalize" />
        </label>
        <div className="spacer" />
        <Knob
          label="Tune"
          tipKey="pitch"
          color={track.color}
          value={pitchToKnob(e.tuneSemitones)}
          defaultValue={0.5}
          format={(v) => fmtSemis(knobToPitch(v))}
          onChange={(v, g) => set({ tuneSemitones: knobToPitch(v) }, g)}
        />
        <Knob
          label="Fade out"
          tipKey="decay"
          color={track.color}
          value={e.fadeOut}
          defaultValue={0}
          format={(v) => (v < 0.01 ? 'Off' : fmtPct(v))}
          onChange={(v, g) => set({ fadeOut: v }, g)}
        />
      </div>
    </Modal>
  );
}
