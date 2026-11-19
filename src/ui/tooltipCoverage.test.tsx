import 'fake-indexeddb/auto';
import { act, render } from '@testing-library/react';
import { useSongStore } from '@/store/songStore';
import { useUiStore, type ModalId } from '@/store/uiStore';
import { buildLofi } from '@/templates/lofi';
import { AppShell } from './layout/AppShell';
import { resolveTip } from './tooltips';

vi.mock('@/audio/engine', () => ({
  engine: {
    stop: vi.fn(),
    play: vi.fn(),
    preview: vi.fn(),
    stopPreview: vi.fn(),
    previewSong: vi.fn(() => Promise.resolve()),
    stopSongPreview: vi.fn(),
    auditionNote: vi.fn(),
    position: () => null,
    onParamValue: () => null,
  },
  GraphSet: class {},
}));

const INTERACTIVE =
  'button, input:not([type=hidden]):not([hidden]), select, [role=slider], [role=switch], [role=radio], [role=tab]';
/** Plain dialog chrome that doesn't need an explanation. */
const ALLOW = (el: Element) => {
  const label = el.getAttribute('aria-label') ?? '';
  const text = el.textContent?.trim() ?? '';
  return (
    ['Close', 'Dismiss'].includes(label) ||
    ['Cancel', 'Close', 'Done', 'Create'].includes(text) ||
    el.hasAttribute('hidden') ||
    el.closest('[hidden]') !== null
  );
};

function missing(root: ParentNode): string[] {
  const out: string[] = [];
  root.querySelectorAll(INTERACTIVE).forEach((el) => {
    if (ALLOW(el)) return;
    const holder = el.closest('[data-tip]');
    const tip = holder?.getAttribute('data-tip');
    if (tip && resolveTip(tip)?.body) return;
    if (el.getAttribute('aria-describedby')) return;
    out.push(
      `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}"${tip ? ` (tip "${tip}" has no text)` : ''}`,
    );
  });
  return out;
}

describe('every control has a plain-English tooltip', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(buildLofi());
    useUiStore.setState({ openModal: null, inspectorTab: 'sound', drumView: false });
  });

  it.each(['sound', 'fx', 'automate'] as const)('workspace with the %s tab', async (tab) => {
    for (const trackIndex of [0, 4]) {
      useUiStore.setState({
        inspectorTab: tab,
        selectedTrackId: useSongStore.getState().song.tracks[trackIndex]!.id,
      });
      const r = render(<AppShell />);
      await act(async () => {});
      expect(missing(document)).toEqual([]);
      r.unmount();
    }
  });

  it.each([
    'newSong',
    'browser',
    'sampleEditor',
    'export',
    'credits',
    'shortcuts',
    'ideas',
    'share',
  ] as ModalId[])('modal %s', async (m) => {
    useUiStore.setState({
      openModal: m,
      selectedTrackId: useSongStore.getState().song.tracks[0]!.id,
    });
    render(<AppShell />);
    await act(async () => {});
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog).not.toBeNull();
    expect(missing(dialog)).toEqual([]);
  });
});
