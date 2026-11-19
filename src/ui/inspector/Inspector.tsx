import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { useSelection } from '../hooks/selection';
import { tip } from '../tooltips';
import { SampleSoundTab } from './SampleSoundTab';
import { SynthSoundTab } from './SynthSoundTab';
import { EffectsTab } from './EffectsTab';
import { AutomateTab } from './AutomateTab';
import styles from './Inspector.module.css';

export function Inspector() {
  const { track } = useSelection();
  const tab = useUiStore((s) => s.inspectorTab);
  const setTab = useUiStore((s) => s.setInspectorTab);
  useSongStore((s) => s.song.tracks);
  return (
    <aside className={styles.insp} aria-label="Inspector">
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'sound'}
          className={tab === 'sound' ? styles.on : ''}
          onClick={() => setTab('sound')}
          {...tip('tabSound')}
        >
          Sound
        </button>
        <button
          role="tab"
          aria-selected={tab === 'fx'}
          className={tab === 'fx' ? styles.on : ''}
          onClick={() => setTab('fx')}
          {...tip('tabFx')}
        >
          Effects
          {track && track.fx.length > 0 && <span className={styles.badge}>{track.fx.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'automate'}
          className={tab === 'automate' ? styles.on : ''}
          onClick={() => setTab('automate')}
          {...tip('tabAuto')}
        >
          Automate
        </button>
      </div>
      <div className={styles.body}>
        {!track ? (
          <div className={styles.empty}>Select a track to see its sound.</div>
        ) : tab === 'sound' ? (
          track.kind === 'sample' ? (
            <SampleSoundTab track={track} />
          ) : (
            <SynthSoundTab track={track} />
          )
        ) : tab === 'fx' ? (
          <EffectsTab track={track} />
        ) : (
          <AutomateTab track={track} />
        )}
      </div>
    </aside>
  );
}
