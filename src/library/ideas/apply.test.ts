import { useSongStore } from '@/store/songStore';
import { MAX_TRACKS } from '@/model/constants';
import { createSampleTrack, createSong } from '@/model/factories';
import { degreeToMidi, SCALES } from '@/model/scale';
import { blockAt } from '@/model/timing';
import type { Song } from '@/model/types';
import { buildEmpty } from '@/templates/empty';
import { buildLofi } from '@/templates/lofi';
import { buildHouse } from '@/templates/house';
import { buildHiphop } from '@/templates/hiphop';
import { buildTriphop } from '@/templates/triphop';
import { ideaById, IDEAS } from '.';
import { applyIdea, buildPreviewSong, fitDegree, partOfTrack, planIdea, songKit } from './apply';

const idea = (id: string) => ideaById(id)!;
const sel = (song: Song, name: string, pattern = 'A') => {
  const t = song.tracks.find((x) => x.name === name)!;
  return { trackId: t.id, patternId: t.patterns.find((p) => p.name === pattern)!.id };
};
const named = (song: Song, name: string) => song.tracks.find((t) => t.name === name)!;

describe('matching drum parts to tracks', () => {
  it('recognises bundled sounds by category and others by name', () => {
    const song = buildLofi();
    expect(song.tracks.map(partOfTrack).filter(Boolean)).toEqual(
      expect.arrayContaining(['kick', 'snare', 'hat']),
    );
    const user = createSampleTrack({ name: 'My Clap', sampleId: 'user:abc' });
    expect(partOfTrack(user)).toBe('clap');
    expect(partOfTrack(createSampleTrack({ name: 'Open HH', sampleId: 'user:x' }))).toBe('openhat');
    expect(partOfTrack(createSampleTrack({ name: 'Thing', sampleId: 'user:x' }))).toBeNull();
    expect(songKit(buildHouse())).toBe('club');
    expect(songKit(buildHiphop())).toBe('808');
    expect(songKit(createSong())).toBeNull();
  });

  it('maps the kit and plans new tracks for missing parts from the song’s kit', () => {
    const song = buildHiphop();
    const plan = planIdea(song, idea('boom-bap-swung'), sel(song, 'Kick'), 'use');
    expect(plan.problem).toBeUndefined();
    expect(plan.patternName).toBe('A');
    const byPart = Object.fromEntries(plan.parts.map((p) => [p.part, p]));
    expect(byPart.kick!.trackName).toBe('Kick');
    expect(byPart.snare!.trackId).not.toBeNull();
    expect(byPart.rim!.trackId).not.toBeNull(); // the hip-hop template has a rim track
  });
});

describe('applying drum grooves', () => {
  it('fills the kit on the Empty template, adding missing tracks', () => {
    const song = buildEmpty();
    const before = song.tracks.length;
    const plan = planIdea(song, idea('house-4otf'), sel(song, 'Drums'), 'use');
    expect(plan.parts.filter((p) => !p.trackId).map((p) => p.part)).toEqual([
      'clap',
      'hat',
      'openhat',
    ]);
    const r = applyIdea(song, idea('house-4otf'), plan, { setFeel: false })!;
    expect(song.tracks.length).toBe(before + 3);
    expect(r.addedTrackIds).toHaveLength(3);
    // new drum tracks sit with the drums, before the bass
    expect(song.tracks.map((t) => t.name)).toEqual(['Drums', 'Clap', 'Hi-hat', 'Open hat', 'Bass']);
    expect(named(song, 'Clap').sample!.sampleId).toBe('lib:dusty-snap');
    expect(named(song, 'Drums').patterns[0]!.steps.map((s) => s.index)).toEqual([0, 4, 8, 12]);
    // every part of the groove plays together at the same bar
    for (const t of song.tracks.slice(0, 4)) expect(blockAt(t, 0)?.pattern.name).toBe('A');
    expect(r.focusTrackId).toBe(named(song, 'Drums').id);
  });

  it('uses the idea’s own kit when the song has no drums', () => {
    const song = createSong({ tracks: [] });
    const plan = planIdea(song, idea('trap-rolls'), { trackId: null, patternId: null }, 'use');
    expect(plan.kit).toBe('808');
    applyIdea(song, idea('trap-rolls'), plan, { setFeel: true });
    expect(song.tracks.map((t) => t.sample?.sampleId)).toEqual([
      'lib:808-kick',
      'lib:808-snare',
      'lib:808-clap',
      'lib:808-hat',
    ]);
    expect(song.bpm).toBe(140);
    expect(song.swing).toBe(0);
    expect(song.tracks[0]!.patterns[0]!.stepsPerBar).toBe(24);
    expect(song.tracks[0]!.patterns[0]!.lengthBars).toBe(2);
  });

  it('keeps the tempo when it already fits, sets the suggested swing', () => {
    const song = buildLofi(); // 84 BPM
    applyIdea(
      song,
      idea('lofi-lazy'),
      planIdea(song, idea('lofi-lazy'), sel(song, 'Kick'), 'use'),
      {
        setFeel: true,
      },
    );
    expect(song.bpm).toBe(84);
    expect(song.swing).toBe(0.35);
  });

  it('re-lays existing blocks when the pattern gets longer, so it still plays in full', () => {
    const song = buildLofi();
    const kick = named(song, 'Kick');
    const aId = kick.patterns.find((p) => p.name === 'A')!.id;
    const aBars = kick.blocks.filter((b) => b.patternId === aId).map((b) => b.startBar);
    applyIdea(
      song,
      idea('boom-bap-straight'),
      planIdea(song, idea('boom-bap-straight'), sel(song, 'Kick'), 'use'),
      { setFeel: false },
    );
    const after = named(song, 'Kick')
      .blocks.filter((b) => b.patternId === aId)
      .map((b) => b.startBar);
    // runs of 1-bar blocks become 2-bar blocks covering the same bars
    expect(after.every((b) => aBars.includes(b))).toBe(true);
    expect(after.length).toBeLessThan(aBars.length);
    for (const b of after) expect(blockAt(named(song, 'Kick'), b)?.pattern.id).toBe(aId);
  });

  it('“Add as new” uses the first letter free on every kit track and places it after the song', () => {
    const song = buildLofi();
    const end = song.lengthBars;
    const plan = planIdea(song, idea('funk-16ths'), sel(song, 'Kick'), 'new');
    expect(plan.patternName).toBe('C');
    const r = applyIdea(song, idea('funk-16ths'), plan, { setFeel: false })!;
    for (const [trackId, patternId] of Object.entries(r.patterns)) {
      const t = song.tracks.find((x) => x.id === trackId)!;
      expect(t.patterns.find((p) => p.id === patternId)!.name).toBe('C');
      expect(blockAt(t, end)?.pattern.id).toBe(patternId);
    }
    expect(song.lengthBars).toBe(end + 1);
  });

  it('stops adding tracks at the 16-track limit and says which parts were left out', () => {
    const song = buildEmpty();
    while (song.tracks.length < MAX_TRACKS)
      song.tracks.push(createSampleTrack({ name: `Thing ${song.tracks.length}` }, song.tracks));
    song.tracks.forEach((t, i) => {
      if (i > 1 && t.sample) t.sample.sampleId = 'user:x';
    });
    const plan = planIdea(song, idea('house-4otf'), sel(song, 'Drums'), 'use');
    expect(plan.skipped).toEqual(['clap', 'hat', 'openhat']);
    applyIdea(song, idea('house-4otf'), plan, { setFeel: false });
    expect(song.tracks).toHaveLength(MAX_TRACKS);
  });
});

