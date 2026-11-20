import { createPattern, createSampleTrack, createSong, createSynthTrack } from '@/model/factories';
import { degreeToMidi } from '@/model/scale';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { keyDegree, keyLabels, keyTarget } from './keyboardPiano';
import { handleMidiMessage, midiTarget, midiToDegree } from './midi';
import { onLiveNote, type LiveNote } from './livePlay';
import { placeNote } from './takeRecorder';

describe('computer keyboard', () => {
  it('maps A–; and Q–P to scale degrees, Z/X octaves', () => {
    expect(keyDegree('KeyA', 0, 7)).toBe(0);
    expect(keyDegree('Semicolon', 0, 7)).toBe(9);
    expect(keyDegree('KeyQ', 0, 7)).toBe(7);
    expect(keyDegree('KeyA', 1, 7)).toBe(7);
    expect(keyDegree('KeyA', -1, 5)).toBe(-5);
    expect(keyDegree('KeyB', 0, 7)).toBeNull();
    const labels = keyLabels(0, 7);
    expect(labels.get(0)).toBe('A');
    expect(labels.get(7)).toBe('K'); // the lower row wins where both rows reach
    expect(labels.get(16)).toBe('P');
  });

  it('plays the selected track, or each drum in "Show all drums"', () => {
    const kick = createSampleTrack({ name: 'Kick' });
    const snare = createSampleTrack({ name: 'Snare' });
    const syn = createSynthTrack();
    useSongStore.getState().loadSong(createSong({ tracks: [kick, snare, syn] }));
    useUiStore.setState({ selectedTrackId: syn.id, drumView: false });
    expect(keyTarget('KeyD')).toEqual({ trackId: syn.id, degree: 2 });
    useUiStore.setState({ selectedTrackId: kick.id });
    expect(keyTarget('KeyD')).toEqual({ trackId: kick.id });
    useUiStore.setState({ drumView: true });
    expect(keyTarget('KeyS')).toEqual({ trackId: snare.id });
    expect(keyTarget('KeyG')).toBeNull();
  });
});

describe('MIDI', () => {
  it('snaps notes to the nearest note in the key, rounding down on ties', () => {
    const cMajor = { root: 0, scale: 'major' as const };
    for (let d = -10; d < 20; d++) expect(midiToDegree(degreeToMidi(d, cMajor), cMajor)).toBe(d);
    expect(midiToDegree(61, cMajor)).toBe(7); // C♯4 → C4 (tie)
    expect(midiToDegree(66, cMajor)).toBe(10); // F♯4 → F4 (tie)
    const aMinorPent = { root: 9, scale: 'minorPentatonic' as const };
    expect(degreeToMidi(midiToDegree(59, aMinorPent), aMinorPent)).toBe(60); // B → C (nearer)
  });

  it('note on/off reach live play, on the selected track', () => {
    const syn = createSynthTrack({ presetId: 'dusty-keys' });
    useSongStore.getState().loadSong(createSong({ tracks: [syn] }));
    useUiStore.setState({ selectedTrackId: syn.id, drumView: false, openModal: null });
    expect(midiTarget(48)?.degree).toBe(0);
    // a bass preset sounds an octave down, so the same key is a degree an octave up
    useSongStore
      .getState()
      .loadSong(
        createSong({ tracks: [{ ...syn, synth: { ...syn.synth!, presetId: 'sub-bass' } }] }),
      );
    expect(midiTarget(48)?.degree).toBe(7);
    useSongStore.getState().loadSong(createSong({ tracks: [syn] }));
    const seen: [LiveNote, string][] = [];
    const off = onLiveNote((n, phase) => seen.push([n, phase]));
    handleMidiMessage('dev', [0x90, 52, 100]);
    handleMidiMessage('dev', [0x80, 52, 0]);
    off();
    expect(seen.map(([n, p]) => [n.degree, p])).toEqual([
      [2, 'on'],
      [2, 'off'],
    ]);
    expect(seen[0]![0].velocity).toBeCloseTo(100 / 127);
  });

  it('drum pads from note 36 play each drum in "Show all drums"', () => {
    const a = createSampleTrack();
    const b = createSampleTrack();
    useSongStore.getState().loadSong(createSong({ tracks: [a, b] }));
    useUiStore.setState({ selectedTrackId: a.id, drumView: true });
    expect(midiTarget(37)).toEqual({ trackId: b.id });
    expect(midiTarget(40)).toBeNull();
  });
});

describe('recording', () => {
  const p = createPattern({ lengthBars: 1 });

  it('places notes on the nearest step, wrapping the loop', () => {
    expect(placeNote({ startBeat: 8.24, endBeat: 8.76 }, p, 8, 'step')).toEqual({
      start: 1,
      length: 2,
    });
    expect(placeNote({ startBeat: 11.97, endBeat: 12.2 }, p, 8, 'step')).toEqual({
      start: 0,
      length: 1,
    });
    expect(placeNote({ startBeat: 9.4, endBeat: 9.5 }, p, 8, 'beat')).toEqual({
      start: 4,
      length: 1,
    });
    expect(placeNote({ startBeat: 9.3, endBeat: 9.3 }, p, 8, 'eighth')).toEqual({
      start: 6,
      length: 1,
    });
    expect(placeNote({ startBeat: null, endBeat: 2 }, p, 0, 'step')).toBeNull();
  });

  it('a note held past the end of the loop is cut there', () => {
    expect(placeNote({ startBeat: 3, endBeat: 0.5 }, p, 0, 'step')).toEqual({
      start: 12,
      length: 4,
    });
  });
});
