import { fireEvent, render, screen } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { createSong } from '@/model/factories';
import { NewSongModal } from './NewSongModal';

vi.mock('@/audio/engine', () => ({ engine: { stop: vi.fn() } }));

describe('NewSongModal', () => {
  it('creates the chosen template', () => {
    useSongStore.getState().loadSong(createSong());
    const onClose = vi.fn();
    render(<NewSongModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: /House/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(useSongStore.getState().song.name).toBe('House Groove');
    expect(onClose).toHaveBeenCalled();
  });
  it('asks before replacing an edited song', () => {
    useSongStore.getState().loadSong(createSong());
    useSongStore.getState().setName('Mine');
    render(<NewSongModal onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText(/Replace the current song/)).toBeInTheDocument();
    expect(useSongStore.getState().song.name).toBe('Mine');
    fireEvent.click(screen.getByRole('button', { name: 'Replace and create' }));
    expect(useSongStore.getState().song.name).toBe('Lo-fi Beat');
  });
});
