import { useEffect, useMemo, useState } from 'react';
import { engine } from '@/audio/engine';
import {
  CATEGORIES,
  licenseLabel,
  loadManifest,
  searchSamples,
  type LibraryManifest,
} from '@/library/manifest';
import { soundInfo } from '@/library/soundNames';
import { DEFAULT_SAMPLE_EDIT } from '@/model/factories';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { Modal } from '../components/controls';
import { useSelection } from '../hooks/selection';
import { tip } from '../tooltips';
import { MySoundsPanel, useUserSounds, type UserSound } from './MySounds';
import styles from './Modals.module.css';

const MY = '⭐ My Sounds';

export function SoundBrowserModal({ onClose }: { onClose: () => void }) {
  const { track } = useSelection();
  const [m, setM] = useState<LibraryManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = track?.sample?.sampleId ?? '';
  const [category, setCategory] = useState<string>(() =>
    current.startsWith('user:') ? MY : track?.sample?.melodic ? 'Melodic one-shots' : 'Kicks',
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string>(current);
  const user = useUserSounds();

  useEffect(() => {
    loadManifest()
      .then((mm) => {
        setM(mm);
        const cur = mm.samples.find((s) => s.id === current);
        if (cur) setCategory(cur.category);
      })
      .catch((e: Error) => setError(e.message));
  }, [current]);

  const results = useMemo(
    () => (m && category !== MY ? searchSamples(m, query, category) : []),
    [m, query, category],
  );
  const kitName = (id: string) => m?.kits.find((k) => k.id === id)?.name ?? id;
  const userResults = user.sounds.filter(
    (s: UserSound) => !query || s.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (!track || track.kind !== 'sample') {
    return (
      <Modal
        title="Choose a sound"
        onClose={onClose}
        width={520}
        footer={<button onClick={onClose}>Close</button>}
      >
        <p className="muted">Select a drum or sample track first.</p>
      </Modal>
    );
  }

  const use = () => {
    const s = m?.samples.find((x) => x.id === picked);
    useSongStore.getState().setSampleSettings(track.id, {
      sampleId: picked,
      rootMidi: s?.rootNote ?? 60,
      edit: { ...DEFAULT_SAMPLE_EDIT },
    });
    onClose();
  };

  return (
    <Modal
      title={
        <>
          Choose a sound for <span style={{ color: track.color }}>{track.name}</span>
        </>
      }
      onClose={onClose}
      width={860}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            Click ▶ to preview. Built-in sounds are free to use.{' '}
            <a
              href="#credits"
              onClick={(e) => {
                e.preventDefault();
                useUiStore.getState().openModalId('credits');
              }}
            >
              Credits
            </a>
          </span>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!picked || picked === current} onClick={use}>
            Use this sound
          </button>
        </>
      }
    >
      <div className={styles.browser}>
        <div className={styles.cats} role="tablist" aria-label="Sound categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c && !query}
              className={category === c && !query ? styles.on : ''}
              onClick={() => {
                setCategory(c);
                setQuery('');
              }}
            >
              {c}
              <span>{m?.samples.filter((s) => s.category === c).length ?? ''}</span>
            </button>
          ))}
          <button
            role="tab"
            aria-selected={category === MY}
            className={category === MY ? styles.on : ''}
            onClick={() => setCategory(MY)}
          >
            {MY}
            <span>{user.sounds.length}</span>
          </button>
        </div>
        <div>
          <input
            className={styles.search}
            type="search"
            placeholder="Search sounds… e.g. 'kick', '808', 'snap'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sounds"
            autoFocus
          />
          {error && <div className={styles.empty}>{error}</div>}
          {category === MY ? (
            <MySoundsPanel sounds={userResults} picked={picked} onPick={setPicked} user={user} />
          ) : (
            <div className={styles.list} role="listbox" aria-label="Sounds">
              {!m && !error && <div className={styles.empty}>Loading sounds…</div>}
              {m && results.length === 0 && (
                <div className={styles.empty}>No sounds match “{query}”.</div>
              )}
              {results.map((s) => (
                <div
                  key={s.id}
                  role="option"
                  aria-selected={picked === s.id}
                  className={`${styles.row} ${picked === s.id ? styles.on : ''}`}
                  onClick={() => setPicked(s.id)}
                  onDoubleClick={() => {
                    setPicked(s.id);
                    void engine.preview(s.id);
                  }}
                >
                  <button
                    className={styles.pv}
                    aria-label={`Preview ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPicked(s.id);
                      void engine.preview(s.id);
                    }}
                    {...tip('preview')}
                  >
                    ▶
                  </button>
                  <div>
                    <b>{s.name}</b>
                    <div className="small muted">
                      {kitName(s.kit)}
                      {query ? ` · ${s.category}` : ''}
                    </div>
                  </div>
                  <span className={styles.lic}>{licenseLabel(s.license)}</span>
                </div>
              ))}
            </div>
          )}
          {picked && picked !== current && (
            <p className="small muted">Selected: {soundInfo(picked).name}</p>
          )}
          {user.importer}
        </div>
      </div>
    </Modal>
  );
}
