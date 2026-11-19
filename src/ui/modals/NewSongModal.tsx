import { useMemo, useState } from 'react';
import { usesNotes } from '@/audio/scheduler';
import { SampleRegistry } from '@/audio/sampleRegistry';
import type { Song } from '@/model/types';
import { openSong } from '@/storage/session';
import { SongLibrary } from './SongLibrary';
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
  for (const id of kitsUsed(song)) SampleRegistry.warm(id);
  // The current song is already autosaved in the library, so no need to ask first.
  void openSong(song);
}

export function NewSongModal({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<Template['id']>('lofi');
  const previews = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, t.build()])), []);
  const create = () => {
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
          <span style={{ marginRight: 'auto' }} className="small muted">
            Your current song is saved automatically.
          </span>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={create}>
            Create
          </button>
        </>
      }
    >
      <div className="sect">Start from a template, which is already playable</div>
      <div className={styles.tpls} role="radiogroup" aria-label="Templates" data-tip="templates">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={picked === t.id}
            className={`${styles.tpl} ${picked === t.id ? styles.on : ''}`}
            onClick={() => setPicked(t.id)}
            onDoubleClick={() => {
              loadTemplate(t);
              onClose();
            }}
          >
            <Art song={previews[t.id]!} />
            <b>{t.name}</b>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
      <SongLibrary onOpened={onClose} />
    </Modal>
  );
}
