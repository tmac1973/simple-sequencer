import { useSongStore } from './songStore';
import { createSong } from '@/model/factories';
import { HISTORY_LIMIT } from './history';
import { MAX_TRACKS } from '@/model/constants';

const s = () => useSongStore.getState();

beforeEach(() => s().loadSong(createSong()));

function setupTrack() {
  const id = s().addTrack('sample')!;
  const t = s().song.tracks.find((x) => x.id === id)!;
  return { id, pid: t.patterns[0]!.id };
}

describe('song store', () => {
  it('toggles steps and undoes/redoes', () => {
    const { id, pid } = setupTrack();
    s().toggleStep(id, pid, 4);
    expect(s().song.tracks[0]!.patterns[0]!.steps).toEqual([{ index: 4, velocity: 0.8 }]);
    s().undo();
    expect(s().song.tracks[0]!.patterns[0]!.steps).toEqual([]);
    s().redo();
    expect(s().song.tracks[0]!.patterns[0]!.steps).toHaveLength(1);
  });

  it('coalesces a gesture into one undo step', () => {
    const { id } = setupTrack();
    const before = s().past.length;
    for (let i = 0; i < 10; i++) s().setVolume(id, -i, 'drag-1');
    expect(s().past.length).toBe(before + 1);
    s().undo();
    expect(s().song.tracks[0]!.volumeDb).toBe(0);
  });

  it('caps history at the limit', () => {
    const { id, pid } = setupTrack();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s().toggleStep(id, pid, i % 16);
    expect(s().past.length).toBe(HISTORY_LIMIT);
  });

  it('paintBlock replaces overlapped blocks and auto-extends the song', () => {
    const { id, pid } = setupTrack();
    s().setPatternLength(id, pid, 4);
    s().paintBlock(id, pid, 0);
    s().paintBlock(id, pid, 2);
    expect(s().song.tracks[0]!.blocks.map((b) => b.startBar)).toEqual([0, 2]);
    s().paintBlock(id, pid, 0);
    expect(s().song.tracks[0]!.blocks.map((b) => b.startBar)).toEqual([0, 2]);
    s().paintBlock(id, pid, 14);
    expect(s().song.lengthBars).toBe(18);
    s().removeBlockAt(id, 3);
    expect(s().song.tracks[0]!.blocks.map((b) => b.startBar)).toEqual([0, 14]);
  });

  it('converts grids between 16ths and triplets', () => {
    const { id, pid } = setupTrack();
    s().toggleStep(id, pid, 4);
    s().toggleStep(id, pid, 8);
    s().setPatternGrid(id, pid, 24);
    expect(s().song.tracks[0]!.patterns[0]!.steps.map((x) => x.index)).toEqual([6, 12]);
    s().setPatternGrid(id, pid, 16);
    expect(s().song.tracks[0]!.patterns[0]!.steps.map((x) => x.index)).toEqual([4, 8]);
  });

  it('shortening a pattern drops out-of-range steps and notes', () => {
    const { id, pid } = setupTrack();
    s().setPatternLength(id, pid, 2);
    s().toggleStep(id, pid, 20);
    s().addNote(id, pid, { start: 10, length: 10, degree: 0, velocity: 1 });
    s().setPatternLength(id, pid, 1);
    const p = s().song.tracks[0]!.patterns[0]!;
    expect(p.steps).toEqual([]);
    expect(p.notes[0]!.length).toBe(6);
  });

  it('refuses tracks beyond the limit, including duplicates', () => {
    for (let i = 0; i < MAX_TRACKS; i++) expect(s().addTrack('synth')).not.toBeNull();
    expect(s().addTrack('sample')).toBeNull();
    expect(s().duplicateTrack(s().song.tracks[0]!.id)).toBeNull();
  });

  it('removing an effect removes its automation lanes', () => {
    const { id } = setupTrack();
    const fx = s().addFx(id, 'filter')!;
    s().addLane(id, { kind: 'fx', fxId: fx, param: 'cutoff' });
    s().addLane(id, { kind: 'track', param: 'volume' });
    s().removeFx(id, fx);
    expect(s().song.tracks[0]!.automation.map((l) => l.target.kind)).toEqual(['track']);
  });

  it('every action round-trips through undo', () => {
    const { id, pid } = setupTrack();
    const start = JSON.stringify(s().song);
    const base = s().past.length;
    s().setName('X');
    s().setBpm(120);
    s().setSwing(0.3);
    s().setKey({ root: 5, scale: 'major' });
    s().renameTrack(id, 'Kick');
    s().setPan(id, 0.5);
    s().toggleMute(id);
    s().toggleSolo(id);
    const p2 = s().addPattern(id, pid)!;
    s().paintBlock(id, p2, 3);
    s().addNote(id, pid, { start: 0, length: 2, degree: 3, velocity: 0.7 });
    s().moveNote(id, pid, 0, 4, 5);
    s().resizeNote(id, pid, 0, 6);
    s().setNoteVelocity(id, pid, 0, 0.3);
    s().setSampleEdit(id, { reverse: true });
    s().addFx(id, 'reverb');
    s().duplicateTrack(id);
    s().removeTrack(id);
    while (s().past.length > base) s().undo();
    const t = JSON.parse(JSON.stringify(s().song));
    const original = JSON.parse(start);
    expect(t).toEqual({ ...original });
  });

  it('loadSong clears history', () => {
    setupTrack();
    s().loadSong(createSong());
    expect(s().past).toHaveLength(0);
  });
});
