import { tip } from '../tooltips';
import styles from './TopBar.module.css';

/** Placeholder until autosave exists (phase 11). */
export function SaveStatus() {
  return (
    <span className={styles.status} {...tip('saveStatus')}>
      Not saved yet
    </span>
  );
}
