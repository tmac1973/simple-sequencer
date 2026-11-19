import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { createSampleTrack, createSong } from '@/model/factories';
import { StepEditor } from './StepPads';

function setup() {
  const t = createSampleTrack();
  useSongStore.getState().loadSong(createSong({ tracks: [t] }));
  const view = () => {
    const track = useSongStore.getState().song.tracks[0]!;
    return <StepEditor track={track} pattern={track.patterns[0]!} />;
  };
  const r = render(view());
  return { rerender: () => r.rerender(view()), t };
}

describe('StepEditor', () => {
  beforeAll(() => {
    HTMLElement.prototype.setPointerCapture = () => {};
  });
  it('click toggles a step', () => {
    const { rerender } = setup();
    const pad = screen.getByRole('button', { name: 'Step 5 off' });
    fireEvent.pointerDown(pad, { button: 0, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(useSongStore.getState().song.tracks[0]!.patterns[0]!.steps).toEqual([
      { index: 4, velocity: 0.8 },
    ]);
    rerender();
    expect(screen.getByRole('button', { name: 'Step 5 on, 80%' })).toBeInTheDocument();
  });
  it('vertical drag on an active pad sets velocity in one undo step', () => {
    const { rerender } = setup();
    const s = useSongStore.getState();
    const pid = s.song.tracks[0]!.patterns[0]!.id;
    s.toggleStep(s.song.tracks[0]!.id, pid, 0);
    rerender();
    const before = useSongStore.getState().past.length;
    const pad = screen.getByRole('button', { name: /Step 1 on/ });
    fireEvent.pointerDown(pad, { button: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientY: 140, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    const st = useSongStore.getState();
    expect(st.song.tracks[0]!.patterns[0]!.steps[0]!.velocity).toBeCloseTo(0.3);
    expect(st.past.length).toBe(before + 1);
  });
});
