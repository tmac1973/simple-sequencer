import { useEffect, useRef, useState, type ReactNode } from 'react';
import { engine } from '@/audio/engine';
import { checkImport, IMPORT_EXTENSIONS, soundNameFromFile } from '@/audio/import';
import { canRecord, startRecording, MAX_RECORD_SECONDS, type Recording } from '@/audio/recorder';
import {
  addUserSample,
  deleteUserSample,
  renameUserSample,
  useUserSoundsStore,
  type UserSoundMeta,
} from '@/storage/userSamples';
import { useSongStore } from '@/store/songStore';
import { ContextMenu } from '../components/controls';
import { toast, toastError } from '../toast';
import { tip } from '../tooltips';
import styles from './Modals.module.css';

export type UserSound = UserSoundMeta;

export interface UserSoundsApi {
  sounds: UserSound[];
  importer: ReactNode;
}

/** Import files into My Sounds; returns the stored sounds. */
export async function importFiles(files: FileList | File[]): Promise<UserSound[]> {
  const added: UserSound[] = [];
  for (const f of Array.from(files)) {
    try {
      const { durationMs } = await checkImport(f);
      added.push(await addUserSample(soundNameFromFile(f.name), f, { durationMs }));
    } catch (e) {
      toastError(e);
    }
  }
  if (added.length)
    toast({
      kind: 'info',
      message: `Added ${added.length === 1 ? `"${added[0]!.name}"` : `${added.length} sounds`} to My Sounds.`,
    });
  return added;
}

function Recorder({ onSaved, onClose }: { onSaved: (s: UserSound) => void; onClose: () => void }) {
  const [rec, setRec] = useState<Recording | null>(null);
  const [result, setResult] = useState<{ wav: Blob; durationMs: number } | null>(null);
  const [name, setName] = useState(
    () => `Recording ${useUserSoundsStore.getState().sounds.length + 1}`,
  );
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<Recording | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    startRecording(() => stopRef.current())
      .then((r) => {
        if (cancelled) return r.cancel();
        recRef.current = r;
        setRec(r);
      })
      .catch(() => {
        toast({
          kind: 'error',
          message: "Couldn't use the microphone. Check your browser's permission and try again.",
        });
        onClose();
      });
    return () => {
      cancelled = true;
      recRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!rec || result) return;
    let raf = 0;
    const loop = () => {
      setLevel(rec.level());
      setSecs((Date.now() - rec.startedAt) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rec, result]);

  const stop = async () => {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    setBusy(true);
    try {
      setResult(await r.stop());
    } catch (e) {
      toastError(e);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    stopRef.current = () => void stop();
  });
  const save = async () => {
    if (!result) return;
    setBusy(true);
    try {
      onSaved(await addUserSample(name, result.wav, { durationMs: result.durationMs }));
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={styles.drop}
      style={{ flexDirection: 'column', alignItems: 'stretch', textAlign: 'left' }}
      aria-label="Recorder"
    >
      {!result ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--bad)', fontWeight: 700 }}>
              ● {rec ? 'Recording' : 'Starting microphone…'}
            </span>
            <span className="muted">
              {secs.toFixed(1)} s / {MAX_RECORD_SECONDS} s
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 99,
                background: 'var(--panel3)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${level * 100}%`,
                  height: '100%',
                  background: level > 0.85 ? 'var(--bad)' : 'var(--good)',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose}>Discard</button>
            <button className="primary" disabled={!rec || busy} onClick={() => void stop()}>
              ■ Stop
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="icon"
            aria-label="Play recording"
            onClick={async () => {
              const id = `rec-preview:${Date.now()}`;
              const { SampleRegistry } = await import('@/audio/sampleRegistry');
              const { decodeAudio } = await import('@/audio/decode');
              SampleRegistry.register(id, await decodeAudio(await result.wav.arrayBuffer()));
              void engine.preview(id);
            }}
          >
            ▶
          </button>
          <input
            type="text"
            aria-label="Recording name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ flex: 1 }}
          />
          <span className="small muted">{(result.durationMs / 1000).toFixed(1)} s</span>
          <button onClick={onClose}>Discard</button>
          <button className="primary" disabled={busy} onClick={() => void save()}>
            Save to My Sounds
          </button>
        </div>
      )}
    </div>
  );
}

