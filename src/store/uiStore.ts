import { create } from 'zustand';

export type InspectorTab = 'sound' | 'fx' | 'automate';
export type PlayMode = 'pattern' | 'song';
export type ModalId =
  null | 'newSong' | 'browser' | 'sampleEditor' | 'export' | 'credits' | 'shortcuts';
export type ChordStamp = 'off' | 'triad' | 'seventh';

export interface UiState {
  selectedTrackId: string | null;
  /** trackId → selected patternId */
  selectedPatternId: Record<string, string>;
  inspectorTab: InspectorTab;
  playMode: PlayMode;
  drumView: boolean;
  tipsEnabled: boolean;
  openModal: ModalId;
  chordStamp: ChordStamp;
  /** 0-based bar where Song mode starts playing */
  songStartBar: number;
  playing: boolean;

  selectTrack(id: string | null): void;
  selectPattern(trackId: string, patternId: string): void;
  setInspectorTab(tab: InspectorTab): void;
  setPlayMode(mode: PlayMode): void;
  setDrumView(on: boolean): void;
  setTipsEnabled(on: boolean): void;
  openModalId(id: ModalId): void;
  setChordStamp(c: ChordStamp): void;
  setSongStartBar(bar: number): void;
  setPlaying(p: boolean): void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTrackId: null,
  selectedPatternId: {},
  inspectorTab: 'sound',
  playMode: 'pattern',
  drumView: false,
  tipsEnabled: true,
  openModal: null,
  chordStamp: 'off',
  songStartBar: 0,
  playing: false,

  selectTrack: (id) => set({ selectedTrackId: id }),
  selectPattern: (trackId, patternId) =>
    set((s) => ({ selectedPatternId: { ...s.selectedPatternId, [trackId]: patternId } })),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setPlayMode: (playMode) => set({ playMode }),
  setDrumView: (drumView) => set({ drumView }),
  setTipsEnabled: (tipsEnabled) => set({ tipsEnabled }),
  openModalId: (openModal) => set({ openModal }),
  setChordStamp: (chordStamp) => set({ chordStamp }),
  setSongStartBar: (songStartBar) => set({ songStartBar: Math.max(0, Math.floor(songStartBar)) }),
  setPlaying: (playing) => set({ playing }),
}));
