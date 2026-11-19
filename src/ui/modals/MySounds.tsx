import type { ReactNode } from 'react';
import { tip } from '../tooltips';
import styles from './Modals.module.css';

export interface UserSound {
  id: string;
  name: string;
  durationMs: number;
}

export interface UserSoundsApi {
  sounds: UserSound[];
  importer: ReactNode;
}

/** Placeholder until custom sounds exist: no sounds, disabled import/record. */
export function useUserSounds(): UserSoundsApi {
  return {
    sounds: [],
    importer: (
      <div className={styles.drop}>
        Drop audio files here (WAV, MP3, OGG, FLAC)
        <button
          disabled
          data-tip="Available soon|Importing and recording your own sounds is on its way."
        >
          Import file…
        </button>
        <button disabled className={styles.rec} {...tip('comingSoon')}>
          ● Record
        </button>
      </div>
    ),
  };
}

export function MySoundsPanel(_props: {
  sounds: UserSound[];
  picked: string;
  onPick: (id: string) => void;
  user: UserSoundsApi;
}) {
  return (
    <div className={styles.empty}>Import or record your own sounds and they'll show up here.</div>
  );
}
