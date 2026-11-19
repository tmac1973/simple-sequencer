import * as Tone from 'tone';
import { pointsBetween, targetKey, targetStatic, valueAt } from '@/model/automation';
import { sliderToDb } from '@/model/mixing';
import { BEATS_PER_BAR } from '@/model/timing';
import type { AutomationLane, AutomationTarget, Song, Track } from '@/model/types';
import { cyclesAt, DEFAULT_LFO, isLfoLane, isSteppy, lfoControlLanes, lfoValue } from '@/model/lfo';
import { spaceToWet, toneToHz as synthToneHz } from './macros';
import { toneToHz as sampleToneHz } from './voices/sampleTiming';
import type { GraphSet } from './engine';

/** Something a lane can drive: jump to a value, or ramp to one, at an audio time. */
export interface ParamDriver {
  set(v: number, time: number): void;
  ramp(v: number, time: number): void;
  cancel(time: number): void;
}

const volDb = (v: number) => (v <= 0.001 ? -100 : Math.max(-100, sliderToDb(v)));

function paramDriver(
  p:
    | Tone.Param<'decibels'>
    | Tone.Param<'audioRange'>
    | Tone.Signal<'frequency'>
    | Tone.Signal<'normalRange'>,
  map: (v: number) => number,
  exp = false,
): ParamDriver {
  return {
    set: (v, t) => void p.setValueAtTime(map(v), t),
    ramp: (v, t) =>
      void (exp ? p.exponentialRampToValueAtTime(map(v), t) : p.linearRampToValueAtTime(map(v), t)),
    cancel: (t) => void p.cancelAndHoldAtTime(t),
  };
}

export function resolveDriver(
  graphs: GraphSet,
  track: Track,
  target: AutomationTarget,
): ParamDriver | null {
  switch (target.kind) {
    case 'track': {
      const g = graphs.tracks.get(track.id);
      if (!g) return null;
      return target.param === 'volume'
        ? paramDriver(g.channel.volume, volDb)
        : paramDriver(g.channel.pan, (v) => v * 2 - 1);
    }
    case 'synthMacro': {
      const voice = graphs.synths.get(track.id);
      if (!voice) return null;
      return target.macro === 'tone'
        ? paramDriver(voice.toneFilter.frequency, synthToneHz, true)
        : paramDriver(voice.space.wet, spaceToWet);
    }
    case 'sampleTone': {
      const f = graphs.sampleTone.get(track.id);
      return f ? paramDriver(f.frequency, sampleToneHz, true) : null;
    }
    case 'fx': {
      const e = graphs.fx.get(target.fxId);
      if (!e?.inst.rampAt) return null;
      const inst = e.inst;
      return {
        set: (v, t) => inst.rampAt!(target.param, v, t + 0.003),
        ramp: (v, t) => inst.rampAt!(target.param, v, t),
        cancel: () => {},
      };
    }
    case 'lfo':
      // drives another lane's wobble, not a sound parameter
      return null;
  }
}

/**
 * Schedule every lane for one beat: ramp through each point inside the beat (corners and
 * vertical steps land exactly), then on to the value at the beat's end.
 * `jump` = playback just started or looped, so set the starting value instantly.
 */
export function scheduleAutomation(
  graphs: GraphSet,
  song: Song,
  songBeat: number,
  time: number,
  beatSec: number,
  jump: boolean,
) {
  const fromBar = songBeat / BEATS_PER_BAR;
  const toBar = (songBeat + 1) / BEATS_PER_BAR;
  const barSec = beatSec * BEATS_PER_BAR;
  for (const track of song.tracks) {
    for (const lane of track.automation) {
      if (isLfoLane(lane)) {
        const d = resolveDriver(graphs, track, lane.target);
        if (d) scheduleLfoBeat(d, track, lane, songBeat, time, beatSec, jump);
        continue;
      }
      if (!lane.points.length) continue;
      const d = resolveDriver(graphs, track, lane.target);
      if (!d) continue;
      if (jump) {
        d.cancel(time);
        d.set(valueAt(lane, fromBar)!, time);
      }
      for (const p of pointsBetween(lane, fromBar, toBar))
        d.ramp(p.value, time + (p.bar - fromBar) * barSec);
      d.ramp(valueAt(lane, toBar)!, time + beatSec);
    }
  }
}

/**
 * One beat of a wobble lane. Smooth shapes ramp through enough points to trace the curve
 * (at least 16 per cycle); square and random shapes jump exactly at their edges.
 */
export function scheduleLfoBeat(
  d: ParamDriver,
  track: Track,
  lane: AutomationLane,
  songBeat: number,
  time: number,
  beatSec: number,
  jump: boolean,
) {
  const lfo = lane.lfo ?? DEFAULT_LFO;
  if (jump) {
    d.cancel(time);
    d.set(lfoValue(track, lane, songBeat), time);
  }
  const { speed } = lfoControlLanes(track, lane.id);
  const c0 = cyclesAt(lfo, songBeat, speed);
  const c1 = cyclesAt(lfo, songBeat + 1, speed);
  if (isSteppy(lfo.shape)) {
    const per = lfo.shape === 'square' ? 2 : 1; // edges per cycle
    for (let k = Math.floor(c0 * per) + 1; k / per <= c1; k++) {
      const f = (k / per - c0) / (c1 - c0); // fraction of the beat (speed is constant within it)
      d.set(lfoValue(track, lane, songBeat + f + 1e-6), time + f * beatSec);
    }
    return;
  }
  const n = Math.max(4, Math.ceil((c1 - c0) * 16));
  for (let i = 1; i <= n; i++)
    d.ramp(lfoValue(track, lane, songBeat + i / n), time + (i / n) * beatSec);
}

/** Keys ("<trackId>|<targetKey>") of every automated param in the song. */
export function automatedSet(song: Song): Set<string> {
  const s = new Set<string>();
  for (const t of song.tracks)
    for (const l of t.automation)
      if (l.points.length || isLfoLane(l)) s.add(`${t.id}|${targetKey(l.target)}`);
  return s;
}

/** Put every automated param back to its knob value (after stopping). */
export function resetAutomation(graphs: GraphSet, song: Song, now: number) {
  for (const track of song.tracks) {
    for (const lane of track.automation) {
      const d = resolveDriver(graphs, track, lane.target);
      if (!d) continue;
      d.cancel(now);
      d.ramp(targetStatic(track, lane.target), now + 0.03);
    }
  }
}
