import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MAX_FX_PER_TRACK } from '@/model/constants';
import type { FxSlot, Track } from '@/model/types';
import {
  FX_DEFS,
  FX_ORDER,
  choiceIndex,
  defaultParams,
  type ParamDef,
} from '@/audio/effects/registry';
import { useSongStore } from '@/store/songStore';
import { engine } from '@/audio/engine';
import { isAudible } from '@/audio/scheduler';
import { Knob } from '../components/Knob';
import { Segmented, Toggle } from '../components/controls';
import { tip } from '../tooltips';
import { useAutoKnob } from '../hooks/useAutoKnob';
import styles from './Inspector.module.css';

function ParamControl({
  track,
  slot,
  def,
  size = 46,
}: {
  track: Track;
  slot: FxSlot;
  def: ParamDef;
  size?: number;
}) {
  const a = useSongStore.getState();
  const v = slot.params[def.key] ?? def.default;
  const auto = useAutoKnob(track, { kind: 'fx', fxId: slot.id, param: def.key });
  if (def.choices) {
    const n = def.choices.length;
    return (
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: 12.5,
        }}
        data-tip={def.tip}
      >
        <span>{def.label}</span>
        <Segmented
          label={def.label}
          value={choiceIndex(v, n)}
          onChange={(i) => a.setFxParam(track.id, slot.id, def.key, n === 1 ? 0 : i / (n - 1))}
          options={def.choices.map((c, i) => ({ value: i, label: c }))}
        />
      </div>
    );
  }
  return (
    <Knob
      label={def.label}
      size={size}
      color={track.color}
      value={auto.live ?? v}
      defaultValue={def.default}
      format={def.format}
      tipKey={def.tip ?? `fx.${slot.type}.${def.key}`}
      automated={auto.automated}
      onChange={(nv, g) => a.setFxParam(track.id, slot.id, def.key, nv, g)}
    />
  );
}

function FxCard({ track, slot }: { track: Track; slot: FxSlot }) {
  const def = FX_DEFS[slot.type];
  const [open, setOpen] = useState(false);
  const a = useSongStore.getState();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.fx}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: slot.enabled ? 1 : 0.6,
        zIndex: isDragging ? 5 : undefined,
      }}
      aria-label={`${def.name} effect`}
    >
      <div className={styles.fxHead}>
        <span
          className={styles.grip}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${def.name}`}
          data-tip="Reorder|Effects run top to bottom. Drag to change the order."
        >
          ⋮⋮
        </span>
        <b data-tip={`${def.name}|${def.blurb}.`}>
          {def.emoji} {def.name}
        </b>
        <Toggle
          on={slot.enabled}
          onChange={() => a.toggleFx(track.id, slot.id)}
          label={`${def.name} on/off`}
          tipKey="fxToggle"
        />
        <button
          className="ghost icon"
          aria-label={`Remove ${def.name}`}
          onClick={() => a.removeFx(track.id, slot.id)}
          {...tip('fxRemove')}
        >
          ✕
        </button>
      </div>
      <div className={styles.knobs2}>
        {def.main.map((d) => (
          <ParamControl key={d.key} track={track} slot={slot} def={d} />
        ))}
      </div>
      {def.advanced.length > 0 && (
        <>
          <button
            className={styles.adv}
            style={{ marginTop: 4 }}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            {...tip('advanced')}
          >
            {open ? '▾' : '▸'} Advanced
          </button>
          {open && (
            <div className={styles.knobs2} style={{ marginTop: 6 }}>
              {def.advanced.map((d) => (
                <ParamControl key={d.key} track={track} slot={slot} def={d} size={40} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { DuckCard } from './DuckCard';
/** ▶ Hear the track through its effects (one hit, or the key's root note for a beat). */
function PreviewRow({ track }: { track: Track }) {
  const anySolo = useSongStore((s) => s.song.tracks.some((t) => t.solo));
  const audible = isAudible(track, anySolo);
  return (
    <div className={styles.previewRow}>
      <button
        onClick={() => void engine.previewTrack(track.id, 'note')}
        disabled={!audible}
        {...tip(audible ? 'previewFx' : 'previewMuted')}
      >
        ▶ Preview
      </button>
      <span className="small muted">
        {audible ? (
          <>
            Hear it with these effects. Keys <kbd>A</kbd>–<kbd>L</kbd> play notes too.
          </>
        ) : (
          'This track is muted, so the preview is silent.'
        )}
      </span>
    </div>
  );
}

export function EffectsTab({ track }: { track: Track }) {
  const [menu, setMenu] = useState(false);
  const a = useSongStore.getState();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const full = track.fx.length >= MAX_FX_PER_TRACK;
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    a.moveFx(
      track.id,
      String(e.active.id),
      track.fx.findIndex((f) => f.id === e.over!.id),
    );
  };
  return (
    <>
      <PreviewRow track={track} />
      <DuckCard track={track} />
      {track.fx.length === 0 && (
        <p className="small muted">
          No effects yet. Add one to change how this track sounds, like reverb for space or
          distortion for grit.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={track.fx.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {track.fx.map((f) => (
            <FxCard key={f.id} track={track} slot={f} />
          ))}
        </SortableContext>
      </DndContext>
      <button
        className={styles.addFx}
        disabled={full}
        onClick={() => setMenu(!menu)}
        aria-expanded={menu}
        data-tip={
          full
            ? 'Effect limit|A track can have up to 6 effects.'
            : 'Add effect|Effects run top to bottom. Drag ⋮⋮ to reorder.'
        }
      >
        ＋ Add effect
      </button>
      {menu && (
        <div className={styles.fxMenu} role="menu" aria-label="Effects">
          {FX_ORDER.map((type) => {
            const d = FX_DEFS[type];
            return (
              <button
                key={type}
                role="menuitem"
                onClick={() => {
                  a.addFx(track.id, type, defaultParams(type));
                  setMenu(false);
                }}
              >
                <span>{d.emoji}</span>
                <span>
                  <b>{d.name}</b>
                  <small>{d.blurb}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className={styles.fxEnd}>
        <span>→ Master · Limiter</span>
        <span data-tip="Limiter|Always on. Stops the song from getting too loud and distorting.">
          🛡 always on
        </span>
      </div>
    </>
  );
}
