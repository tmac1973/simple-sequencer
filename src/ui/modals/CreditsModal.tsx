import { useEffect, useState } from 'react';
import {
  licenseLabel,
  loadManifest,
  type LibraryManifest,
  type LibrarySample,
} from '@/library/manifest';
import { CODE_LICENSES } from '@/credits/codeLicenses';
import { Modal } from '../components/controls';
import styles from './Modals.module.css';

function group(samples: LibrarySample[]) {
  const map = new Map<
    string,
    {
      author: string;
      sourceUrl: string;
      license: string;
      licenseUrl: string;
      via?: string;
      names: string[];
    }
  >();
  for (const s of samples) {
    const k = `${s.author}|${s.license}|${s.license === 'CC0-1.0' ? '' : s.sourceUrl}`;
    const g = map.get(k) ?? {
      author: s.author,
      sourceUrl: s.sourceUrl,
      license: s.license,
      licenseUrl: s.licenseUrl,
      via: s.via,
      names: [],
    };
    g.names.push(s.name);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => a.author.localeCompare(b.author));
}

export function CreditsModal({ onClose }: { onClose: () => void }) {
  const [m, setM] = useState<LibraryManifest | null>(null);
  useEffect(() => {
    loadManifest()
      .then(setM)
      .catch(() => setM({ version: 1, kits: [], samples: [] }));
  }, []);
  const by = m ? group(m.samples.filter((s) => s.license !== 'CC0-1.0')) : [];
  const cc0 = m ? group(m.samples.filter((s) => s.license === 'CC0-1.0')) : [];
  return (
    <Modal
      title="About & credits"
      onClose={onClose}
      width={700}
      footer={
        <button className="primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="muted small">
        Simple Sequencer is free, open-source software (MIT). Built-in sounds are either shared
        under Creative Commons Attribution (CC-BY), which asks us to credit the creator, or placed
        in the public domain (CC0). Thank you to everyone below.
      </p>
      <div className="sect">Sounds that need credit (CC-BY)</div>
      <div className={styles.credits}>
        {!m && <span className="muted">Loading…</span>}
        {by.map((g) => (
          <div key={g.author + g.sourceUrl} className={styles.credit}>
            <b>{g.names.join(', ')}</b>
            <span className="muted">
              by {g.author} ·{' '}
              <a href={g.sourceUrl} target="_blank" rel="noreferrer">
                source
              </a>{' '}
              ·{' '}
              <a href={g.licenseUrl} target="_blank" rel="noreferrer">
                {licenseLabel(g.license)}
              </a>
            </span>
          </div>
        ))}
      </div>
      <div className="sect" style={{ marginTop: 18 }}>
        Public-domain sounds (CC0): thank you
      </div>
      <p className="small muted" style={{ lineHeight: 1.6 }}>
        {cc0.map((g) => `${g.author} (${g.names.length})`).join(' · ')}
        {m && (
          <>
            <br />
            Most come from the Sonic Pi sample library (originally from freesound.org) and the
            Versilian Community Sample Library.
          </>
        )}
      </p>
      <div className="sect" style={{ marginTop: 18 }}>
        Software
      </div>
      <div className={styles.credits}>
        {CODE_LICENSES.map((c) => (
          <div key={c.name} className={styles.credit}>
            <b>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.name}
              </a>
            </b>
            <span className="muted">
              {c.license}
              {c.note ? ` · ${c.note}` : ''}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
