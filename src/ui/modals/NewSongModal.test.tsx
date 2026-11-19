import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { createSong } from '@/model/factories';
import { NewSongModal } from './NewSongModal';

vi.mock('@/audio/engine', () => ({ engine: { stop: vi.fn() } }));

describe('NewSongModal', () => {
  it('creates the chosen template', async () => {
    useSongStore.getState().loadSong(createSong());
    const onClose = vi.fn();
    render(<NewSongModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: /House/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(useSongStore.getState().song.name).toBe('House Groove'));
    expect(onClose).toHaveBeenCalled();
  });
  it('lists saved songs and offers to open a song file', async () => {
    render(<NewSongModal onClose={() => {}} />);
    expect(screen.getByText(/Your songs/)).toBeInTheDocument();
    expect(screen.getByLabelText('Open song file')).toBeInTheDocument();
  });
});
