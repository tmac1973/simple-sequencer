import { useMemo, useState, type ReactNode } from 'react';
import { usesNotes } from '@/audio/scheduler';
import { SampleRegistry } from '@/audio/sampleRegistry';
import type { Song } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { TEMPLATES, kitsUsed, type Template } from '@/templates';
import { Modal } from '../components/controls';
import { stopPlayback } from '../transport';
import styles from './Modals.module.css';

/** Mini pixel-grid art: first bar of the first 5 tracks' first patterns. */
function Art({ song }: { song: Song }) {
  const rows = song.tracks.slice(0, 5);
  return (
    <div className={styles.art} aria-hidden>
      {rows.flatMap((t, r) => {
        const p = t.patterns[0]!;
        const per = p.stepsPerBar / 16;
        const on = new Set<number>(
          usesNotes(t)
            ? p.notes
                .filter((n) => n.start < p.stepsPerBar)
                .flatMap((n) =>
                  Array.from(
                    { length: Math.ceil(n.length / per) },
                    (_, k) => Math.floor(n.start / per) + k,
                  ),
                )
            : p.steps.filter((s) => s.index < p.stepsPerBar).map((s) => Math.floor(s.index / per)),
        );
        return Array.from({ length: 16 }, (_, c) => (
          <i key={`${r}-${c}`} style={{ background: on.has(c) ? t.color : '#262937' }} />
        ));
      })}
    </div>
  );
}

export function loadTemplate(t: Template) {
  stopPlayback();
  const song = t.build();
  useSongStore.getState().loadSong(song);
  for (const id of kitsUsed(song)) SampleRegistry.warm(id);
  const ui = useUiStore.getState();
  ui.selectTrack(song.tracks[0]?.id ?? null);
  ui.setSongStartBar(0);
}

export function NewSongModal({ onClose, extra }: { onClose: () => void; extra?: ReactNode }) {
  const [picked, setPicked] = useState<Template['id']>('lofi');
  const [confirm, setConfirm] = useState(false);
  const previews = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, t.build()])), []);
  const dirty = useSongStore((s) => s.past.length > 0);
  const create = () => {
    if (dirty && !confirm) {
      setConfirm(true);
      return;
    }
    loadTemplate(TEMPLATES.find((t) => t.id === picked)!);
    onClose();
  };
  return (
    <Modal
      title="Start a song"
      onClose={onClose}
      width={880}
      footer={
        <>
          {confirm ? (
            <span style={{ marginRight: 'auto', color: 'var(--warn)' }}>
              Replace the current song? Your changes aren't saved yet.
            </span>
          ) : (
            <span style={{ marginRight: 'auto' }} />
          )}
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={create}>
            {confirm ? 'Replace and create' : 'Create'}
          </button>
        </>
      }
    >
      <div className="sect">Start from a template, which is already playable</div>
      <div className={styles.tpls} role="radiogroup" aria-label="Templates">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={picked === t.id}
            className={`${styles.tpl} ${picked === t.id ? styles.on : ''}`}
            onClick={() => {
              setPicked(t.id);
              setConfirm(false);
            }}
            onDoubleClick={() => {
              setPicked(t.id);
              if (!dirty) {
                loadTemplate(t);
                onClose();
              }
            }}
          >
            <Art song={previews[t.id]!} />
            <b>{t.name}</b>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
      {extra}
    </Modal>
  );
}
