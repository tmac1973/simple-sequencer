# Phase 04 — Workspace UI: top bar, tracks, timeline, step editor, drum view

**Depends on:** 01, 02, 03 · **Enables:** 05 (piano roll slots into the editor panel), 06–10 (sound/effects/automation inspector tabs, modals), 13 (UX polish)

## Goal
Make the approved mock real for sample/drum tracks. That covers the full top bar, the track list with mixer controls, the song timeline with pattern-block painting and a playhead, the step editor with velocity, pattern length and grid, the "Show all drums" combined view, the inspector frame with tabs, the reusable Knob, Tooltip and Modal components, and keyboard shortcuts. At the end you can build and play a full drum arrangement using the dev sounds.

## Files touched
- `src/ui/components/Knob.tsx` (+ css): SVG arc knob as in the mock. Vertical drag changes the value (150 px = full range; Shift for fine control); double-click resets to default; arrow keys when focused; `role="slider"` with `aria-valuenow`/`aria-label`. Props: `label`, `value`, `defaultValue`, `format(v)`, `color`, `onChange(v, gestureId)`.
- `src/ui/components/Tooltip.tsx` + `src/ui/tooltips.ts`: one central dictionary `{ [key]: { title, body } }` holding all tooltip copy; a `<Tip k="swing">` wrapper shows the tooltip after 400 ms hover; respects `uiStore.tipsEnabled`.
- `src/ui/components/Modal.tsx`: scrim + dialog, Esc to close, focus trap.
- `src/ui/components/Segmented.tsx`, `Chip.tsx`, `Toggle.tsx`.
- `src/ui/layout/TopBar.tsx`: logo, editable song name, Play/Stop (green/red round button), Pattern/Song segmented control, tempo stepper (±1, click to type, drag to scrub), Key select (12 roots × the 7 scales; stored now, used by phase 05), Swing slider (0–75%), Undo/Redo, an autosave status placeholder ("Not saved yet"; becomes real in phase 11), Songs and Export buttons (opening modal placeholders), and the 💡 tips toggle. Removes the phase-03 dev buttons.
- `src/ui/layout/TrackList.tsx` + `TrackRow.tsx`: color swatch, type icon, name (double-click to rename), sound subtitle, volume slider (position mapped with `sliderToDb`/`dbToSlider` from `model/mixing.ts`), M/S buttons; click to select; drag to reorder (`@dnd-kit/sortable`); right-click menu (Rename, Color, Duplicate, Delete); "+ Drum/Sample" and "+ Synth" buttons (Synth is disabled with the tooltip "Coming in the next update" until phase 05 enables it). At `MAX_TRACKS` (16), both add buttons and Duplicate are disabled with the tooltip "A song can have up to 16 tracks."
- `src/ui/layout/Timeline.tsx` + `Ruler.tsx` + `TimelineRow.tsx`: 64 px per bar, with a heavier line every 4 bars; ruler with bar numbers and the loop-region highlight (`getLoopRegion`); click the ruler to set `uiStore.songStartBar` (shown as a small ▼ flag; used by Song mode `engine.play`). Rows render blocks merged across consecutive bars of the same pattern instance, with a mini step-preview SVG. Click an empty bar to paint the selected pattern; click a block to remove it; click-drag across empty bars to paint several. Playhead is driven by `engine.onPosition`. "+ 4 bars" button at the end. Track-list and timeline scroll are synced vertically.
- `src/ui/editor/EditorPanel.tsx`: header (track swatch + name + mode, pattern chips A/B/…/＋ (＋ menu: "Empty pattern" / "Copy of current"), Length segmented 1–4, Grid 16ths/Triplets, "Show all drums" toggle, Clear) and body switch.
- `src/ui/editor/StepEditor.tsx`: one row of pads per bar (16 or 24 per row), beat pads tinted, velocity drawn as fill height. Click toggles; vertical drag on an active pad sets velocity (coalesced gesture); the current step is outlined while playing. Footer hint line as in the mock.
- `src/ui/editor/DrumView.tsx`: when "Show all drums" is on, stacks every non-melodic sample track as a row (name + color + its pattern chip for the current loop region). Each row edits that track's pattern, and clicking a row's name selects the track.
- `src/ui/inspector/Inspector.tsx`: Sound / Effects / Automate tabs. It renders `SampleSoundTab` for sample tracks (a synth track shows a placeholder until phase 05).
- `src/ui/inspector/SampleSoundTab.tsx`: the **Sound** tab for sample tracks, with the sound card (name, waveform, ▶ preview, "Change sound" and "Edit" buttons that open placeholder modals) and the Pitch / Decay / Tone / Pan knobs wired to the store. Pan is bound to `track.pan`. Pitch and Pan are heard this phase; Decay and Tone are stored and become audible in phase 07. Effects and Automate show "Coming soon" bodies.
- `src/ui/waveform.ts`: `computePeaks(buffer, n)` + `<Waveform>` canvas component.
- `src/ui/shortcuts.ts`: Space play/stop; `1`–`9` select track; Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo; Delete removes the selected block; `[`/`]` previous/next pattern; `?` opens the shortcuts modal. Ignored while typing in inputs.
- `src/ui/modals/ShortcutsModal.tsx`.
- `package.json`: add `@dnd-kit/core`, `@dnd-kit/sortable`.
- Tests: `Knob.test.tsx`, `StepEditor.test.tsx`, `Timeline.test.tsx`; `tests/e2e/drums.spec.ts`.

## Steps
1. Build the shared components (Knob, Tooltip + dictionary, Modal, Segmented, Chip, Toggle) matching the mock styling.
2. Replace the TopBar placeholder with the real top bar wired to the store, uiStore and engine. The first Play click calls `ensureAudioStarted()`.
3. Build TrackList and Timeline with synced scrolling and the painting interactions from the mock. Use the selected track's `selectedPatternId` as the paint pattern, shown as "Paint: A" in the track list header.
4. Build EditorPanel + StepEditor + DrumView. Grid change calls `setPatternGrid`; length change calls `setPatternLength`.
5. Build the Inspector frame and the sample Sound tab.
6. Seed the app at startup with a default song of 3 sample tracks using the `dev:` sounds (phase 10 replaces this with templates).
7. Write every tooltip used so far into `tooltips.ts`, using the mock's wording as the baseline.
8. Register keyboard shortcuts.
9. Tests: Knob drag and reset; StepEditor toggle and velocity drag dispatch the right actions; Timeline paint/remove; e2e: add a sample track, toggle steps, paint 4 blocks, press Space, and assert the playhead moves, then undo restores the previous state.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass in all 3 browsers.
- Manual: compare side by side with `plan/simple-sequencer/mocks/ui-mock.html` at 1440×900; layout, colors and spacing match. Build a 16-bar drum arrangement with 2 patterns per track. Drum view edits several tracks; Pattern mode loops the selected pattern's region (highlighted in the ruler); Song mode plays the arrangement. Every control shows a tooltip, and toggling 💡 hides them.

## Commit
`feat(ui): workspace with timeline painting, step editor, drum view and mixer controls`

## Rollback
Revert the commit. This restores the phase-03 dev buttons, and the model/engine are untouched.
