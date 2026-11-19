import { useState } from 'react';
import type { PatternLength, StepsPerBar } from '@/model/types';
import { usesNotes } from '@/audio/scheduler';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { ContextMenu, Segmented, Toggle, type MenuItem } from '../components/controls';
import { useSelection } from '../hooks/selection';
import { tip } from '../tooltips';
import { DrumView } from './DrumView';
import { PianoRoll } from './PianoRoll';
import { StepEditor } from './StepPads';
import styles from './Editor.module.css';

export function EditorPanel() {
  const { track, pattern } = useSelection();
  const drumView = useUiStore((s) => s.drumView);
  const chordStamp = useUiStore((s) => s.chordStamp);
  const ui = useUiStore.getState();
  const a = useSongStore.getState();
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  if (!track || !pattern) {
    return (
      <div className={styles.panel} aria-label="Pattern editor">
        <div className={styles.empty}>Add a track to start making music.</div>
      </div>
    );
  }
  const notes = usesNotes(track);
  const isDrum = !notes;
  const showDrums = drumView && isDrum;

  const newPattern = (e: React.MouseEvent) =>
    setMenu({
      x: e.clientX,
      y: e.clientY + 10,
      items: [
        { label: '＋ Empty pattern', onClick: () => pick(a.addPattern(track.id)) },
        {
          label: `⧉ Copy of ${pattern.name}`,
          onClick: () => pick(a.addPattern(track.id, pattern.id)),
        },
      ],
    });
  const pick = (id: string | null) => id && ui.selectPattern(track.id, id);

  return (
    <div className={styles.panel} aria-label="Pattern editor">
      <div className={styles.head}>
        <div className={styles.title}>
          <span className={styles.sw} style={{ background: track.color }} />
          {showDrums ? 'All drums' : `${track.name} · ${notes ? 'Piano roll' : 'Steps'}`}
        </div>
        <div className={styles.chips} {...tip('patterns')}>
          {track.patterns.map((p) => (
            <button
              key={p.id}
              className={`${styles.chip} ${p.id === pattern.id ? styles.on : ''}`}
              style={p.id === pattern.id ? { background: track.color } : undefined}
              aria-label={`Pattern ${p.name}`}
              aria-pressed={p.id === pattern.id}
              onClick={() => ui.selectPattern(track.id, p.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    {
                      label: `⧉ Copy ${p.name}`,
                      onClick: () => pick(a.addPattern(track.id, p.id)),
                    },
                    {
                      label: `🗑 Delete ${p.name}`,
                      disabled: track.patterns.length <= 1,
                      onClick: () => a.removePattern(track.id, p.id),
                    },
                  ],
                });
              }}
            >
              {p.name}
            </button>
          ))}
          <button
            className={styles.chip}
            aria-label="New pattern"
            onClick={newPattern}
            disabled={track.patterns.length >= 26}
            {...tip('newPattern')}
          >
            ＋
          </button>
        </div>
        <div className={styles.field}>
          <span className={styles.flabel}>Length</span>
          <Segmented
            label="Pattern length"
            tipKey="patternLength"
            value={pattern.lengthBars}
            onChange={(v) => a.setPatternLength(track.id, pattern.id, v as PatternLength)}
            options={[
              { value: 1, label: '1 bar' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.flabel}>Grid</span>
          <Segmented
            label="Step size"
            tipKey="grid"
            value={pattern.stepsPerBar}
            onChange={(v) => a.setPatternGrid(track.id, pattern.id, v as StepsPerBar)}
            options={[
              { value: 16, label: '16ths' },
              { value: 24, label: 'Triplets' },
            ]}
          />
        </div>
        <button
          className={styles.ideasBtn}
          onClick={() => ui.openModalId('ideas')}
          {...tip('ideas')}
        >
          💡 Ideas
        </button>
        <div className="spacer" />
        {notes && (
          <div className={styles.inline} {...tip('chordStamp')}>
            Chord stamp
            <Segmented
              label="Chord stamp"
              value={chordStamp}
              onChange={(v) => ui.setChordStamp(v)}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'triad', label: 'Triad' },
                { value: 'seventh', label: '7th' },
              ]}
            />
          </div>
        )}
        {isDrum && (
          <label className={styles.inline} {...tip('drumView')}>
            Show all drums
            <Toggle on={drumView} onChange={(v) => ui.setDrumView(v)} label="Show all drums" />
          </label>
        )}
        <button
          className="ghost small"
          onClick={() => a.clearPattern(track.id, pattern.id)}
          {...tip('clear')}
        >
          Clear
        </button>
      </div>
      <div className={styles.body}>
        {showDrums ? (
          <DrumView />
        ) : notes ? (
          <PianoRoll key={`${track.id}:${pattern.id}`} track={track} pattern={pattern} />
        ) : (
          <StepEditor track={track} pattern={pattern} />
        )}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
