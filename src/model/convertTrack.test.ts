import { describe, expect, it } from 'vitest';
import { convertTrackKind, CONVERT_SAMPLE } from './convertTrack';
import { createLane, createPattern, createSampleTrack, createSynthTrack } from './factories';
import { validateSong } from './schema';
import { createSong } from './factories';

describe('convertTrackKind', () => {
  it('turns a synth track into a melodic sample track, keeping notes, mix and effects', () => {
    const p = createPattern({ notes: [{ start: 0, length: 4, degree: 2, velocity: 0.8 }] });
    const t = createSynthTrack({ name: 'Keys', volumeDb: -6, pan: 0.3, patterns: [p] });
    t.blocks = [{ id: 'b', patternId: p.id, startBar: 0 }];
    t.fx = [{ id: 'f', type: 'reverb', enabled: true, params: { mix: 0.4 } }];
    const { track, droppedLanes } = convertTrackKind(t);
    expect(track).toMatchObject({
      id: t.id,
      kind: 'sample',
      name: 'Keys',
      volumeDb: -6,
      pan: 0.3,
      blocks: t.blocks,
      fx: t.fx,
      patterns: [p],
    });
    expect(track.synth).toBeUndefined();
    expect(track.sample).toMatchObject({ ...CONVERT_SAMPLE, melodic: true });
    expect(droppedLanes).toBe(0);
  });

  it('turns drum hits into root notes when a drum track becomes a synth', () => {
    const p = createPattern({
      steps: [
        { index: 0, velocity: 1 },
        { index: 6, velocity: 0.5, chance: 0.5 },
      ],
    });
    const t = createSampleTrack({ sampleId: 'lib:dusty-kick', patterns: [p] });
    const { track } = convertTrackKind(t);
    expect(track.kind).toBe('synth');
    expect(track.sample).toBeUndefined();
    expect(track.synth?.presetId).toBe('soft-pluck');
    expect(track.patterns[0]!.notes).toEqual([
      { start: 0, length: 1, degree: 0, velocity: 1 },
      { start: 6, length: 1, degree: 0, velocity: 0.5, chance: 0.5 },
    ]);
    // steps stay, so turning it back into a sample track keeps the drum part
    expect(track.patterns[0]!.steps).toEqual(p.steps);
  });

  it('keeps the notes of a melodic sample and picks a preset that suits its range', () => {
    const p = createPattern({ notes: [{ start: 2, length: 2, degree: 0, velocity: 1 }] });
    const low = createSampleTrack({ melodic: true, rootMidi: 40, patterns: [p] });
    const high = createSampleTrack({ melodic: true, rootMidi: 64, patterns: [p] });
    expect(convertTrackKind(low).track.synth?.presetId).toBe('warm-bass');
    expect(convertTrackKind(high).track.synth?.presetId).toBe('electric-piano');
    expect(convertTrackKind(high).track.patterns[0]).toBe(p);
  });

  it('swaps the Tone lanes and drops Space (and wobbles on it)', () => {
    const t = createSynthTrack();
    const tone = createLane({ kind: 'synthMacro', macro: 'tone' }, [{ bar: 0, value: 0.2 }]);
    const space = createLane({ kind: 'synthMacro', macro: 'space' }, [{ bar: 0, value: 0.5 }]);
    const wob = createLane({ kind: 'lfo', laneId: space.id, param: 'amount' }, []);
    const vol = createLane({ kind: 'track', param: 'volume' }, [{ bar: 0, value: 0.7 }]);
    t.automation = [tone, space, wob, vol];
    const toSample = convertTrackKind(t);
    expect(toSample.droppedLanes).toBe(2);
    expect(toSample.track.automation.map((l) => l.target)).toEqual([
      { kind: 'sampleTone' },
      { kind: 'track', param: 'volume' },
    ]);
    expect(toSample.track.automation[0]!.points).toEqual(tone.points);
    const back = convertTrackKind(toSample.track);
    expect(back.track.automation[0]!.target).toEqual({ kind: 'synthMacro', macro: 'tone' });
  });

  it('gives a track the app can save and open again', () => {
    const synth = createSynthTrack();
    const drum = createSampleTrack();
    drum.patterns[0]!.steps = [{ index: 3, velocity: 1 }];
    const song = createSong({
      tracks: [convertTrackKind(synth).track, convertTrackKind(drum).track],
    });
    expect(() => validateSong(JSON.parse(JSON.stringify(song)))).not.toThrow();
  });
});
