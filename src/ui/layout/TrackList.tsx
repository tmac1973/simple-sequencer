import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MAX_TRACKS, TRACK_COLORS } from '@/model/constants';
import { dbToSlider, sliderToDb } from '@/model/mixing';
import { newId } from '@/model/factories';
import type { Track } from '@/model/types';
import { soundInfo } from '@/library/soundNames';
import { presetName } from '@/library/presetNames';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { ContextMenu, swatchStyles, type MenuItem } from '../components/controls';
import { useSelection } from '../hooks/selection';
import { useSoundNamesVersion } from '../hooks/useSoundNames';
import { tip } from '../tooltips';
import { onScroll } from './scrollSync';
import { LaneRows } from './LaneRows';
import { useAutoKnob } from '../hooks/useAutoKnob';
import styles from './TrackList.module.css';

export function trackIcon(t: Track): string {
  if (t.kind === 'synth') return '🎹';
  if (t.sample?.melodic) return '🎵';
  const n = t.name.toLowerCase();
  if (n.includes('kick')) return '🥁';
  if (n.includes('snare') || n.includes('rim')) return '🪘';
  if (n.includes('hat') || n.includes('cym')) return '✨';
  if (n.includes('clap') || n.includes('snap')) return '👏';
  if (n.includes('vox') || n.includes('vocal') || n.includes('chop')) return '🎤';
  return '🔊';
}

export function trackSubtitle(t: Track): string {
  if (t.kind === 'synth') return `Synth · ${presetName(t.synth?.presetId ?? '')}`;
  return soundInfo(t.sample?.sampleId ?? '').name;
}

function TrackRow({ track, index, selected }: { track: Track; index: number; selected: boolean }) {
  useSoundNamesVersion();
  const a = useSongStore.getState();
  const ui = useUiStore.getState();
  const trackCount = useSongStore((s) => s.song.tracks.length);
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef(newId());
  const volA = useAutoKnob(track, { kind: 'track', param: 'volume' });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const items: MenuItem[] = [
    { label: '✏️ Rename', onClick: () => setRenaming(true) },
    {
      label: '⧉ Duplicate',
      onClick: () => a.duplicateTrack(track.id),
      disabled: trackCount >= MAX_TRACKS,
      tip: trackCount >= MAX_TRACKS ? 'trackLimit' : undefined,
    },
    {
      label: 'Color',
      custom: (
        <div className={swatchStyles.swatches}>
          {TRACK_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              className={c === track.color ? swatchStyles.on : ''}
              style={{ background: c }}
              onClick={() => {
                a.setTrackColor(track.id, c);
                setMenu(null);
              }}
            />
          ))}
        </div>
      ),
    },
    { separator: true, label: '' },
    { label: '🗑 Delete track', onClick: () => a.removeTrack(track.id) },
  ];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.row} ${selected ? styles.sel : ''} ${isDragging ? styles.dragging : ''}`}
      onClick={() => ui.selectTrack(track.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        ui.selectTrack(track.id);
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      data-track-row={index}
      aria-label={`Track ${track.name}`}
      aria-selected={selected}
      role="row"
      {...tip('trackRow')}
    >
      <div
        className={styles.sw}
        style={{ background: track.color }}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${track.name}`}
      />
      <div className={styles.ti} style={{ background: `${track.color}22` }}>
        {trackIcon(track)}
      </div>
      <div className={styles.nm} onDoubleClick={() => setRenaming(true)}>
        {renaming ? (
          <input
            className={styles.rename}
            defaultValue={track.name}
            autoFocus
            aria-label="Track name"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              a.renameTrack(track.id, e.target.value);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <b>{track.name}</b>
        )}
        <span>{trackSubtitle(track)}</span>
      </div>
      <input
        type="range"
        className={styles.vol}
        min={0}
        max={1000}
        value={Math.round((volA.live ?? dbToSlider(track.volumeDb)) * 1000)}
        disabled={volA.automated}
        aria-label={`${track.name} volume`}
        onPointerDown={(e) => {
          e.stopPropagation();
          gesture.current = newId();
        }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          a.setVolume(track.id, sliderToDb(Number(e.target.value) / 1000), gesture.current)
        }
        onDoubleClick={() => a.setVolume(track.id, 0)}
        {...tip(volA.automated ? 'volumeAutomated' : 'volume')}
      />
      <div className={styles.ms}>
        <button
          className={`${styles.m} ${track.mute ? styles.on : ''}`}
          aria-pressed={track.mute}
          aria-label={`Mute ${track.name}`}
          onClick={(e) => {
            e.stopPropagation();
            a.toggleMute(track.id);
          }}
          {...tip('mute')}
        >
          M
        </button>
        <button
          className={`${styles.s} ${track.solo ? styles.on : ''}`}
          aria-pressed={track.solo}
          aria-label={`Solo ${track.name}`}
          onClick={(e) => {
            e.stopPropagation();
            a.toggleSolo(track.id);
          }}
          {...tip('solo')}
        >
          S
        </button>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function TrackList({ footer }: { footer?: ReactNode }) {
  const tracks = useSongStore((s) => s.song.tracks);
  const { track: sel, pattern } = useSelection();
  const a = useSongStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => onScroll((top) => scroller.current && (scroller.current.scrollTop = top)), []);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = tracks.findIndex((t) => t.id === e.over!.id);
    a.moveTrack(String(e.active.id), to);
  };
  const full = tracks.length >= MAX_TRACKS;
  const add = (kind: 'sample' | 'synth') => {
    const id = a.addTrack(kind);
    if (id) useUiStore.getState().selectTrack(id);
  };

  return (
    <aside className={styles.list} aria-label="Tracks">
      <div className={styles.head}>
        <span>TRACKS</span>
        <span {...tip('paint')}>
          Paint: <b>{pattern?.name ?? '–'}</b>
        </span>
      </div>
      <div
        className={styles.scroller}
        ref={scroller}
        onWheel={(e) => {
          const tl = document.querySelector<HTMLElement>('[data-timeline-scroll]');
          if (tl) tl.scrollTop += e.deltaY;
        }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tracks.map((t, i) => (
              <div key={t.id}>
                <TrackRow track={t} index={i} selected={t.id === sel?.id} />
                <LaneRows track={t} />
              </div>
            ))}
          </SortableContext>
        </DndContext>
        {tracks.length === 0 && (
          <div className={styles.empty}>No tracks yet. Add one below to start.</div>
        )}
        <div className={styles.add}>
          <button
            disabled={full}
            onClick={() => add('sample')}
            {...tip(full ? 'trackLimit' : 'addSample')}
          >
            ＋ Drum/Sample
          </button>
          <button
            disabled={full}
            onClick={() => add('synth')}
            {...tip(full ? 'trackLimit' : 'addSynth')}
          >
            ＋ Synth
          </button>
        </div>
        {footer}
        <div style={{ height: 40 }} />
      </div>
    </aside>
  );
}
