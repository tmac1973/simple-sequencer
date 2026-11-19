import styles from './AppShell.module.css';
import { TopBar } from './TopBar';
import { TrackList } from './TrackList';
import { Timeline } from './Timeline';
import { EditorPanel } from '../editor/EditorPanel';
import { Inspector } from '../inspector/Inspector';
import { TooltipLayer } from '../components/TooltipLayer';
import { ToastHost } from '../components/ToastHost';
import { ModalHost } from '../modals/ModalHost';
import { useShortcuts } from '../shortcuts';
import { useSelectionGuard } from '../hooks/selection';

export function AppShell() {
  useShortcuts();
  useSelectionGuard();
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
      <ModalHost />
      <TooltipLayer />
      <ToastHost />
    </div>
  );
}
