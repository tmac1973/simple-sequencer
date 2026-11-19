import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { createSampleTrack, createSong } from '@/model/factories';
import { Timeline, blockSpans } from './Timeline';

describe('Timeline', () => {
  beforeAll(() => {
    HTMLElement.prototype.setPointerCapture = () => {};
  });
  it('paints by drag (one undo step) and erases a block on click', () => {
    const t = createSampleTrack({ name: 'Kick' });
    useSongStore.getState().loadSong(createSong({ tracks: [t] }));
    render(<Timeline />);
    const row = screen.getByLabelText('Kick timeline');
    row.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1024,
      bottom: 46,
      width: 1024,
      height: 46,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    fireEvent.pointerDown(row, { button: 0, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 70, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 140, pointerId: 1 });
    fireEvent.pointerUp(row, { pointerId: 1 });
    const s = useSongStore.getState();
    expect(s.song.tracks[0]!.blocks.map((b) => b.startBar)).toEqual([0, 1, 2]);
    expect(s.past.length).toBe(1);
    fireEvent.pointerDown(row, { button: 0, clientX: 70, pointerId: 1 });
    fireEvent.pointerUp(row, { pointerId: 1 });
    expect(useSongStore.getState().song.tracks[0]!.blocks.map((b) => b.startBar)).toEqual([0, 2]);
  });
  it('joins adjacent spans of the same pattern', () => {
    const t = createSampleTrack();
    const pid = t.patterns[0]!.id;
    t.blocks = [0, 1, 3].map((b) => ({ id: String(b), patternId: pid, startBar: b }));
    const spans = blockSpans(t);
    expect(spans.map((s) => [s.joinL, s.joinR])).toEqual([
      [false, true],
      [true, false],
      [false, false],
    ]);
  });
});
