import * as Tone from 'tone';
import { pointsBetween, targetKey, targetStatic, valueAt } from '@/model/automation';
import { sliderToDb } from '@/model/mixing';
import { BEATS_PER_BAR } from '@/model/timing';
import type { AutomationTarget, Song, Track } from '@/model/types';
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

/** Keys ("<trackId>|<targetKey>") of every automated param in the song. */
export function automatedSet(song: Song): Set<string> {
  const s = new Set<string>();
  for (const t of song.tracks)
    for (const l of t.automation) if (l.points.length) s.add(`${t.id}|${targetKey(l.target)}`);
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
