import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { createSampleTrack, createSong } from '@/model/factories';
import { EffectsTab } from './EffectsTab';

vi.mock('tone', () => ({}));

const track = () => useSongStore.getState().song.tracks[0]!;

describe('EffectsTab', () => {
  it('adds, toggles and removes effects', () => {
    useSongStore.getState().loadSong(createSong({ tracks: [createSampleTrack()] }));
    const r = render(<EffectsTab track={track()} />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Add effect' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Reverb/ }));
    r.rerender(<EffectsTab track={track()} />);
    expect(track().fx.map((f) => f.type)).toEqual(['reverb']);
    expect(track().fx[0]!.params.size).toBe(0.5);
    fireEvent.click(screen.getByRole('switch', { name: 'Reverb on/off' }));
    expect(track().fx[0]!.enabled).toBe(false);
    r.rerender(<EffectsTab track={track()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Reverb' }));
    expect(track().fx).toEqual([]);
  });
  it('disables adding beyond 6 effects', () => {
    useSongStore.getState().loadSong(createSong({ tracks: [createSampleTrack()] }));
    for (let i = 0; i < 6; i++) useSongStore.getState().addFx(track().id, 'eq');
    render(<EffectsTab track={track()} />);
    expect(screen.getByRole('button', { name: '＋ Add effect' })).toBeDisabled();
  });
});
