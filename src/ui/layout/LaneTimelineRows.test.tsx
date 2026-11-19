import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { createLane, createSampleTrack, createSong } from '@/model/factories';
import { LaneTimelineRows } from './LaneTimelineRows';

vi.mock('tone', () => ({}));

const rect = {
  left: 0,
  top: 0,
  width: 1024,
  height: 64,
  right: 1024,
  bottom: 64,
  x: 0,
  y: 0,
  toJSON: () => {},
};

describe('automation lane', () => {
  beforeAll(() => {
    Element.prototype.setPointerCapture = () => {};
  });
  it('adds a snapped point on click, drags it, deletes on double-click', () => {
    const t = createSampleTrack({ name: 'Kick' });
    t.automation = [createLane({ kind: 'track', param: 'volume' }, [])];
    useSongStore.getState().loadSong(createSong({ tracks: [t] }));
    const view = () => (
      <LaneTimelineRows track={useSongStore.getState().song.tracks[0]!} bars={16} />
    );
    const r = render(view());
    const svg = () => screen.getByLabelText('Kick Volume automation').querySelector('svg')!;
    svg().getBoundingClientRect = () => rect;
    fireEvent.pointerDown(svg(), { button: 0, clientX: 64 * 2 + 10, clientY: 32, pointerId: 1 });
    fireEvent.pointerUp(svg(), { pointerId: 1 });
    const pts = () => useSongStore.getState().song.tracks[0]!.automation[0]!.points;
    expect(pts()).toHaveLength(1);
    expect(pts()[0]!.bar).toBe(2.25);
    expect(pts()[0]!.value).toBeCloseTo(0.5, 1);
    r.rerender(view());
    svg().getBoundingClientRect = () => rect;
    const dot = screen.getByRole('button', { name: /Point at bar 3.25/ });
    fireEvent.pointerDown(dot, { button: 0, clientX: 154, clientY: 32, pointerId: 1 });
    fireEvent.pointerMove(dot, { clientX: 64 * 4, clientY: 6, pointerId: 1 });
    fireEvent.pointerUp(dot, { pointerId: 1 });
    expect(pts()[0]!.bar).toBe(4);
    expect(pts()[0]!.value).toBeCloseTo(1, 1);
    r.rerender(view());
    fireEvent.doubleClick(screen.getByRole('button', { name: /Point at bar/ }));
    expect(pts()).toHaveLength(0);
  });
});
