import { create } from 'zustand';
import type { Song } from '@/model/types';

export type InspectorTab = 'sound' | 'fx' | 'automate';
export type PlayMode = 'pattern' | 'song';
export type ModalId =
  | null
  | 'newSong'
  | 'browser'
  | 'sampleEditor'
  | 'export'
  | 'credits'
  | 'shortcuts'
  | 'ideas'
  | 'share'
  | 'openShared';
export type ChordStamp = 'off' | 'triad' | 'seventh';

/** A section of the song to loop in Song mode (0-based bars). */
export interface SongLoop {
  startBar: number;
  lengthBars: number;
}

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
  /** a song from a share link, waiting for the user to open it */
  sharedSong: Song | null;
  /** the looped section in Song mode (kept while switched off), or null */
  songLoop: SongLoop | null;
  loopOn: boolean;
  /** letter keys play the selected track */
  keysOn: boolean;
  /** what dragging a step (or a note's bar) changes */
  dragSets: 'loudness' | 'chance';

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
  setSharedSong(song: Song | null): void;
  /** Set (or with null, clear) the Song-mode loop. Setting one turns it on. */
  setSongLoop(loop: SongLoop | null): void;
  setLoopOn(on: boolean): void;
  setKeysOn(on: boolean): void;
  setDragSets(v: 'loudness' | 'chance'): void;
  /** Keep the loop on the same music when bars are inserted (count > 0) or deleted (< 0) at `at`. */
  shiftSongLoop(at: number, count: number): void;
}

/** Move a loop along with inserted (count > 0) or deleted (count < 0) bars at `at`. */
export function shiftLoop(l: SongLoop, at: number, count: number): SongLoop | null {
  const end = l.startBar + l.lengthBars;
  if (count > 0) {
    if (at <= l.startBar) return { ...l, startBar: l.startBar + count };
    if (at < end) return { ...l, lengthBars: l.lengthBars + count };
    return l;
  }
  const d0 = at;
  const d1 = at - count;
  const keep = (a: number, b: number) => Math.max(0, Math.min(b, end) - Math.max(a, l.startBar));
  const before = keep(0, d0);
  const after = keep(d1, Infinity);
  const len = before + after;
  if (len < 1) return null;
  const startBar = l.startBar < d0 ? l.startBar : Math.max(d0, l.startBar + count);
  return { startBar, lengthBars: len };
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
  sharedSong: null,
  songLoop: null,
  loopOn: false,
  keysOn: true,
  dragSets: 'loudness',

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
  setSharedSong: (sharedSong) => set({ sharedSong }),
  setSongLoop: (songLoop) =>
    set(
      songLoop
        ? {
            songLoop: {
              startBar: Math.max(0, Math.floor(songLoop.startBar)),
              lengthBars: Math.max(1, Math.floor(songLoop.lengthBars)),
            },
            loopOn: true,
          }
        : { songLoop: null, loopOn: false },
    ),
  setLoopOn: (loopOn) => set((s) => ({ loopOn: loopOn && !!s.songLoop })),
  setKeysOn: (keysOn) => set({ keysOn }),
  setDragSets: (dragSets) => set({ dragSets }),
  shiftSongLoop: (at, count) =>
    set((s) => {
      if (!s.songLoop) return {};
      const songLoop = shiftLoop(s.songLoop, at, count);
      return songLoop ? { songLoop } : { songLoop: null, loopOn: false };
    }),
}));
