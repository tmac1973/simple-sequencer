import styles from './AppShell.module.css';
import { TopBar } from './TopBar';
import { TrackList } from './TrackList';
import { Timeline } from './Timeline';
import { EditorPanel } from './EditorPanel';
import { Inspector } from './Inspector';

export function AppShell() {
  return (
    <div className={styles.app}>
      <TopBar />
      <section className={styles.arrange}>
        <TrackList />
        <Timeline />
      </section>
      <section className={styles.bottom}>
        <EditorPanel />
        <Inspector />
      </section>
    </div>
  );
}
