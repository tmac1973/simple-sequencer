import { createSong } from '@/model/factories';
import { buildHouse } from '@/templates/house';
import { decodeShare, encodeShare } from '@/storage/shareLink';
import { validateSong } from './schema';
import { useSongStore } from '@/store/songStore';
import {
  defaultDuckSource,
  hashStr,
  humanizeHit,
  HUMANIZE_MAX_SEC,
  HUMANIZE_MAX_VEL,
  kickTrack,
  plays,
  rand01,
} from './groove';

describe('repeatable randomness', () => {
  it('rand01 is repeatable, in range and roughly uniform', () => {
    const seed = hashStr('track-1');
    expect(rand01(seed, 3, 7, 1)).toBe(rand01(seed, 3, 7, 1));
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const r = rand01(seed, i % 64, (i * 7) % 16, Math.floor(i / 1000));
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      sum += r;
    }
    expect(sum / n).toBeCloseTo(0.5, 1);
  });

  it('chance plays about that often, and always at 100%', () => {
    const seed = hashStr('hat');
    let hits = 0;
    for (let pass = 0; pass < 2000; pass++) if (plays(0.3, { seed, bar: 2, step: 5, pass })) hits++;
    expect(hits / 2000).toBeGreaterThan(0.25);
    expect(hits / 2000).toBeLessThan(0.35);
    expect(plays(undefined, { seed, bar: 0, step: 0, pass: 0 })).toBe(true);
    expect(plays(1, { seed, bar: 0, step: 0, pass: 0 })).toBe(true);
  });

  it('humanize stays inside its limits and is gentler on the beat', () => {
    const seed = hashStr('snare');
    let maxOff = 0;
    let maxOn = 0;
    for (let step = 0; step < 400; step++) {
      const k = { seed, bar: step >> 4, step, pass: 0 };
      const off = humanizeHit(1, k, false);
      const on = humanizeHit(1, k, true);
      expect(Math.abs(off.dt)).toBeLessThanOrEqual(HUMANIZE_MAX_SEC);
      expect(Math.abs(off.vel - 1)).toBeLessThanOrEqual(HUMANIZE_MAX_VEL);
      maxOff = Math.max(maxOff, Math.abs(off.dt));
      maxOn = Math.max(maxOn, Math.abs(on.dt));
    }
    expect(maxOn).toBeLessThanOrEqual(HUMANIZE_MAX_SEC / 2);
    expect(maxOff).toBeGreaterThan(HUMANIZE_MAX_SEC * 0.8);
    expect(humanizeHit(0, { seed, bar: 0, step: 0, pass: 0 }, false)).toEqual({ dt: 0, vel: 1 });
  });
});

describe('ducking and chance in songs', () => {
  it('finds the kick to pump to', () => {
    const song = buildHouse();
    const pad = song.tracks.find((t) => t.kind === 'synth')!;
    expect(kickTrack(song.tracks)?.name).toMatch(/kick/i);
    expect(defaultDuckSource(song.tracks, pad.id)?.name).toMatch(/kick/i);
  });

  it('old songs load unchanged; a duck to a missing track is dropped', () => {
    const song = buildHouse();
    expect(validateSong(JSON.parse(JSON.stringify(song)))).toEqual(song);
    const t = song.tracks[1]!;
    const raw = JSON.parse(JSON.stringify(song));
    raw.tracks[1].duck = { sourceId: 'gone', on: true, amount: 0.5, release: 1 };
    expect(validateSong(raw).tracks[1]!.duck).toBeUndefined();
    raw.tracks[1].duck.sourceId = song.tracks[0]!.id;
    expect(validateSong(raw).tracks[1]!.duck?.sourceId).toBe(song.tracks[0]!.id);
    raw.tracks[1].duck.sourceId = t.id; // not to itself
    expect(validateSong(raw).tracks[1]!.duck).toBeUndefined();
  });

  it('share links carry chance, humanize and ducking', () => {
    const song = buildHouse();
    const kick = kickTrack(song.tracks)!;
    const synth = song.tracks.find((t) => t.kind === 'synth')!;
    const drum = song.tracks.find((t) => t.kind === 'sample' && t.patterns[0]!.steps.length)!;
    drum.patterns[0]!.steps[1]!.chance = 0.4;
    drum.humanize = 0.35;
    synth.duck = { sourceId: kick.id, on: true, amount: 0.7, release: 2 };
    if (synth.patterns[0]!.notes[0]) synth.patterns[0]!.notes[0].chance = 0.5;
    const back = decodeShare(encodeShare(song));
    const bDrum = back.tracks[song.tracks.indexOf(drum)]!;
    const bSynth = back.tracks[song.tracks.indexOf(synth)]!;
    expect(bDrum.patterns[0]!.steps[1]!.chance).toBe(0.4);
    expect(bDrum.patterns[0]!.steps[0]!.chance).toBeUndefined();
    expect(bDrum.humanize).toBe(0.35);
    expect(bSynth.duck).toEqual({
      sourceId: back.tracks[song.tracks.indexOf(kick)]!.id,
      on: true,
      amount: 0.7,
      release: 2,
    });
    if (synth.patterns[0]!.notes[0]) expect(bSynth.patterns[0]!.notes[0]!.chance).toBe(0.5);
  });

  it('store: chance, humanize, duck, and deleting the source removes the duck', () => {
    const s = () => useSongStore.getState();
    s().loadSong(createSong());
    const kick = s().addTrack('sample')!;
    const pad = s().addTrack('synth')!;
    const pid = s().song.tracks[0]!.patterns[0]!.id;
    s().toggleStep(kick, pid, 0);
    s().setStepChance(kick, pid, 0, 0.5);
    expect(s().song.tracks[0]!.patterns[0]!.steps[0]!.chance).toBe(0.5);
    s().setStepChance(kick, pid, 0, 1);
    expect(s().song.tracks[0]!.patterns[0]!.steps[0]!.chance).toBeUndefined();
    s().setHumanize(kick, 0.3);
    expect(s().song.tracks[0]!.humanize).toBe(0.3);
    s().setDuck(pad, { on: true });
    expect(s().song.tracks[1]!.duck).toMatchObject({ sourceId: kick, amount: 0.7, release: 2 });
    s().removeTrack(kick);
    expect(s().song.tracks[0]!.duck).toBeUndefined();
    s().undo();
    expect(s().song.tracks[1]!.duck?.sourceId).toBe(kick);
  });

  it('store: a recording take is one undo step', () => {
    const s = () => useSongStore.getState();
    s().loadSong(createSong());
    const syn = s().addTrack('synth')!;
    const pid = s().song.tracks[0]!.patterns[0]!.id;
    const before = s().past.length;
    s().recordHits(
      syn,
      pid,
      { notes: [{ start: 0, length: 2, degree: 0, velocity: 0.8 }] },
      'take',
    );
    s().recordHits(
      syn,
      pid,
      { notes: [{ start: 4, length: 1, degree: 2, velocity: 0.6 }] },
      'take',
    );
    expect(s().song.tracks[0]!.patterns[0]!.notes).toHaveLength(2);
    expect(s().past.length).toBe(before + 1);
    s().undo();
    expect(s().song.tracks[0]!.patterns[0]!.notes).toHaveLength(0);
  });
});
