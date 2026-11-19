import { render, screen, waitFor } from '@testing-library/react';
import { setManifest, type LibraryManifest } from '@/library/manifest';
import { CreditsModal } from './CreditsModal';

import manifestJson from '../../../public/samples/manifest.json';

const m = manifestJson as unknown as LibraryManifest;

describe('CreditsModal', () => {
  it('credits every CC-BY sound with its author and license', async () => {
    setManifest(m);
    render(<CreditsModal onClose={() => {}} />);
    const by = m.samples.filter((s) => s.license !== 'CC0-1.0');
    expect(by.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText(/by Alexander Holm/).length).toBeGreaterThan(0));
    for (const s of by) expect(screen.getByText(new RegExp(s.name))).toBeInTheDocument();
    expect(screen.getAllByText('CC BY 3.0').length).toBeGreaterThan(0);
  });
});