export function useUserSounds(onImported?: (s: UserSound) => void): UserSoundsApi {
  const sounds = useUserSoundsStore((s) => s.sounds);
  const [over, setOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const recOk = canRecord();
  useEffect(() => {
    void useUserSoundsStore
      .getState()
      .refresh()
      .catch(() => {});
  }, []);
  const handle = async (files: FileList | File[]) => {
    const added = await importFiles(files);
    const last = added[added.length - 1];
    if (last) onImported?.(last);
  };
  const importer = recording ? (
    <Recorder
      onClose={() => setRecording(false)}
      onSaved={(s) => {
        setRecording(false);
        onImported?.(s);
        toast({ kind: 'info', message: `Saved "${s.name}" to My Sounds.` });
      }}
    />
  ) : (
    <div
      className={`${styles.drop} ${over ? styles.over : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (e.dataTransfer.files.length) void handle(e.dataTransfer.files);
      }}
    >
      Drop audio files here (WAV, MP3, OGG, FLAC)
      <input
        ref={input}
        type="file"
        multiple
        accept={[...IMPORT_EXTENSIONS, 'audio/*'].join(',')}
        hidden
        aria-label="Import audio files"
        onChange={(e) => e.target.files && void handle(e.target.files)}
      />
      <button
        onClick={() => input.current?.click()}
        data-tip="Import|Add audio files from your computer to My Sounds."
      >
        Import file…
      </button>
      <button
        className={styles.rec}
        disabled={!recOk}
        onClick={() => setRecording(true)}
        data-tip={
          recOk
            ? "Record|Record a sound with your microphone. It's saved to My Sounds."
            : 'Record|Recording needs the app to be opened over https or localhost.'
        }
      >
        ● Record
      </button>
    </div>
  );
  return { sounds, importer };
}

export function MySoundsPanel({
  sounds,
  picked,
  onPick,
}: {
  sounds: UserSound[];
  picked: string;
  onPick: (id: string) => void;
  user: UserSoundsApi;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; s: UserSound } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  if (!sounds.length)
    return (
      <div className={styles.empty}>Import or record your own sounds and they'll show up here.</div>
    );
  return (
    <div className={styles.list} role="listbox" aria-label="My Sounds">
      {sounds.map((s) => (
        <div
          key={s.id}
          role="option"
          aria-selected={picked === s.id}
          className={`${styles.row} ${picked === s.id ? styles.on : ''}`}
          onClick={() => onPick(s.id)}
        >
          <button
            className={styles.pv}
            aria-label={`Preview ${s.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(s.id);
              void engine.preview(s.id);
            }}
            {...tip('preview')}
          >
            ▶
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renaming === s.id ? (
              <input
                type="text"
                defaultValue={s.name}
                autoFocus
                aria-label="Sound name"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                onBlur={(e) => {
                  void renameUserSample(s.id, e.target.value);
                  setRenaming(null);
                }}
              />
            ) : (
              <b>{s.name}</b>
            )}
            <div className="small muted">My Sounds · {(s.durationMs / 1000).toFixed(1)} s</div>
          </div>
          <button
            className="ghost icon"
            aria-label={`More options for ${s.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, s });
            }}
          >
            …
          </button>
        </div>
      ))}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: '✏️ Rename', onClick: () => setRenaming(menu.s.id) },
            {
              label: '🗑 Delete',
              onClick: () =>
                void deleteUserSample(menu.s.id, useSongStore.getState().song)
                  .then(() => toast({ kind: 'info', message: `Deleted "${menu.s.name}".` }))
                  .catch((e: Error) =>
                    toast({
                      kind: 'error',
                      message: `Can't delete "${menu.s.name}". ${e.message}`,
                    }),
                  ),
            },
          ]}
        />
      )}
    </div>
  );
}
