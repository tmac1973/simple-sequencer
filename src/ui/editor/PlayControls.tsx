import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Pattern, Track } from '@/model/types';
import { useUiStore } from '@/store/uiStore';
import { Segmented, Toggle } from '../components/controls';
import { usePlayDerived } from '../hooks/usePlayhead';
import { tip } from '../tooltips';
import { useKeysOctave } from '../keyboardPiano';
import { disableMidi, enableMidi, setMidiDevice, useMidi } from '../midi';
import {
  setRecSettings,
  startRecording,
  stopRecording,
  useRec,
  useRecSettings,
  type RecSnap,
} from '../takeRecorder';
import styles from './PlayControls.module.css';

/** A small panel under a button; closes on an outside click or Esc. */
function Popover({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const anchor = ref.current?.parentElement;
      if (anchor && !anchor.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={styles.pop} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

function KeysButton() {
  const on = useUiStore((s) => s.keysOn);
  const octave = useKeysOctave((s) => s.octave);
  return (
    <button
      className={`small ${styles.btn} ${on ? styles.on : ''}`}
      aria-pressed={on}
      aria-label="Keys: notes from your computer keyboard"
      onClick={() => useUiStore.getState().setKeysOn(!on)}
      {...tip('keys')}
    >
      🎹
      {on && octave !== 0 && (
        <span className={styles.oct}>
          {octave > 0 ? '+' : ''}
          {octave}
        </span>
      )}
    </button>
  );
}

const STATUS_TEXT = {
  unsupported: 'This browser can’t use MIDI keyboards. Try Chrome, Edge or Firefox.',
  off: 'Turn on to play with a MIDI keyboard.',
  asking: 'Waiting for the browser to allow MIDI…',
  denied: 'The browser didn’t allow MIDI. Check the site permissions, then try again.',
} as const;

function MidiButton() {
  const { status, devices, deviceId } = useMidi();
  const [open, setOpen] = useState(false);
  const on = status === 'on';
  return (
    <div className={styles.anchor}>
      <button
        className={`small ${styles.btn} ${on ? styles.on : ''}`}
        aria-expanded={open}
        aria-label="MIDI keyboard"
        onClick={() => setOpen(!open)}
        {...tip('midi')}
      >
        🎛 MIDI {on && <span className={devices.length ? styles.dotOn : styles.dotOff} />}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} label="MIDI keyboard settings">
        <h4>🎛 MIDI keyboard</h4>
        <label
          className={styles.row}
          data-tip="MIDI input|Turn on to play with a MIDI keyboard. The first time, the browser asks if that’s OK."
        >
          <span>MIDI input</span>
          <Toggle
            on={on || status === 'asking'}
            label="MIDI input"
            onChange={(v) => (v ? void enableMidi() : disableMidi())}
          />
        </label>
        {on && (
          <>
            <label className={styles.row}>
              <span>Device</span>
              <select
                aria-label="MIDI device"
                value={deviceId}
                onChange={(e) => setMidiDevice(e.target.value)}
              >
                <option value="all">All devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="small">
              {devices.length ? (
                <>
                  <span className={styles.dotOn} /> Connected:{' '}
                  {devices
                    .filter((d) => deviceId === 'all' || d.id === deviceId)
                    .map((d) => d.name)
                    .join(', ')}
                </>
              ) : (
                <>
                  <span className={styles.dotOff} /> No MIDI keyboard found. Plug one in and it’ll
                  appear here.
                </>
              )}
            </div>
          </>
        )}
        {!on && <div className="small">{STATUS_TEXT[status]}</div>}
        <div className="small muted" style={{ marginTop: 8 }}>
          Notes outside the key play the nearest note in it. In “Show all drums”, pads from C1 (note
          36) up play each drum. Works in Chrome, Edge and Firefox (not Safari).
        </div>
      </Popover>
    </div>
  );
}

function RecButton({ track, pattern }: { track: Track; pattern: Pattern }) {
  const rec = useRec();
  const settings = useRecSettings();
  const [open, setOpen] = useState(false);
  const counting = usePlayDerived((pos) => rec.recording && pos === null);
  const mine = rec.recording && rec.trackId === track.id;
  return (
    <div className={styles.anchor}>
      <span className={styles.recGroup}>
        <button
          className={`small ${styles.rec} ${mine ? styles.recOn : ''}`}
          aria-pressed={mine}
          aria-label={mine ? 'Stop recording' : 'Record into this pattern'}
          onClick={() => (mine ? stopRecording() : void startRecording(track.id, pattern.id))}
          {...tip('rec')}
        >
          {mine
            ? counting
              ? '● Count-in…'
              : `■ Stop rec${rec.added ? ` · ${rec.added}` : ''}`
            : '● Rec'}
        </button>
        <button
          className={`small ${styles.recMore}`}
          aria-label="Recording settings"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          {...tip('recSettings')}
        >
          ▾
        </button>
      </span>
      <Popover open={open} onClose={() => setOpen(false)} label="Recording settings">
        <h4>● Record</h4>
        <div
          className={styles.row}
          data-tip="Snap to|Where recorded notes land: the nearest step, the nearest 1/8 note, or the nearest beat. Bigger snaps tidy up timing more."
        >
          <span>Snap to</span>
          <Segmented<RecSnap>
            label="Snap recorded notes to"
            value={settings.snap}
            onChange={(snap) => setRecSettings({ snap })}
            options={[
              { value: 'step', label: 'Steps' },
              { value: 'eighth', label: '1/8' },
              { value: 'beat', label: 'Beats' },
            ]}
          />
        </div>
        <div
          className={styles.row}
          data-tip="Count-in|One bar of clicks before recording starts, so you can come in on time."
        >
          <span>Count-in</span>
          <Segmented<0 | 1>
            label="Count-in"
            value={settings.countIn}
            onChange={(countIn) => setRecSettings({ countIn })}
            options={[
              { value: 0, label: 'Off' },
              { value: 1, label: '1 bar' },
            ]}
          />
        </div>
        <label
          className={styles.row}
          data-tip="Click volume|How loud the metronome click is while you record. It's never in exports."
        >
          <span>Click volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            aria-label="Click volume"
            value={settings.clickVolume}
            onChange={(e) => setRecSettings({ clickVolume: Number(e.target.value) })}
          />
        </label>
        <div className="small muted">
          The pattern loops while you play, with a click on each beat. Every pass adds to it, and
          one undo removes the whole take. The click is never in your exports.
        </div>
      </Popover>
    </div>
  );
}

/** "Drag sets: Loudness / Chance" for the step grid. */
export function DragSetsSwitch() {
  const v = useUiStore((s) => s.dragSets);
  return (
    <div className={styles.inline}>
      <span>Drag sets</span>
      <Segmented
        label="Dragging a step sets"
        tipKey="dragSets"
        value={v}
        onChange={(x) => useUiStore.getState().setDragSets(x)}
        options={[
          { value: 'loudness', label: 'Loudness' },
          { value: 'chance', label: '🎲 Chance' },
        ]}
      />
    </div>
  );
}

/** 🎹 Keys · 🎛 MIDI · ● Rec, in the pattern editor's header. */
export function PlayControls({ track, pattern }: { track: Track; pattern: Pattern }) {
  return (
    <div className={styles.group}>
      <KeysButton />
      <MidiButton />
      <RecButton track={track} pattern={pattern} />
    </div>
  );
}
