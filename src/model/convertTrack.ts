import { createSampleTrack, createSynthTrack } from './factories';
import type { AutomationLane, Track } from './types';

/** The sound a synth track gets when it turns into a sample track (a pitched piano note). */
export const CONVERT_SAMPLE = { sampleId: 'lib:piano-c3', rootMidi: 48 };

export interface ConvertResult {
  track: Track;
  /** automation lanes that had no equivalent on the new kind of track */
  droppedLanes: number;
}

/**
 * Turn a synth track into a sample track or the other way round, keeping everything that
 * still makes sense: name, color, mix, patterns, timeline, effects, ducking and automation.
 *
 * - Synth → sample: a melodic sample (so the notes keep playing, now on a piano note).
 * - Sample → synth: melodic notes carry over; a drum pattern's hits become notes on the
 *   key's root so the rhythm survives. Steps are kept too, so converting back restores them.
 * - The synth "Tone" lane and the sample "Tone" lane swap into each other; the synth
 *   "Space" lane has no sample equivalent and is dropped (with any wobble lanes on it).
 */
export function convertTrackKind(t: Track): ConvertResult {
  const toSample = t.kind === 'synth';
  const { sample: _s, synth: _y, ...rest } = t;
  const base: Track = { ...rest, kind: toSample ? 'sample' : 'synth' };

  if (toSample) {
    base.sample = createSampleTrack({ ...CONVERT_SAMPLE, melodic: true }).sample;
  } else {
    const melodic = !!t.sample?.melodic;
    const presetId = !melodic
      ? 'soft-pluck'
      : (t.sample?.rootMidi ?? 60) < 52
        ? 'warm-bass'
        : 'electric-piano';
    base.synth = createSynthTrack({ presetId }).synth;
    if (!melodic)
      base.patterns = t.patterns.map((p) =>
        p.notes.length || !p.steps.length
          ? p
          : {
              ...p,
              notes: p.steps.map((s) => ({
                start: s.index,
                length: 1,
                degree: 0,
                velocity: s.velocity,
                ...(s.chance !== undefined ? { chance: s.chance } : {}),
              })),
            },
      );
  }

  const kept: AutomationLane[] = [];
  const dropped = new Set<string>();
  for (const l of t.automation) {
    const k = l.target;
    if (toSample && k.kind === 'synthMacro') {
      if (k.macro === 'tone') kept.push({ ...l, target: { kind: 'sampleTone' } });
      else dropped.add(l.id);
    } else if (!toSample && k.kind === 'sampleTone') {
      kept.push({ ...l, target: { kind: 'synthMacro', macro: 'tone' } });
    } else kept.push(l);
  }
  base.automation = kept.filter((l) => {
    if (l.target.kind === 'lfo' && dropped.has(l.target.laneId)) {
      dropped.add(l.id);
      return false;
    }
    return true;
  });

  return { track: base, droppedLanes: dropped.size };
}
