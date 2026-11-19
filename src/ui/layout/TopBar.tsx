import { useState } from 'react';
import { engine } from '@/audio/engine';
import { useSongStore } from '@/store/songStore';
import { createDevSong } from '@/dev/devSong';

/** Temporary dev transport (replaced by the real top bar in phase 04). */
export function TopBar() {
  const [playing, setPlaying] = useState(false);
  return (
    <header
      aria-label="Top bar"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '0 16px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <b>Simple Sequencer</b>
      <button onClick={() => useSongStore.getState().loadSong(createDevSong())}>
        Load dev song
      </button>
      <button
        onClick={async () => {
          if (playing) engine.stop();
          else await engine.play(0);
          setPlaying(!playing);
        }}
      >
        {playing ? 'Stop' : 'Play'}
      </button>
    </header>
  );
}
