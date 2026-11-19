import { useRef, useState } from 'react';
import { newId } from '@/model/factories';
import { degreeToMidi, midiName, scaleLength } from '@/model/scale';
import type { Note, Pattern, Track } from '@/model/types';
import { engine } from '@/audio/engine';
import { getPreset } from '@/audio/synthPresets';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { tip } from '../tooltips';
import { chordDegrees } from './chordStamp';
import { useCurrentStep } from './StepPads';
import styles from './PianoRoll.module.css';

const RH = 18;
const MIN_LOW = -14;
const MAX_LOW = 21;

type Drag =
  | {
      kind: 'move';
      index: number;
      g: string;
      startX: number;
      startY: number;
      note: Note;
      moved: boolean;
    }
  | { kind: 'resize'; index: number; g: string; startX: number; note: Note }
  | { kind: 'vel'; index: number; g: string; startY: number; v: number };

export function PianoRoll({ track, pattern }: { track: Track; pattern: Pattern }) {
  const key = useSongStore((s) => s.song.key);
  const stamp = useUiStore((s) => s.chordStamp);
  const a = useSongStore.getState();
  const n = scaleLength(key.scale);
  const [low, setLow] = useState(() => {
    if (!pattern.notes.length) return 0;
    const min = Math.min(...pattern.notes.map((x) => x.degree));
    return Math.max(MIN_LOW, Math.min(MAX_LOW, Math.floor(min / n) * n));
  });
  const rows = 2 * n + 1;
  const high = low + rows - 1;
  const total = pattern.lengthBars * pattern.stepsPerBar;
  const perBeat = pattern.stepsPerBar / 4;
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const now = useCurrentStep(track, pattern);
  const shift =
    track.kind === 'synth' ? getPreset(track.synth?.presetId ?? '').octaveShift * 12 : 0;

  const pos = (e: { clientX: number; clientY: number }) => {
    const r = grid.current!.getBoundingClientRect();
    const step = Math.floor(((e.clientX - r.left) / r.width) * total);
    const row = Math.floor((e.clientY - r.top) / RH);
    return { step: Math.max(0, Math.min(total - 1, step)), degree: high - row, w: r.width };
  };
  const defaultLen = pattern.stepsPerBar === 24 ? 3 : 2;

  const onGridDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const { step, degree } = pos(e);
    const degrees = chordDegrees(degree, stamp);
    a.addNote(
      track.id,
      pattern.id,
      degrees.map((d) => ({
        start: step,
        length: Math.min(defaultLen, total - step),
        degree: d,
        velocity: 0.8,
      })),
    );
    degrees.forEach((d) => void engine.auditionNote(track.id, d));
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const w = grid.current!.getBoundingClientRect().width;
    const stepW = w / total;
    if (d.kind === 'move') {
      const ds = Math.round((e.clientX - d.startX) / stepW);
      const dd = -Math.round((e.clientY - d.startY) / RH);
      if (!d.moved && (ds !== 0 || dd !== 0)) d.moved = true;
      if (d.moved) {
        const next = d.note.degree + dd;
        a.moveNote(track.id, pattern.id, d.index, d.note.start + ds, next, d.g);
      }
    } else if (d.kind === 'resize') {
      const ds = Math.round((e.clientX - d.startX) / stepW);
      a.resizeNote(track.id, pattern.id, d.index, d.note.length + ds, d.g);
    } else {
      a.setNoteVelocity(track.id, pattern.id, d.index, d.v + (d.startY - e.clientY) / 40, d.g);
    }
  };
  const onUp = () => {
    const d = drag.current;
    if (d?.kind === 'move' && d.moved) {
      const moved = useSongStore
        .getState()
        .song.tracks.find((t) => t.id === track.id)
        ?.patterns.find((p) => p.id === pattern.id)?.notes[d.index];
      if (moved) void engine.auditionNote(track.id, moved.degree);
    }
    drag.current = null;
  };
  const capture = (e: React.PointerEvent) =>
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

  const visible = pattern.notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => note.degree >= low && note.degree <= high);

  return (
    <div className={styles.wrap} style={{ ['--rh' as string]: `${RH}px` }}>
      <div className={styles.side}>
        <div className={styles.roll} style={{ flex: 1 }}>
          <div className={styles.keys} {...tip('pianoKeys')}>
            {Array.from({ length: rows }, (_, i) => {
              const deg = high - i;
              const isRoot = ((deg % n) + n) % n === 0;
              return (
                <div key={deg} className={isRoot ? styles.root : ''}>
                  <span>{midiName(degreeToMidi(deg, key) + shift, key)}</span>
                  {isRoot && <span>●</span>}
                </div>
              );
            })}
          </div>
          <div
            ref={grid}
            className={styles.grid}
            onPointerDown={onGridDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            aria-label="Piano roll grid"
            {...tip('pianoGrid')}
          >
            {Array.from({ length: rows }, (_, i) => {
              const deg = high - i;
              return (
                <div
                  key={deg}
                  className={`${styles.rrow} ${((deg % n) + n) % n === 0 ? styles.root : ''}`}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}
            <div className={styles.cols}>
              {Array.from({ length: total }, (_, c) => (
                <div
                  key={c}
                  className={`${styles.col} ${c % pattern.stepsPerBar === 0 ? styles.bar : c % perBeat === 0 ? styles.beat : ''}`}
                  style={{ left: `${(c / total) * 100}%` }}
                />
              ))}
            </div>
            {now !== null && (
              <div
                className={styles.now}
                style={{ left: `${(now / total) * 100}%`, width: `${100 / total}%` }}
              />
            )}
            {visible.map(({ note, index }) => (
              <div
                key={`${index}-${note.start}-${note.degree}`}
                className={styles.note}
                role="button"
                aria-label={`Note ${midiName(degreeToMidi(note.degree, key) + shift, key)} at step ${note.start + 1}`}
                style={{
                  left: `calc(${(note.start / total) * 100}% + 1px)`,
                  width: `calc(${(note.length / total) * 100}% - 2px)`,
                  top: (high - note.degree) * RH + 1,
                  height: RH - 2,
                  background: track.color,
                  opacity: 0.55 + note.velocity * 0.45,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.button === 2) return;
                  if (e.altKey) {
                    a.removeNote(track.id, pattern.id, index);
                    return;
                  }
                  capture(e);
                  const onEdge = (e.target as HTMLElement).dataset.edge !== undefined;
                  drag.current = onEdge
                    ? { kind: 'resize', index, g: newId(), startX: e.clientX, note }
                    : {
                        kind: 'move',
                        index,
                        g: newId(),
                        startX: e.clientX,
                        startY: e.clientY,
                        note,
                        moved: false,
                      };
                }}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onContextMenu={(e) => {
                  e.preventDefault();
                  a.removeNote(track.id, pattern.id, index);
                }}
              >
                <span className={styles.edge} data-edge="" />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.oct}>
          <button
            aria-label="Higher notes"
            disabled={low >= MAX_LOW}
            onClick={() => setLow(Math.min(MAX_LOW, low + n))}
            {...tip('octaveUp')}
          >
            ▲
          </button>
          <button
            aria-label="Lower notes"
            disabled={low <= MIN_LOW}
            onClick={() => setLow(Math.max(MIN_LOW, low - n))}
            {...tip('octaveDown')}
          >
            ▼
          </button>
        </div>
      </div>
      <div className={styles.vel} style={{ marginRight: 38 }} {...tip('noteVelocity')}>
        <span className={styles.velLabel}>Loudness</span>
        {pattern.notes.map((note, index) => (
          <div
            key={index}
            className={styles.velBar}
            aria-label={`Loudness of note ${index + 1}`}
            style={{
              left: `calc(${(note.start / total) * 100}% + 2px)`,
              height: `${note.velocity * 100}%`,
              background: track.color,
            }}
            onPointerDown={(e) => {
              capture(e);
              drag.current = {
                kind: 'vel',
                index,
                g: newId(),
                startY: e.clientY,
                v: note.velocity,
              };
            }}
            onPointerMove={onMove}
            onPointerUp={onUp}
          />
        ))}
      </div>
      <div
        className="small muted"
        style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 4 }}
      >
        <span>
          <b>Click</b> to add a note
        </span>
        <span>
          <b>Drag the right edge</b> to make it longer
        </span>
        <span>
          <b>Right-click</b> to delete
        </span>
        <span>
          Turn on <b>Chord stamp</b> to place whole chords
        </span>
      </div>
    </div>
  );
}
