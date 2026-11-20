import showcase from '../../docs/examples/showcase-song.json';
import manifest from '../../public/samples/manifest.json';
import { PRESETS } from '@/audio/synthPresets';
import { lintSong, type LintCatalog } from './songLint';

const catalog: LintCatalog = {
  sounds: new Map(
    manifest.samples.map((s) => [s.id, (s as { rootNote?: number }).rootNote] as const),
  ),
  presetIds: new Set(PRESETS.map((p) => p.id)),
};
const copy = () =>
  structuredClone(showcase) as unknown as {
    tracks: Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
const warningsFor = (raw: unknown, extra: Partial<LintCatalog> = {}) =>
  lintSong(raw, { ...catalog, ...extra }).warnings.join('\n');

describe('lintSong', () => {
  it('passes the showcase song with no errors or warnings', () => {
    const r = lintSong(showcase, catalog);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.song?.tracks).toHaveLength(11);
  });

  it('reports what the app would refuse to open', () => {
    const s = copy();
    s.tracks[0]!.volumeDb = 20;
    const r = lintSong(s, catalog);
    expect(r.song).toBeNull();
    expect(r.errors[0]).toMatch(/tracks\[0\]\.volumeDb should be between -60 and 6/);
    expect(lintSong({ format: 'something-else' }, catalog).errors[0]).toMatch(/isn't a Simple/);
  });

  it('warns about sounds, presets and tuning', () => {
    const s = copy();
    s.tracks[0]!.sample.sampleId = 'lib:nope';
    s.tracks[4]!.synth.presetId = 'no-preset';
    s.tracks[9]!.sample.rootMidi = 60;
    s.tracks[7]!.sample.sampleId = 'user:hiss';
    const w = warningsFor(s);
    expect(w).toMatch(/no built-in sound "lib:nope"/);
    expect(w).toMatch(/no synth preset "no-preset"/);
    expect(w).toMatch(/recorded at MIDI 57, but rootMidi is 60/);
    expect(w).toMatch(/"user:hiss" is one of your own sounds/);
    expect(warningsFor(s, { userSounds: new Set(['user:hiss']) })).not.toMatch(/user:hiss/);
  });

  it('warns about things the app drops or never plays', () => {
    const s = copy();
    s.tracks[1]!.patterns[0].steps.push({ index: 99, velocity: 0.5 });
    s.tracks[2]!.blocks.push({ id: 'x', patternId: 'missing', startBar: 0 });
    s.tracks[3]!.blocks.push({ id: 'late', patternId: 'shaker-A', startBar: 30 });
    s.tracks[4]!.patterns[0].notes = [];
    s.tracks[4]!.patterns[0].steps = [{ index: 0, velocity: 1 }];
    s.tracks[5]!.automation[0].points.reverse();
    s.tracks[6]!.duck.sourceId = 'ghost';
    s.tracks[0]!.patterns[0].notes = [{ start: 0, length: 1, degree: 0, velocity: 1 }];
    s.tracks[0]!.patterns[0].steps = [];
    s.tracks[1]!.id = 'kick';
    const w = warningsFor(s);
    for (const re of [
      /index outside 0–15/,
      /points to pattern "missing"/,
      /starts at bar 30, after the song ends/,
      /has steps but no notes/,
      /has notes but no steps/,
      /points should be sorted/,
      /"ghost" isn't another track/,
      /share the id "kick"/,
    ])
      expect(w).toMatch(re);
  });
});
