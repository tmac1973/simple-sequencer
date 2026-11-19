import { useRef, useState } from 'react';
import { newId } from '@/model/factories';
import { ROOT_NAMES, SCALES, SCALE_ORDER } from '@/model/scale';
import type { ScaleName } from '@/model/types';
import { MAX_BPM, MIN_BPM } from '@/model/constants';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { Segmented } from '../components/controls';
import { tip } from '../tooltips';
import { stopPlayback, togglePlay } from '../transport';
import { SaveStatus } from './SaveStatus';
import styles from './TopBar.module.css';

function Tempo() {
  const bpm = useSongStore((s) => s.song.bpm);
  const setBpm = useSongStore((s) => s.setBpm);
  const [editing, setEditing] = useState(false);
  const drag = useRef<{ y: number; v: number; id: string; moved: boolean } | null>(null);
  return (
    <div className={styles.field} {...tip('tempo')}>
      <span className={styles.flabel}>Tempo</span>
      <div className={styles.stepper}>
        <button aria-label="Slower" onClick={() => setBpm(bpm - 1)}>
          –
        </button>
        {editing ? (
          <input
            className={styles.bpmInput}
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            defaultValue={bpm}
            autoFocus
            aria-label="Tempo in BPM"
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) setBpm(v);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
              e.stopPropagation();
            }}
          />
        ) : (
          <b
            className={styles.bpm}
            role="spinbutton"
            aria-label="Tempo"
            aria-valuenow={bpm}
            tabIndex={0}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { y: e.clientY, v: bpm, id: newId(), moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const dy = d.y - e.clientY;
              if (Math.abs(dy) > 3) d.moved = true;
              if (d.moved) setBpm(d.v + Math.round(dy / 4), d.id);
            }}
            onPointerUp={() => {
              if (drag.current && !drag.current.moved) setEditing(true);
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') setBpm(bpm + 1);
              else if (e.key === 'ArrowDown') setBpm(bpm - 1);
              else if (e.key === 'Enter') setEditing(true);
              else return;
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {bpm}
          </b>
        )}
        <button aria-label="Faster" onClick={() => setBpm(bpm + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function KeyPicker() {
  const key = useSongStore((s) => s.song.key);
  const setKey = useSongStore((s) => s.setKey);
  return (
    <div className={styles.field}>
      <span className={styles.flabel}>Key</span>
      <div className={styles.keyRow}>
        <select
          aria-label="Key"
          value={key.root}
          onChange={(e) => setKey({ ...key, root: Number(e.target.value) })}
          {...tip('key')}
        >
          {ROOT_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Scale"
          value={key.scale}
          onChange={(e) => setKey({ ...key, scale: e.target.value as ScaleName })}
          {...tip('scale')}
        >
          {SCALE_ORDER.map((s) => (
            <option key={s} value={s}>
              {SCALES[s].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Swing() {
  const swing = useSongStore((s) => s.song.swing);
  const setSwing = useSongStore((s) => s.setSwing);
  const gesture = useRef(newId());
  return (
    <div className={styles.field} {...tip('swing')}>
      <label htmlFor="swing">Swing {Math.round(swing * 100)}%</label>
      <input
        id="swing"
        className={styles.slider}
        type="range"
        min={0}
        max={75}
        value={Math.round(swing * 100)}
        onPointerDown={() => (gesture.current = newId())}
        onChange={(e) => setSwing(Number(e.target.value) / 100, gesture.current)}
      />
    </div>
  );
}

export function TopBar() {
  const name = useSongStore((s) => s.song.name);
  const setName = useSongStore((s) => s.setName);
  const canUndo = useSongStore((s) => s.past.length > 0);
  const canRedo = useSongStore((s) => s.future.length > 0);
  const { undo, redo } = useSongStore.getState();
  const playing = useUiStore((s) => s.playing);
  const playMode = useUiStore((s) => s.playMode);
  const tipsEnabled = useUiStore((s) => s.tipsEnabled);
  const ui = useUiStore.getState();
  return (
    <header className={styles.bar} aria-label="Top bar">
      <button className={styles.logo} onClick={() => ui.openModalId('credits')} {...tip('about')}>
        <span className={styles.dot} />
        <span className={styles.logoText}>Simple Sequencer</span>
      </button>
      <input
        key={name}
        className={styles.name}
        defaultValue={name}
        aria-label="Song name"
        onBlur={(e) =>
          e.target.value.trim() && e.target.value !== name && setName(e.target.value.trim())
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
        {...tip('songName')}
      />
      <div className={styles.transport}>
        <button
          className={`${styles.play} ${playing ? styles.playing : ''}`}
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Stop' : 'Play'}
          {...tip('play')}
        >
          {playing ? '■' : '▶'}
        </button>
        <Segmented
          label="What plays"
          tipKey="playMode"
          value={playMode}
          onChange={(m) => ui.setPlayMode(m)}
          options={[
            { value: 'pattern', label: 'Pattern' },
            { value: 'song', label: 'Song' },
          ]}
        />
      </div>
      <Tempo />
      <KeyPicker />
      <Swing />
      <div className="spacer" />
      <button
        className="icon ghost"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
        {...tip('undo')}
      >
        ↶
      </button>
      <button
        className="icon ghost"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
        {...tip('redo')}
      >
        ↷
      </button>
      <SaveStatus />
      <button onClick={() => ui.openModalId('newSong')} {...tip('songs')}>
        📁 Songs
      </button>
      <button
        className="primary"
        onClick={() => {
          stopPlayback();
          ui.openModalId('export');
        }}
        {...tip('export')}
      >
        ⤓ Export
      </button>
      <button
        className="icon ghost"
        aria-label="Keyboard shortcuts"
        onClick={() => ui.openModalId('shortcuts')}
        {...tip('shortcuts')}
      >
        ?
      </button>
      <button
        className="icon ghost"
        aria-label="Hover tips"
        aria-pressed={tipsEnabled}
        style={{ opacity: tipsEnabled ? 1 : 0.4 }}
        onClick={() => ui.setTipsEnabled(!tipsEnabled)}
        {...tip('tips')}
      >
        💡
      </button>
    </header>
  );
}
