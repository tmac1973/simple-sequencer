import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders the five layout regions', () => {
    render(<App />);
    for (const label of ['Top bar', 'Tracks', 'Song timeline', 'Pattern editor', 'Inspector']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
