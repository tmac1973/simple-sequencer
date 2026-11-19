import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { createSampleTrack, createSong } from '@/model/factories';
import { SampleEditorModal } from './SampleEditorModal';

vi.mock('@/audio/engine', () => ({ engine: { preview: vi.fn(), stopPreview: vi.fn() } }));

describe('SampleEditorModal', () => {
  beforeAll(() => {
    HTMLElement.prototype.setPointerCapture = () => {};
  });
  it('drags the start handle, toggles reverse and loop', () => {
    const t = createSampleTrack({ name: 'Kick' });
    useSongStore.getState().loadSong(createSong({ tracks: [t] }));
    useUiStore.getState().selectTrack(t.id);
    render(<SampleEditorModal onClose={() => {}} />);
    const wave = screen.getByLabelText('Waveform');
    wave.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 170,
      right: 800,
      bottom: 170,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const start = screen.getByRole('slider', { name: 'Start' });
    fireEvent.pointerDown(start, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(start, { pointerId: 1, clientX: 80 });
    fireEvent.pointerUp(start, { pointerId: 1 });
    const edit = () => useSongStore.getState().song.tracks[0]!.sample!.edit;
    expect(edit().start).toBeCloseTo(0.1);
    fireEvent.click(screen.getByRole('switch', { name: 'Reverse' }));
    expect(edit().reverse).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Loop' }));
    expect(edit().loop).toBe(true);
  });
});
