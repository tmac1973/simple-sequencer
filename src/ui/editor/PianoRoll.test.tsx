import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { createSong, createSynthTrack } from '@/model/factories';
import { PianoRoll } from './PianoRoll';

vi.mock('@/audio/engine', () => ({ engine: { auditionNote: vi.fn() } }));

const rect = {
  left: 0,
  top: 0,
  width: 640,
  height: 270,
  right: 640,
  bottom: 270,
  x: 0,
  y: 0,
  toJSON: () => {},
};

function setup() {
  useSongStore.getState().loadSong(createSong({ tracks: [createSynthTrack()] }));
  const view = () => {
    const t = useSongStore.getState().song.tracks[0]!;
    return <PianoRoll track={t} pattern={t.patterns[0]!} />;
  };
  const r = render(view());
  const grid = () => screen.getByLabelText('Piano roll grid');
  grid().getBoundingClientRect = () => rect;
  return {
    rerender: () => r.rerender(view()),
    grid,
    notes: () => useSongStore.getState().song.tracks[0]!.patterns[0]!.notes,
  };
}

describe('PianoRoll', () => {
  beforeAll(() => {
    HTMLElement.prototype.setPointerCapture = () => {};
  });
  beforeEach(() => useUiStore.getState().setChordStamp('off'));

  it('click adds a 2-step note at the clicked step and degree', () => {
    const { grid, notes } = setup();
    // 16 steps over 640px = 40px per step; 15 rows, top row = degree 14
    fireEvent.pointerDown(grid(), { button: 0, clientX: 85, clientY: 18 * 14 + 5 });
    expect(notes()).toEqual([{ start: 2, length: 2, degree: 0, velocity: 0.8 }]);
  });

  it('chord stamp adds a triad', () => {
    useUiStore.getState().setChordStamp('triad');
    const { grid, notes } = setup();
    fireEvent.pointerDown(grid(), { button: 0, clientX: 5, clientY: 18 * 14 + 5 });
    expect(notes().map((n) => n.degree)).toEqual([0, 2, 4]);
  });

  it('drag moves, edge drag resizes, right-click deletes', () => {
    const { grid, notes, rerender } = setup();
    fireEvent.pointerDown(grid(), { button: 0, clientX: 5, clientY: 18 * 14 + 5 });
    rerender();
    screen.getByLabelText('Piano roll grid').getBoundingClientRect = () => rect;
    const note = screen.getByRole('button', { name: /^Note/ });
    fireEvent.pointerDown(note, { button: 0, clientX: 10, clientY: 260, pointerId: 1 });
    fireEvent.pointerMove(note, { clientX: 130, clientY: 224, pointerId: 1 });
    fireEvent.pointerUp(note, { pointerId: 1 });
    expect(notes()[0]).toMatchObject({ start: 3, degree: 2 });
    rerender();
    screen.getByLabelText('Piano roll grid').getBoundingClientRect = () => rect;
    const edge = screen.getByRole('button', { name: /^Note/ }).querySelector('[data-edge]')!;
    fireEvent.pointerDown(edge, { button: 0, clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(edge, { clientX: 280, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(edge, { pointerId: 1 });
    expect(notes()[0]!.length).toBe(4);
    rerender();
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Note/ }));
    expect(notes()).toEqual([]);
  });
});
