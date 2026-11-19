import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteSong,
  duplicateSong,
  listSongs,
  loadSongById,
  renameSong,
  undeleteSong,
  type SongSummary,
} from '@/storage/songs';
import { downloadBlob, exportSongFile, importSongFile } from '@/storage/songFile';
import { openSong } from '@/storage/session';
import { flushAutosave } from '@/storage/autosave';
import { useSongStore } from '@/store/songStore';
import { ContextMenu } from '../components/controls';
import { toast, toastError } from '../toast';
import styles from './Modals.module.css';

export function relativeTime(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'edited just now';
  if (s < 3600) return `edited ${Math.round(s / 60)} min ago`;
  if (s < 86400) return `edited ${Math.round(s / 3600)} h ago`;
  if (s < 172800) return 'edited yesterday';
  return `edited ${new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export async function importSongFromFile(file: File) {
  try {
    const song = await importSongFile(file);
    await openSong(song);
    toast({ kind: 'info', message: `Opened "${song.name}".` });
    return true;
  } catch (e) {
    toastError(e);
    return false;
  }
}

export function SongLibrary({ onOpened }: { onOpened: () => void }) {
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; s: SongSummary } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const currentId = useSongStore((s) => s.song.id);
  const file = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => {
    flushAutosave()
      .then(listSongs)
      .then(setSongs)
      .catch(() => setSongs([]));
  }, []);
  useEffect(refresh, [refresh]);

  const open = async (id: string) => {
    const song = await loadSongById(id).catch((e) => {
      toastError(e);
      return null;
    });
    if (song) {
      await openSong(song, { saved: true });
      onOpened();
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div
        className="sect"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>Your songs (saved in this browser)</span>
        <span>
          <input
            ref={file}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            hidden
            aria-label="Open song file"
            onChange={async (e) =>
              e.target.files?.[0] && (await importSongFromFile(e.target.files[0])) && onOpened()
            }
          />
          <button
            className="ghost small"
            onClick={() => file.current?.click()}
            data-tip="Open song file|Load a .json or .zip song file from your computer."
          >
            📂 Open song file…
          </button>
        </span>
      </div>
      {songs === null && <div className="muted small">Loading…</div>}
      {songs?.length === 0 && (
        <div className="muted small">No saved songs yet. Songs save automatically as you work.</div>
      )}
      <div style={{ maxHeight: 220, overflow: 'auto' }}>
        {songs?.map((s) => (
          <div
            key={s.id}
            className={styles.song}
            onDoubleClick={() => s.id !== currentId && void open(s.id)}
          >
            <span>🎵</span>
            <div className={styles.meta}>
              {renaming === s.id ? (
                <input
                  type="text"
                  defaultValue={s.name}
                  autoFocus
                  aria-label="Song name"
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  onBlur={async (e) => {
                    const name = e.target.value.trim();
                    setRenaming(null);
                    if (!name) return;
                    if (s.id === currentId) useSongStore.getState().setName(name);
                    await renameSong(s.id, name);
                    refresh();
                  }}
                />
              ) : (
                <b>{s.name}</b>
              )}{' '}
              <span className="muted small">
                · {s.bpm} BPM · {s.trackCount} tracks {s.id === currentId && '· open now'}
              </span>
            </div>
            <span className="muted small">{relativeTime(s.updatedAt)}</span>
            <button
              disabled={s.id === currentId}
              onClick={() => void open(s.id)}
              aria-label={`Open ${s.name}`}
            >
              Open
            </button>
            <button
              className="ghost icon"
              aria-label={`More options for ${s.name}`}
              onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, s })}
            >
              …
            </button>
          </div>
        ))}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: '✏️ Rename', onClick: () => setRenaming(menu.s.id) },
            { label: '⧉ Duplicate', onClick: () => void duplicateSong(menu.s.id).then(refresh) },
            {
              label: '💾 Download song file',
              onClick: async () => {
                const song = await loadSongById(menu.s.id);
                if (!song) return;
                const { blob, filename } = await exportSongFile(song);
                downloadBlob(blob, filename);
              },
            },
            { separator: true, label: '' },
            {
              label: '🗑 Delete',
              disabled: menu.s.id === currentId,
              tip:
                menu.s.id === currentId
                  ? "Can't delete|This is the song you're working on. Open another song first."
                  : undefined,
              onClick: async () => {
                const s = menu.s;
                await deleteSong(s.id);
                refresh();
                toast({
                  kind: 'info',
                  message: `Deleted "${s.name}".`,
                  durationMs: 8000,
                  action: { label: 'Undo', onClick: () => void undeleteSong(s.id).then(refresh) },
                });
              },
            },
          ]}
        />
      )}
    </div>
  );
}
