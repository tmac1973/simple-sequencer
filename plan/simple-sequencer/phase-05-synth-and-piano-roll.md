# Phase 05 — Synth tracks, scale-locked piano roll, chord stamp, melodic samples

**Depends on:** 02, 03, 04 · **Enables:** 08–10 (effects, automation targets and templates use synth tracks), 12 (export renders synth voices)

## Goal
Add synth tracks: a preset library, 4 macro knobs and an Advanced drawer, played by a polyphonic Tone.js voice. Add the scale-locked piano roll for entering notes, the chord stamp, and the "Melodic" switch that lets a sample track play its sample at scale pitches through the same piano roll. After this phase you can make full beats with bass, chords and lead.

## Files touched
- `src/audio/voices/synthVoice.ts`: `SynthVoice` per synth track: a `Tone.PolySynth` (`maxPolyphony: 8`) built from a preset → a per-voice `Tone.Filter` (lowpass, with a filter envelope via `Tone.FrequencyEnvelope`) → a "Space" `Tone.Freeverb` (roomSize 0.6, wet driven by the Space macro, max 0.45) → the track graph input. `applySettings(settings)` updates params live.
- `src/audio/synthPresets.ts`: 10 presets as data `{ id, name, category: 'bass' | 'keys' | 'pad' | 'lead' | 'pluck', base: SynthAdvanced, polyphonic: boolean, octaveShift }`: Warm Bass, Sub Bass, Reese Bass, Dusty Keys, Electric Piano, Soft Pad, Soft Pluck, Bright Lead, Bell, Retro Square.
- `src/audio/macros.ts`: `resolveSynthParams(preset, macros, advanced)` → concrete params, defined as follows:
  - **Tone** (0–1) sets filter cutoff from 200 Hz to 12 kHz on an exponential curve.
  - **Punch** (0–1) sets attack from 30 ms to 1 ms and filter-env amount from 0 to 3 octaves.
  - **Space** (0–1) sets Freeverb wet from 0 to 0.45.
  - **Length** (0–1) sets decay from 0.1 s to 2 s and release from 0.05 s to 3 s.
  - Any field set in `advanced` overrides the macro-derived value.
- `src/audio/scheduler.ts`: `kind: 'note'` events now carry `midi = degreeToMidi(degree, key) + preset.octaveShift*12` and `lengthBeats`.
- `src/audio/engine.ts`: dispatches notes: `synthVoice.triggerAttackRelease(freq, dur, time, velocity)` for synth tracks; for melodic sample tracks, `triggerSample` with playbackRate `2^((midi − sample.rootMidi)/12)` and duration = note length (with a 10 ms release fade).
- `src/ui/editor/PianoRoll.tsx` (+ css):
  - Rows are the key's scale degrees across 2 octaves (14 rows for 7-note scales, 10 for pentatonic), with a scroll buttons ▲▼ to shift the visible range by an octave (degrees −14…+28). The root row is highlighted with ●, and labels use flats/sharps per key.
  - Columns are steps (16 or 24 per bar × lengthBars).
  - Click adds a note of length 2 steps (16ths) or 3 (triplets). Drag the body to move it; drag the right edge to resize; right-click or Alt-click deletes it. Each new note plays a short audition.
  - Velocity: a lane under the grid with one bar per note; drag to adjust (`setNoteVelocity`, coalesced gesture).
  - The current step is highlighted while playing.
- `src/ui/editor/chordStamp.ts`: with Triad, a click adds degrees `d, d+2, d+4`; with 7th, it adds `d, d+2, d+4, d+6`. Those are always diatonic, so always in key. The segmented control lives in the editor header (as in the mock) and is shown only for note editing.
- `src/ui/editor/EditorPanel.tsx`: picks StepEditor or PianoRoll by `kind === 'synth' || sample.melodic`. Drum view lists only non-melodic sample tracks.
- `src/ui/inspector/SynthSoundTab.tsx`: preset chips grouped by category, Tone/Punch/Space/Length knobs, a Pan knob bound to `track.pan` (so synth tracks have pan like sample tracks), and a collapsible "▸ Advanced settings" drawer (oscillator select, ADSR knobs, filter cutoff/Q/env amount, vibrato rate/depth, glide) with a "Reset to preset" button. Changing preset keeps the macros.
- `src/ui/inspector/SampleSoundTab.tsx`: adds a "Melodic" toggle plus a "Root note" select (shown when melodic), listing C2–B5 and bound to `sample.rootMidi`. It's preset from the manifest's `rootNote` when a library sound is chosen (phase 06); default 60. with the tooltip "Play this sound at different pitches in a piano roll."
- `src/ui/layout/TrackList.tsx`: enables "+ Synth" (default preset Warm Bass, pattern A, 1 bar; still subject to the 16-track limit).
- `src/ui/inspector/Inspector.tsx`: renders `SynthSoundTab` for synth tracks.
- `src/ui/tooltips.ts`: copy for all new controls.
- Tests: `macros.test.ts`, `chordStamp.test.ts`, `PianoRoll.test.tsx`, scheduler note-event tests (unit); `synthVoice.audio.test.ts` (browser mode: an offline-rendered note's dominant frequency matches the expected MIDI pitch within 2%); `tests/e2e/synth.spec.ts`.

## Steps
1. Write the presets and `resolveSynthParams`, then build `SynthVoice` and its engine dispatch.
2. Extend the scheduler and engine for note events, both synth and melodic-sample.
3. Build the PianoRoll with scale-row rendering from `scale.ts`. Store edits as `{start, length, degree, velocity}`.
4. Add the chord stamp.
5. Build the synth Sound tab and the Melodic toggle on the sample Sound tab.
6. Changing Key in the top bar re-renders the piano roll labels, and playback follows automatically (notes are degrees).
7. Tests: macro mapping endpoints; Advanced overrides; triad and 7th degree sets; piano-roll add/move/resize/delete actions; scheduler emits correct MIDI after a key change; e2e: add a synth track, place a chord with the stamp, change key, play.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass.
- Manual: each of the 10 presets sounds distinct and usable. All 4 macros are clearly audible. A chord stamp at every degree in C minor and in F major sounds consonant. Switching key from C minor to A minor moves the melody without wrong notes. A melodic sample track (a dev sample) plays a melody at correct pitches. Holding 8 notes at once doesn't glitch.

## Commit
`feat(synth): synth tracks with presets and macros, scale-locked piano roll, chord stamp, melodic samples`

## Rollback
Revert the commit. Synth tracks in a saved song then can't be edited (there's no persistence yet, so nothing is stored), and sample tracks are unaffected.
