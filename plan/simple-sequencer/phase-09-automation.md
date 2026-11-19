# Phase 09 — Automation lanes

**Depends on:** 02, 03, 04, 05, 07, 08 (automation targets: track volume/pan, synth macros, sample tone, effect params) · **Enables:** 10 (templates may include a lane), 12 (export renders automation)

## Goal
Let users draw how a knob changes across the whole song. Lanes are song-timeline breakpoints joined by straight ramps, shown under their track in the timeline (as in the approved mock) and managed from the inspector's Automate tab. The engine schedules ramps sample-accurately, and the automated knob animates in the UI while playing.

## Files touched
- `src/model/automation.ts`: `valueAt(lane, bar)` (linear interpolation; before the first point the value is the first point's value, after the last point it's the last point's value); `targetLabel(track, target)`; `targetDefault(track, target)` (the knob's current static value, used as the starting point for a new lane); `pruneLanes(track)` (removes lanes whose fx slot was deleted). The store calls this from `removeFx`.
- `src/audio/automation.ts`: `resolveParam(engine, trackId, target) → AudioParam | setter`.
  - Volume maps to `channel.volume` (dB) via `sliderToDb` from `model/mixing.ts`, the same curve as the slider.
  - Pan maps to `channel.pan`.
  - Synth macros (Tone and Space only) go through `macros.ts`: Tone ramps the synth filter's `frequency`, and Space ramps the Freeverb `wet`. Punch and Length aren't automatable (phase 02).
  - Sample tone maps to the tone filter frequency.
  - Effect params use the registry `map`.
- `src/store/songStore.ts`: `removeFx` calls `pruneLanes`.
- `src/audio/scheduler.ts`: inside `scheduleBeat(beatIndex, time)` (the single per-beat method from phase 03, so live playback and offline export both get it), for each lane on an audible track: `param.linearRampToValueAtTime(map(valueAt(lane, nextBeatBar)), nextBeatTime)`. A point exactly on a beat produces an exact corner; a vertical step (two points at the same bar) is applied with `setValueAtTime`. When playback starts or jumps, `setValueAtTime(valueAt(startBar))`. In Pattern mode, automation follows the loop region's bars.
- `src/audio/engine.ts`: when an automated param has a lane, the static knob value is ignored for playback. On stop, params revert to their static values. It adds `onParamValue(trackId, target) → number | null`, which returns the current automated 0–1 value: `valueAt(lane, currentBar)` using the transport position, or `null` when not playing or not automated.
- `src/ui/timeline/AutomationLaneRow.tsx`: an SVG lane 64 px tall, full song width, in the track's color with a filled area under the line.
  - Click empty space to add a point, snapped to 1/4 bar (hold Alt to place freely).
  - Drag a point to move it (it can't pass its neighbors).
  - Double-click or right-click a point to delete it.
  - Shift-drag across the lane to draw freehand, which adds a point every 1/4 bar.
  - Hovering a point shows the value in the knob's display format.
- `src/ui/layout/Timeline.tsx`: after each `TimelineRow`, renders an `AutomationLaneRow` for each visible lane of that track, so rows stay aligned with the track list.
- `src/ui/layout/TrackList.tsx`: a "↳ Automation: <label>" row per visible lane, with a 👁 hide toggle and ✕ delete.
- `src/ui/inspector/AutomateTab.tsx`: the current lanes for the track (label, point count, show/hide, delete), and "Add a lane: choose a knob to automate" chips listing every automatable target of that track (Volume, Pan, synth Tone/Space or sample Tone, and each effect's main knobs, labeled "Filter · Cutoff"). A new lane gets two points (bar 0 and the song end) at the knob's current value.
- `src/ui/components/Knob.tsx`: an `automated` prop shows a small ∿ badge and animates the needle from `engine.onParamValue(trackId, target)` while playing (polled each `requestAnimationFrame`). Manual dragging of an automated knob is disabled, with the tooltip "This knob is automated. Edit its lane in the timeline."
- `src/ui/tooltips.ts`: lane and Automate tab copy.
- Tests: `automation.test.ts` (valueAt edge cases, vertical steps, prune on fx removal), scheduler ramp emission tests (using a mock param recording calls), `AutomationLaneRow.test.tsx` (add/move/delete points), `tests/e2e/automation.spec.ts` (add a Filter Cutoff lane, add points, play, and assert the knob badge).

## Steps
1. Implement `model/automation.ts` and hook `pruneLanes` into `removeFx`.
2. Implement param resolution and per-beat ramp scheduling.
3. Build the lane row, track-list lane rows and the Automate tab.
4. Add automated-knob display.
5. Tests above.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass.
- Manual: a filter-cutoff sweep across bars 5–9 rises smoothly with no zipper noise. A volume lane dropping at bar 13 is exact. Pan automation moves left↔right. Deleting the automated effect removes its lane. Starting playback mid-song uses the right automated value immediately. Hidden lanes still play.

## Commit
`feat(automation): song-timeline automation lanes for track, synth, sample and effect params`

## Rollback
Revert the commit. Lanes stay in the model and are ignored by the engine, and no data is lost.
