# Phase 02 — Song data model, store and undo/redo

**Depends on:** 01 · **Enables:** 03 (engine reads the song), 04+ (all UI edits the song), 11 (persistence serializes it)

## Goal
Define the complete, serializable song data model up front: tracks, patterns, blocks, notes, sample settings, synth settings, effect slots and automation lanes. Later phases then only add behavior, never reshape data. Implement a Zustand + Immer store with patch-based undo/redo, a separate UI-state store, pure helper functions (scale math, timing), and schema validation. Pure logic, fully unit-tested, no UI.

## Files touched
- `src/model/types.ts`: all model types (below).
- `src/model/constants.ts`: limits and defaults.
- `src/model/factories.ts`: `createSong()`, `createSampleTrack()`, `createSynthTrack()`, `createPattern()`, `nextPatternName()`, `createFxSlot(type)`, `createLane(target)`.
- `src/model/scale.ts`: scale tables and `degreeToMidi(degree, key)`.
- `src/model/timing.ts`: bar/step/beat conversions and swing offset.
- `src/model/mixing.ts`: `sliderToDb(p)` = `p === 0 ? -Infinity : 20·log10(p²) + 6` (p = 1 → +6 dB, p ≈ 0.708 → 0 dB, p = 0.5 → −6 dB), `dbToSlider(db)` as its inverse, and `DEFAULT_VOLUME_DB = 0`. Used by the volume slider (phase 04) and volume automation (phase 09).
- `src/model/schema.ts`: `validateSong(unknown): Song` (throws `SongFormatError` with a readable message) and `migrateSong(raw)` (version switch; v1 is identity).
- `src/store/songStore.ts`: Zustand store with Immer; all song mutations as named actions.
- `src/store/history.ts`: patch-based undo/redo stack.
- `src/store/uiStore.ts`: non-undoable UI state.
- `src/model/*.test.ts`, `src/store/*.test.ts`: unit tests.
- `package.json`: add `zustand`, `immer`, `nanoid`.

## Steps
1. **Types** (`types.ts`):
   - `Song { format: 'simple-sequencer-song'; version: 1; id; name; bpm (40–220); swing (0–0.75); key: { root: 0–11; scale: ScaleName }; lengthBars (1–128); tracks: Track[]; createdAt; updatedAt }`.
   - `ScaleName = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'harmonicMinor' | 'majorPentatonic' | 'minorPentatonic'`.
   - `Track { id; name; color; kind: 'sample' | 'synth'; volumeDb (-60–+6); pan (-1–1); mute; solo; patterns: Pattern[]; blocks: Block[]; fx: FxSlot[]; automation: AutomationLane[]; sample?: SampleTrackSettings; synth?: SynthTrackSettings }`.
   - **Bar indexing:** bars are **0-based in the model** (`startBar`, lane `bar`, loop regions) and shown **1-based in the UI** (the ruler shows "1" for bar 0). Plan documents that describe musical content (e.g. templates) use the 1-based display numbers.
   - `SampleTrackSettings { sampleId: string; melodic: boolean; rootMidi: number (MIDI note of the sample's recorded pitch, default 60); edit: SampleEdit; tone: 0–1; }`. Here `SampleEdit { start: 0–1; end: 0–1; reverse; loop; loopStart: 0–1; tuneSemitones: -24–24; fadeOut: 0–1; normalize: boolean }`. **Tune = the inspector's Pitch knob, and fadeOut = the inspector's Decay knob** (one field, shown in two places).
   - `SynthTrackSettings { presetId: string; macros: { tone; punch; space; length } (0–1 each); advanced: Partial<SynthAdvanced> }`. `SynthAdvanced { oscType: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'fmsine' | 'fatsawtooth'; attack; decay; sustain; release; filterCutoffHz; filterQ; filterEnvAmount; vibratoRate; vibratoDepth; glide }`.
   - `Pattern { id; name ('A'…'Z'); lengthBars: 1 | 2 | 3 | 4; stepsPerBar: 16 | 24; steps: Step[]; notes: Note[] }`, `Step { index; velocity: 0.1–1 }`, `Note { start (step index); length (steps ≥ 1); degree (integer scale degree; 0 = key root in octave 3, negative and >7 allowed); velocity }`. Sample tracks with `melodic: false` use `steps`; synth tracks and melodic sample tracks use `notes`. 24 steps per bar = 16th-note triplets.
   - `Block { id; patternId; startBar }`. Its length is its pattern's `lengthBars`.
   - `FxType = 'reverb' | 'delay' | 'filter' | 'distortion' | 'compressor' | 'eq' | 'chorus' | 'bitcrush'`; `FxSlot { id; type; enabled; params: Record<string, number> }` (all values normalized 0–1).
   - Only Tone and Space are automatable synth macros. Punch and Length set envelope times, which aren't continuous audio parameters, so they're static knobs.
   - `AutomationTarget = { kind: 'track'; param: 'volume' | 'pan' } | { kind: 'synthMacro'; macro: 'tone' | 'space' } | { kind: 'sampleTone' } | { kind: 'fx'; fxId: string; param: string }`; `AutomationLane { id; target; points: { bar: number (fractional, 0 ≤ bar ≤ lengthBars); value: 0–1 }[]; visible: boolean }`.