describe('applying note ideas', () => {
  it('writes into the selected synth track, in key', () => {
    const song = buildTriphop();
    const s = sel(song, 'Sub Bass');
    const plan = planIdea(song, idea('bass-walking'), s, 'use');
    expect(plan.noteTrack?.trackId).toBe(s.trackId);
    applyIdea(song, idea('bass-walking'), plan, { setFeel: false });
    const p = named(song, 'Sub Bass').patterns.find((x) => x.id === s.patternId)!;
    expect(p.notes).toHaveLength(16);
    expect(p.steps).toEqual([]);
    const allowed = new Set(SCALES.minor.intervals.map((i) => (i + 2) % 12));
    for (const n of p.notes) expect(allowed.has(degreeToMidi(n.degree, song.key) % 12)).toBe(true);
  });

  it('adds a synth track when a drum track is selected', () => {
    const song = buildLofi();
    const before = song.tracks.length;
    const plan = planIdea(song, idea('chords-pop-held'), sel(song, 'Kick'), 'use');
    expect(plan.noteTrack).toEqual({
      trackId: null,
      trackName: 'Keys',
      presetId: 'electric-piano',
    });
    const r = applyIdea(song, idea('chords-pop-held'), plan, { setFeel: false })!;
    expect(song.tracks).toHaveLength(before + 1);
    expect(r.focusTrackId).toBe(song.tracks[before]!.id);
  });

  it('fits notes into pentatonic keys', () => {
    expect(fitDegree(0, 'minor')).toBe(0);
    // in minor pentatonic (0 3 5 7 10): the 2nd (2 semitones) becomes the root or minor 3rd
    const n = fitDegree(1, 'minorPentatonic');
    expect([0, 1]).toContain(n);
    expect(fitDegree(7, 'minorPentatonic')).toBe(5); // octave
    expect(fitDegree(-7, 'majorPentatonic')).toBe(-5);
    expect(fitDegree(4, 'majorPentatonic')).toBe(3); // the 5th
  });
});

describe('undo and preview', () => {
  it('one undo takes back a whole kit apply', () => {
    const store = useSongStore.getState();
    store.loadSong(buildEmpty());
    const before = useSongStore.getState().song;
    const s = sel(before, 'Drums');
    const plan = planIdea(before, idea('disco'), s, 'use');
    expect(useSongStore.getState().applyIdea(idea('disco'), plan, true, s.trackId)).not.toBeNull();
    expect(useSongStore.getState().song.tracks.length).toBeGreaterThan(before.tracks.length);
    useSongStore.getState().undo();
    expect(useSongStore.getState().song).toEqual(before);
  });

  it('builds a preview song without touching the real one', () => {
    const song = buildLofi();
    const snapshot = structuredClone(song);
    for (const i of IDEAS) {
      const plan = planIdea(song, i, sel(song, 'Kick'), 'use');
      const p = buildPreviewSong(song, i, plan, true)!;
      expect(p.lengthBars).toBe(i.bars);
      expect(p.tracks.length).toBeGreaterThan(0);
      for (const t of p.tracks) expect(t.blocks).toHaveLength(1);
    }
    expect(song).toEqual(snapshot);
  });

  it('every idea applies cleanly on every template', () => {
    for (const build of [buildEmpty, buildLofi, buildHouse, buildHiphop, buildTriphop]) {
      for (const i of IDEAS) {
        for (const mode of ['use', 'new'] as const) {
          const song = build();
          const t = song.tracks[0]!;
          const plan = planIdea(song, i, { trackId: t.id, patternId: t.patterns[0]!.id }, mode);
          expect(plan.problem, `${i.id} ${mode}`).toBeUndefined();
          expect(applyIdea(song, i, plan, { setFeel: true })).not.toBeNull();
          expect(song.tracks.length).toBeLessThanOrEqual(MAX_TRACKS);
        }
      }
    }
  });
});
