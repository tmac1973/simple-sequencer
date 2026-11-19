# Phase 10 — Starter templates and the "Start a song" dialog

**Depends on:** 02, 04, 05, 06, 08, 09 · **Enables:** 11 (the dialog gains the saved-songs list), 13 (first-run onboarding)

## Goal
Write the four starter templates (Empty, Lo-fi Beat, House, Hip-hop) as playable songs built only from bundled samples and synth presets, so they work for every user. Build the "Start a song" modal from the approved mock (template cards; the saved-songs list arrives in phase 11). Choosing a template loads it and it's playable with Space immediately.

## Files touched
Bar numbers below are **1-based display bars** (bar 1 = model `startBar` 0). Sample references use manifest ids; the House percussion and Hip-hop vocal chop are found by `templateRole` (`house-perc`, `hiphop-chop`) from phase 06.
- `src/templates/empty.ts`: 90 BPM, C minor, 8 bars. One sample track "Drums" (Dusty Kit kick, pattern A with steps 0/8, 1 bar, placed bars 1–4) and one synth track "Bass" (Warm Bass, empty pattern A). Nothing else.
- `src/templates/lofi.ts`: 84 BPM, C minor, swing 0.28, 16 bars.
  - **Drums:** Kick, Snare, Hi-hat (Dusty Kit), Snap (Dusty Kit), each with patterns A/B.
  - **Synths:**
    - Chords (Dusty Keys; a 7th-chord progression on degrees 0 → 5 → 3 → 4 over 4 bars, pattern B a variation).
    - Bass (Warm Bass following the roots).
    - Lead (Soft Pluck, sparse, enters at bar 9).
  - **Effects:**
    - Chords: Filter + Reverb.
    - Drums bus feel: Bitcrush (Crush 0.3, Amount 0.25) on Snare.
    - Hi-hat: EQ.
  - **Automation:** a Filter·Cutoff lane on Chords rising bars 5–9 (as in the mock).
- `src/templates/house.ts`: 124 BPM, A minor, swing 0.1, 16 bars.
  - **Drums:** Kick (Club Kit, four-on-the-floor), Clap (2 and 4), offbeat open Hat, 16th closed Hat (pattern B adds accents), Percussion (the `house-perc` sample).
  - **Synths:** Stab chords (Electric Piano with Delay 3/16 + Reverb), Bass (Reese Bass, offbeat 8ths).
  - **Arrangement:** intro bars 1–4 kick+hats only; full groove from bar 5; break at bars 13–14.
- `src/templates/hiphop.ts`: 92 BPM, D minor, swing 0.22, 16 bars.
  - **Drums:** Kick and Snare (808 Kit, boom-bap), Hats in a 24-step triplet grid (trap-style rolls in pattern B), Rim.
  - **Synths and samples:** Sub Bass (Sub Bass preset), Keys (a melodic sample track using "Piano C4", `rootMidi` 60), and a Vocal chop melodic sample track (the `hiphop-chop` sample).
  - **Effects:** Compressor on Kick, Reverb on Keys.
- `src/templates/index.ts`: `TEMPLATES = [{ id, name, description, bpmLabel, build(): Song }]`. `build()` uses the factories with fresh ids each time.
- `src/ui/modals/NewSongModal.tsx`: "Start a song" layout as in the mock. 4 template cards (mini pixel-grid art generated from each template's first patterns in track colors, name, one-line description with BPM); the Lo-fi card is preselected; Create and Cancel; "Open song file…" is rendered disabled with the tooltip "Available soon" until phase 11. Create loads the song via `loadSong` (clearing undo history), preloads its kits, selects the first track and closes. If the undo history is non-empty (the user has edited the current song), it asks "Replace the current song? Your changes aren't saved yet." first. Phase 11 removes that prompt, because autosave keeps the current song in the library.
- `src/ui/layout/TopBar.tsx`: "📁 Songs" opens NewSongModal.
- `src/App.tsx`: the startup song is now `lofi.build()` instead of the phase-06 default.
- Tests: `templates.test.ts` (every template passes `validateSong`; references only manifest sample ids and existing preset ids; every block references an existing pattern; every effect param in range), `NewSongModal.test.tsx`, `tests/e2e/templates.spec.ts` (each template loads and the playhead moves on Space).

## Steps
1. Write the four templates with the factories. Tune them by ear so each sounds good immediately.
2. Implement `NewSongModal` with generated card art.
3. Wire it to the top bar and the startup song.
4. Tests above.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass.
- Manual: each template sounds musical and in-genre straight away. A non-musician tester (or you) can choose a template, change one kick step and hear it within 2 minutes (overview success criterion).

## Commit
`feat(templates): lo-fi, house, hip-hop and empty starter songs with new-song dialog`

## Rollback
Revert the commit. The startup song falls back to the phase-06 default, and nothing else depends on template data.
