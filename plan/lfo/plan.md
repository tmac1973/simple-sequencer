# Wobble (LFO) lanes — plan

## Goal
Let any automated knob move up and down by itself, in time with the song, without drawing every wiggle. Beginners get wobble bass, tremolo, auto-pan and slow filter "breathing" in one click. The wobble itself can be automated ("automating the automation"), e.g. fading a wobble in over a build.

## Decisions
- **Name in the app:** "Wobble (LFO)". The mode switch reads ✏️ Draw / 〰️ Wobble, and tooltips explain that an LFO is a slow, repeating movement.
- **Where:** an automation lane switches between Draw and Wobble in the **Automate** tab, as in `plan/lfo/mocks/lfo-mock.html`. Switching back to Draw keeps the drawn points, so nothing is lost.
- **Shapes (6):** smooth (sine), triangle, square (on/off), ramp up, ramp down, random steps. Random steps are seeded per cycle, so live playback and exports match exactly.
- **Speed:** always in time with the tempo: 1/16, 1/8, 1/4 (a beat), 1/2, 1 bar, 2 bars, 4 bars, 8 bars.
- **Amount and Centre:** knobs (0–100%). The knob swings ±Amount/2 around Centre and is kept inside 0–100%.
- **Automating the wobble:** "Add a lane" offers *<knob> · wobble amount* and *<knob> · wobble speed* for each wobble lane. These are ordinary draw lanes, shown indented under the wobble lane.
  - Amount automation scales the Amount knob (0 = no wobble).
  - Speed automation snaps to the speed steps.
  - The wobble's phase stays continuous when the speed changes, so there are no jumps.
- **Timeline:** a wobble lane shows the knob's actual movement (computed, not editable) with a dashed centre line. Clicking it says "This lane wobbles by itself. Change it in the Automate tab."
- **Quick wobbles:** one-click presets that add a ready-made wobble lane for the selected track:
  - **Wobble bass:** synth Tone, 1/8, square-ish smooth.
  - **Tremolo:** volume, 1/16, smooth.
  - **Auto-pan:** pan, 1 bar, smooth.
  - **Slow sweep:** Tone, 8 bars, triangle.
  - Each is offered only when the track has that knob.
- **Song files:** lanes gain optional `mode` and `lfo` fields, so older songs load unchanged. Share links carry them too.

## How it works (engine)
- `lfoValue(lane, songBeat)` gives the knob value at any song beat.
  - It uses: the shape, the phase (cycles integrated over the tempo-synced speed and its speed lane), Centre, and Amount × the amount lane.
  - It's pure, so tests and the timeline drawing use it too.
- `scheduleAutomation` already runs once per beat for live playback and for export. For a wobble lane it schedules short linear ramps through about 16 points per cycle, and at least 4 per beat. Square and random steps use exact jumps.
- Stopping resets the knob exactly as it does today.

## Phases
1. **Model and maths.**
   - Lane `mode`/`lfo` fields and the new `lfoAmount`/`lfoSpeed` automation targets (pointing at a wobble lane).
   - Schema validation and migration, and share-link support.
   - `lfoValue` with the 6 shapes, continuous phase and speed snapping.
   - Unit tests: shapes, range clamping, phase continuity across speed changes, and old songs loading.
2. **Engine.**
   - Schedule wobble lanes per beat (live and export).
   - Amount/speed lanes feed in; reset on stop.
   - Audio tests: an offline render of a volume tremolo has the expected modulation rate and depth, and export matches live scheduling.
3. **UI.**
   - The Draw/Wobble switch and controls in the Automate tab: shape buttons, speed menu, Amount and Centre knobs.
   - Quick wobbles, the computed curve in the timeline, the indented amount/speed lanes, and tooltips for everything.
   - Playwright: add a quick wobble, change speed and shape, add an amount lane, undo, save/reload, share link round-trip.
   - Push live when CI is green.

## Done when
- Every shape at every speed renders correctly in live playback and export, at any tempo.
- Wobble amount and speed lanes work, with no clicks or jumps when the speed changes.
- Old songs and share links still open.
- The tooltip coverage test passes with the new controls, and CI passes in all three browsers.
