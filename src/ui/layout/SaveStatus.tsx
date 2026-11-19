import { useSaveStatus } from '@/storage/autosave';
import { toast } from '../toast';
import styles from './TopBar.module.css';

export function SaveStatus() {
  const { status, error } = useSaveStatus();
  if (status === 'error')
    return (
      <button
        className={`ghost ${styles.status} ${styles.err}`}
        onClick={() =>
          toast({ kind: 'error', message: error ?? "Couldn't save.", durationMs: 9000 })
        }
        data-tip="Not saved|Your browser storage is full or blocked. Click for help."
      >
        ⚠ Not saved
      </button>
    );
  return (
    <span className={styles.status} data-tip="saveStatus" role="status">
      {status === 'saving' ? '◌ Saving…' : status === 'saved' ? '● Saved' : 'Not saved yet'}
    </span>
  );
}