2. **Constants**: `MAX_TRACKS = 16`, `MAX_PATTERNS_PER_TRACK = 26`, `MAX_SONG_BARS = 128`, `DEFAULT_SONG_BARS = 16`, `DEFAULT_BPM = 90`, `MAX_FX_PER_TRACK = 6`.
3. **Scale math**: interval tables per scale; `degreeToMidi(degree, key)` = `48 + root + octave*12 + intervals[degree mod n]`, where octave = `floor(degree / n)`. Changing key or scale re-maps every note automatically, so notes stay in key by construction.
4. **Timing**: `stepDurationBeats(stepsPerBar)` (4/16 or 4/24 beats); `swingOffsetBeats(stepIndex, stepsPerBar, swing)`: for 16-step patterns, odd steps are delayed by `swing × (1/4 beat) × 0.5`; triplet patterns are never swung. Also `barBeatToSeconds`, and `blockAt(track, bar)`, which returns the block and its pattern covering a bar.
5. **Store** (`songStore.ts`): state `{ song }`. Actions are each one undoable transaction: `setName`, `setBpm`, `setSwing`, `setKey`, `setLength`, `addTrack(kind)` (no-op returning `false` at `MAX_TRACKS`), `duplicateTrack` (deep copy with new ids, inserted below; same limit), `removeTrack`, `moveTrack`, `renameTrack`, `setTrackColor`, `setVolume`, `setPan`, `toggleMute`, `toggleSolo`, `addPattern(trackId, copyFrom?)`, `removePattern`, `setPatternLength`, `setPatternGrid` (converting 16↔24 rescales step indices proportionally and drops collisions), `toggleStep`, `setStepVelocity`, `addNote`, `moveNote`, `resizeNote`, `setNoteVelocity`, `removeNote`, `clearPattern`, `paintBlock(trackId, patternId, bar)` (replaces any overlapped blocks and auto-extends `lengthBars` if painted past the end, up to 128), `removeBlock`, `setSampleSettings`, `setSynthSettings`, `addFx`, `removeFx`, `moveFx`, `setFxParam`, `toggleFx`, `addLane`, `removeLane`, `setLanePoints`, `loadSong(song)` (clears history).
6. **History** (`history.ts`): wrap actions with Immer `produceWithPatches`, and push `{patches, inversePatches, label}` with `undo()`/`redo()`, capped at 200 entries. **Coalescing:** continuous gestures (knob drags, velocity drags, slider moves) pass a `gestureId`, and consecutive entries with the same id merge into one undo step.
7. **UI store** (`uiStore.ts`, not undoable): `selectedTrackId`, `selectedPatternId` per track, `inspectorTab: 'sound' | 'fx' | 'automate'`, `playMode: 'pattern' | 'song'`, `drumView: boolean`, `tipsEnabled: boolean`, `openModal: null | 'newSong' | 'browser' | 'sampleEditor' | 'export' | 'credits' | 'shortcuts'`, `chordStamp: 'off' | 'triad' | 'seventh'`, `songStartBar: number` (0-based; where Song mode starts playing, set by clicking the ruler, default 0).
8. **Schema**: `validateSong` checks every field's type and range (hand-written guards, no dependency), and re-links or removes blocks pointing to missing patterns.
9. **Tests**: `sliderToDb`/`dbToSlider` round trip; `addTrack`/`duplicateTrack` refuse at 16 tracks; scale mapping across all scales and negative degrees; key change preserves degrees; swing offsets; grid conversion; `paintBlock` overlap replacement and auto-extend; undo/redo round trip for every action; gesture coalescing; `validateSong` rejects bad input and accepts factory output; the 200-entry history cap.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build`

## Test plan
All unit tests above pass. There's no UI or audio in this phase.

## Commit
`feat(model): song data model, zustand store with patch-based undo/redo`

## Rollback
Revert the commit. Only new files plus three dependencies, and no existing code imports them yet.
