import { useState } from 'react';
import { playContextOf } from '@/audio/useEngineSync';
import { getLoopRegion } from '@/audio/scheduler';
import { barSeconds } from '@/model/timing';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { cancelExport, runExport, useExport, type ExportFormat } from '@/export/exportController';
import { downloadBlob, exportSongFile } from '@/storage/songFile';
import { Modal } from '../components/controls';
import { toastError } from '../toast';
import styles from './Modals.module.css';

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function ExportModal({ onClose }: { onClose: () => void }) {
  const song = useSongStore((s) => s.song);
  const ui = useUiStore();
  const { stage, progress, message } = useExport();
  const [format, setFormat] = useState<ExportFormat>('mp3');
  const [range, setRange] = useState<'song' | 'loop' | 'songLoop'>('song');
  const [repeats, setRepeats] = useState<1 | 2 | 4 | 8>(4);
  const [kbps, setKbps] = useState<128 | 192 | 320>(192);
  const [bits, setBits] = useState<16 | 24>(16);
  const busy = stage === 'rendering' || stage === 'encoding';
  const region = getLoopRegion(song, { ...playContextOf(ui), playMode: 'pattern' });
  const songSecs = song.lengthBars * barSeconds(song.bpm);
  const usesCustom = song.tracks.some((t) => t.sample?.sampleId.startsWith('user:'));

  const start = () =>
    void runExport(song, playContextOf(ui), {
      format,
      range:
        range === 'song'
          ? 'song'
          : range === 'songLoop' && ui.songLoop
            ? { loopRepeats: repeats, songLoop: ui.songLoop }
            : { loopRepeats: repeats },
      mp3Kbps: kbps,
      wavBits: bits,
    });

  return (
    <Modal
      title="Export"
      onClose={() => {
        if (busy) cancelExport();
        useExport.setState({ stage: 'idle', progress: 0 });
        onClose();
      }}
      width={660}
      footer={
        <>
          {busy && (
            <button onClick={cancelExport} style={{ marginRight: 'auto' }} data-tip="exportCancel">
              Cancel export
            </button>
          )}
          <button onClick={onClose}>Close</button>
          <button className="primary" disabled={busy} onClick={start} data-tip="exportGo">
            {busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
        </>
      }
    >
      <div className="sect">Audio file, to listen to or share</div>
      <div className={styles.opts} role="radiogroup" aria-label="Format" data-tip="exportFormat">
        <button
          role="radio"
          aria-checked={format === 'mp3'}
          className={`${styles.opt} ${format === 'mp3' ? styles.on : ''}`}
          onClick={() => setFormat('mp3')}
        >
          <b>MP3</b>
          <span>Small file, great for sharing and phones.</span>
        </button>
        <button
          role="radio"
          aria-checked={format === 'wav'}
          className={`${styles.opt} ${format === 'wav' ? styles.on : ''}`}
          onClick={() => setFormat('wav')}
        >
          <b>WAV</b>
          <span>Full quality, bigger file. Best for uploading to music sites.</span>
        </button>
      </div>
      <div
        className="small"
        style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}
      >
        {format === 'mp3' ? (
          <>
            Quality
            <select
              data-tip="exportQuality"
              aria-label="MP3 quality"
              value={kbps}
              onChange={(e) => setKbps(Number(e.target.value) as 128 | 192 | 320)}
            >
              <option value={128}>Good (128 kbps)</option>
              <option value={192}>High (192 kbps)</option>
              <option value={320}>Best (320 kbps)</option>
            </select>
          </>
        ) : (
          <>
            Bit depth
            <select
              aria-label="WAV bit depth"
              data-tip="exportQuality"
              value={bits}
              onChange={(e) => setBits(Number(e.target.value) as 16 | 24)}
            >
              <option value={16}>16-bit (standard)</option>
              <option value={24}>24-bit (studio)</option>
            </select>
          </>
        )}
      </div>
      <div className="sect" style={{ marginTop: 18 }}>
        What to export
      </div>
      <div className={styles.opts} role="radiogroup" aria-label="Range" data-tip="exportRange">
        <button
          role="radio"
          aria-checked={range === 'song'}
          className={`${styles.opt} ${range === 'song' ? styles.on : ''}`}
          onClick={() => setRange('song')}
        >
          <b>Whole song</b>
          <span>
            Bars 1–{song.lengthBars} · about {fmtTime(songSecs)}
          </span>
        </button>
        <button
          role="radio"
          aria-checked={range === 'loop'}
          className={`${styles.opt} ${range === 'loop' ? styles.on : ''}`}
          onClick={() => setRange('loop')}
        >
          <b>Current pattern loop</b>
          <span>
            Bars {region.startBar + 1}–{region.startBar + region.lengthBars}
          </span>
        </button>
        {ui.songLoop && (
          <button
            role="radio"
            aria-checked={range === 'songLoop'}
            className={`${styles.opt} ${range === 'songLoop' ? styles.on : ''}`}
            onClick={() => setRange('songLoop')}
          >
            <b>🔁 Just the song loop</b>
            <span>
              Bars {ui.songLoop.startBar + 1}–{ui.songLoop.startBar + ui.songLoop.lengthBars}, every
              track
            </span>
          </button>
        )}
      </div>
      {range !== 'song' && (
        <div
          className="small"
          style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}
        >
          Repeat the loop
          <select
            aria-label="Repeats"
            data-tip="exportRepeats"
            value={repeats}
            onChange={(e) => setRepeats(Number(e.target.value) as 1 | 2 | 4 | 8)}
          >
            {[1, 2, 4, 8].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </div>
      )}
      {stage !== 'idle' && (
        <>
          <div
            className={styles.progress}
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Export progress"
          >
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="small muted" style={{ marginTop: 6 }} role="status">
            {stage === 'rendering' && `Rendering… ${Math.round(progress * 100)}%`}
            {stage === 'encoding' && `Encoding… ${Math.round(progress * 100)}%`}
            {stage === 'done' && '✓ Done! Check your downloads.'}
            {stage === 'cancelled' && 'Export cancelled.'}
            {stage === 'error' && (
              <span style={{ color: 'var(--bad)' }}>Export failed: {message}</span>
            )}
          </div>
        </>
      )}
      <div className="sect" style={{ marginTop: 22 }}>
        Song file, to back up or open on another computer
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={async () => {
            try {
              const { blob, filename } = await exportSongFile(song);
              downloadBlob(blob, filename);
            } catch (e) {
              toastError(e);
            }
          }}
          data-tip="Save song file|Download this song as a file you can open later or on another computer."
        >
          💾 Save song file ({usesCustom ? '.zip' : '.json'})
        </button>
        <span className="small muted">
          {usesCustom ? 'Includes your custom sounds.' : 'Uses only built-in sounds.'}
        </span>
      </div>
    </Modal>
  );
}
