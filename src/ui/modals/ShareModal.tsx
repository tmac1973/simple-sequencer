import { useMemo, useState } from 'react';
import { soundInfo } from '@/library/soundNames';
import { keyLabel } from '@/model/scale';
import { blockAt } from '@/model/timing';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { openSong } from '@/storage/session';
import { ownSoundTracks, shareUrl, standIn } from '@/storage/shareLink';
import { Modal } from '../components/controls';
import { useSoundNamesVersion } from '../hooks/useSoundNames';
import { toast, toastError } from '../toast';
import { tip } from '../tooltips';
import styles from './ShareModal.module.css';

async function copyText(text: string, input: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers / no permission: copy from the selected input instead
    if (!input) return false;
    input.select();
    return document.execCommand?.('copy') ?? false;
  }
}

export function ShareModal({ onClose }: { onClose: () => void }) {
  const song = useSongStore((s) => s.song);
  useSoundNamesVersion();
  const url = useMemo(() => shareUrl(song), [song]);
  const own = ownSoundTracks(song);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const kb = (url.length / 1024).toFixed(1);

  const copy = async () => {
    if (await copyText(url, input)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      input?.select();
      toast({ kind: 'info', message: 'Press Ctrl+C (⌘C on Mac) to copy the selected link.' });
    }
  };

  return (
    <Modal
      title={`Share “${song.name}”`}
      onClose={onClose}
      width={600}
      footer={<button onClick={onClose}>Done</button>}
    >
      <div className={styles.body}>
        <div className={styles.link}>
          <input
            ref={setInput}
            readOnly
            value={url}
            aria-label="Share link"
            onFocus={(e) => e.currentTarget.select()}
            {...tip('shareLink')}
          />
          <button
            className={copied ? styles.copied : 'primary'}
            onClick={() => void copy()}
            {...tip('shareCopy')}
          >
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>
        <div className={styles.info}>
          <span aria-hidden>🔒</span>
          <div>
            The whole song is inside the link ({kb} KB). Nothing is uploaded: anyone you send it to
            opens <b>their own copy</b>, and your song stays yours.
          </div>
        </div>
        {own.length > 0 && (
          <div className={styles.warn}>
            <b>
              {own.length} track{own.length > 1 ? 's use' : ' uses'} your own sounds,
            </b>{' '}
            which are too big to fit in a link. People who open it will hear built-in sounds
            instead:
            <ul>
              {own.map((t) => (
                <li key={t.id}>
                  {t.name} → {soundInfo(standIn(t).sampleId).name}
                </li>
              ))}
            </ul>
            <span className="muted">
              To share your own sounds too, use{' '}
              <button
                className={styles.linkBtn}
                onClick={() => useUiStore.getState().openModalId('export')}
                {...tip('shareZip')}
              >
                Export → Song file
              </button>{' '}
              (.zip) and send the file.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

const ART_BARS = 8;

export function OpenSharedModal({ onClose }: { onClose: () => void }) {
  const song = useUiStore((s) => s.sharedSong);
  const close = () => {
    useUiStore.getState().setSharedSong(null);
    onClose();
  };
  if (!song) return null;
  const open = async () => {
    try {
      await openSong(song);
      toast({ kind: 'info', message: `Opened “${song.name}”. It's saved in your Songs.` });
    } catch (e) {
      toastError(e);
    }
    close();
  };
  const rows = song.tracks.slice(0, 5);
  return (
    <Modal
      title="Someone shared a song with you"
      onClose={close}
      width={560}
      footer={
        <>
          <button onClick={close}>Not now</button>
          <button className="primary" onClick={() => void open()} {...tip('openShared')}>
            Open song
          </button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.art} aria-hidden>
            {rows.flatMap((t) =>
              Array.from({ length: ART_BARS }, (_, b) => (
                <i
                  key={`${t.id}${b}`}
                  style={blockAt(t, b) ? { background: t.color } : undefined}
                />
              )),
            )}
          </div>
          <div>
            <b>{song.name}</b>
            <div className={styles.tags}>
              <span>{song.bpm} BPM</span>
              <span>{keyLabel(song.key)}</span>
              <span>
                {song.tracks.length} track{song.tracks.length === 1 ? '' : 's'}
              </span>
              <span>{song.lengthBars} bars</span>
            </div>
          </div>
        </div>
        <div className={styles.info}>
          <span aria-hidden>💾</span>
          <div>
            It opens as a new song in your <b>Songs</b> list. The song you have open now is already
            saved.
          </div>
        </div>
      </div>
    </Modal>
  );
}
