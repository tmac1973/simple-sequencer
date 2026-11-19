# Simple Sequencer — Project Overview

## Problem
Most music creation tools (DAWs, trackers, drum machines) are built for people who already know music production. They throw dozens of panels, jargon-labelled knobs and routing options at you at once. A novice who just wants to put together a beat with a bassline and some chords bounces off before making anything.

There's room for a browser-based sequencer that a beginner can open and make a song in within minutes, while it quietly holds enough depth (groove, effects, automation, sample editing) that it doesn't become a toy they outgrow.

## Goals
- **Make a playable loop in under 2 minutes** from opening the app, using a starter template or a blank song.
- **Multitrack songs** built from **patterns** (reusable 1–4 bar clips) placed as blocks on a **song timeline**, one row per track.
- **Two track types:**
  - **Sample tracks**: one-shot samples (drums, hits, vocal chops) triggered on a step grid with per-step velocity.
  - **Synth tracks**: built-in Web Audio synth with presets plus 4 friendly macro knobs (Tone, Punch, Space, Length) and an "Advanced" drawer; notes entered in a **scale-locked piano roll** with a chord-stamp helper.
- **Bundled free sound library** of CC0 and CC-BY samples (drum kits, percussion, a few melodic one-shots), with an in-app Credits screen for CC-BY attribution.
- **Custom samples**: import audio files (WAV/MP3/OGG/FLAC) and **record from the microphone**.
- **Sample editor**: trim start/end, reverse, tune (semitones), loop point.
- **Per-track effect chains** from a curated set of ~8 effects (Reverb, Delay, Filter, Distortion, Compressor, EQ, Chorus, Bitcrush), each with 1–2 big knobs plus an "Advanced" toggle, reorderable by drag. Master limiter always on so nothing clips.
- **Mixer basics**: per-track volume, pan, mute, solo.
- **Groove tools**: global swing, per-step velocity, variable pattern length (1–4 bars) with 16th or triplet step resolution.
- **Automation lanes**: draw how a track or effect parameter changes over the song timeline.
- **Save/load**: autosave to browser storage (IndexedDB) with an in-app song library; save/load a portable song file (`.json`, or `.zip` when custom samples are included).
- **Audio export**: render the whole song or the current loop offline to **WAV** and **MP3**.
- **Approachable UI**: plain-English labels, a hover tooltip on every control, starter templates (Empty, Lo-fi Beat, House, Hip-hop), keyboard shortcuts, undo/redo.

## Non-goals
- No user accounts, cloud storage, backend server or collaboration.
- No MIDI hardware input/output and no MIDI file export.
- No stem (per-track) export.
- No audio-clip tracks (recording or arranging long audio waveforms on the timeline). Samples are triggered one-shots or loops from the step grid.
- No VST/plugin hosting or user-scriptable effects.
- No tablet- or phone-optimized layouts or touch gestures. Desktop only.
- No full 12-note "chromatic" mode in v1. Synth notes are always locked to the song's key and scale (the key/scale itself can be changed).
- No guided step-by-step tutorial. Onboarding is templates + tooltips.
- No installable PWA or offline sample precaching (a static site that works offline once loaded is enough).

## Users & primary flow
**User:** a novice who's curious about making beats/loops (electronic, hip-hop, lo-fi, house) and has little or no experience with music software. Uses a laptop/desktop browser.

**Primary flow:**
1. Open the app. On first launch, the Lo-fi Beat template opens directly, ready to play, with a two-step hint. Later launches restore the last song.
2. Press **Space** to play/stop. Anytime, **📁 Songs** opens the "Start a song" dialog with templates (Empty, Lo-fi Beat, House, Hip-hop) and the saved-song library.
3. Click a track to open its **pattern editor** below the timeline:
   - Sample track → step grid; click steps on/off, drag vertically for velocity.
   - Synth track → scale-locked piano roll; click to add notes, drag to lengthen, use the chord stamp to drop in chords.
4. Change sounds: choose a sample from the sound browser (bundled, imported or recorded) or a synth preset; tweak macro knobs.
5. Add effects to a track from the effects panel; adjust 1–2 knobs each.
6. Create more patterns (B, C...) and paint pattern blocks along the **song timeline** to build intro/verse/drop.
7. Optionally draw automation (e.g. a filter sweep) in an automation lane.
8. The song autosaves. The user exports to WAV/MP3 or saves a song file to share/back up.

## Constraints
- **Platform:** desktop browsers, current Chrome, Firefox and Safari. Mouse + keyboard.
- **Audio:** Web Audio API; sample-accurate scheduling (no audible timing drift); low enough latency for live step-toggling while playing. Mic recording via `getUserMedia` (requires a secure context: HTTPS or localhost).
- **Deployment:** static site with no backend; must run from GitHub Pages/Netlify or a local static server. Works offline once loaded (no runtime network calls besides loading the app's own assets).
- **Licensing:** bundled samples must be CC0 or CC-BY; every CC-BY sample listed in the Credits screen with author, source URL and license. Third-party code dependencies must be permissively licensed (MIT/BSD/Apache/ISC or similar). The one exception is the MP3 encoder (lamejs, LGPL-3.0), shipped unmodified as a separately loaded lazy chunk and credited.
- **Storage:** browser IndexedDB for songs and custom sample audio; the app must handle storage quota errors gracefully and tell the user.
- **Size:** keep the bundled sample library small enough for fast first load (target ≤ 15 MB total, samples lazy-loaded per kit).
- **UI approval gate:** UI mocks must be produced and approved by the user **before** any implementation begins.

## Success criteria
- A first-time user can, without instructions, choose a template, change a drum pattern and hear the change within 2 minutes.
- A user can build a song of at least 8 tracks × 16+ bars with multiple patterns, and it plays back with no audible timing glitches in Chrome, Firefox and Safari.
- Every interactive control has a plain-English tooltip.
- Synth notes can never be off-key relative to the selected key/scale.
- Custom samples can be imported from a file and recorded from the mic, edited (trim/reverse/tune/loop) and used on a sample track.
- Each track can have an effect chain of the curated effects, reorderable, and the master output never clips (limiter).
- Swing, velocity, 1–4 bar patterns, triplet resolution and automation lanes all work and are reflected in playback and export.
- Closing and reopening the browser restores the song (autosave). Songs saved to `.json`/`.zip` reload identically, including custom samples.
- WAV and MP3 export of the full song and of the current loop match what playback sounds like.
- The Credits screen lists every CC-BY sample with correct attribution.
- The app builds to static files and runs from a static host with no server-side code.
- UI mocks were approved before implementation started.

## Decisions
- **Music focus** → Beats + loops (electronic, hip-hop, lo-fi, house).
- **Synth note entry** → Scale-locked piano roll with chord-stamp helper.
- **Song arrangement** → Pattern blocks on a per-track timeline.
- **Synth depth** → Presets + 4 macro knobs (Tone, Punch, Space, Length) with an Advanced drawer.
- **Effects** → Per-track effect chains.
- **Effect UX** → Curated set of ~8 effects with 1–2 knobs each + Advanced toggle, reorderable, master limiter.
- **Saving** → IndexedDB autosave + song library, plus `.json`/`.zip` song files.
- **Audio export** → WAV + MP3 (full song or current loop).
- **Onboarding** → Starter templates + hover tooltips; no forced tutorial.
- **Platforms** → Desktop browsers (Chrome, Firefox, Safari).
- **Power extras** → All four: swing + per-step velocity, variable pattern length (1–4 bars, 16th/triplet), sample editor (trim/reverse/tune/loop), automation lanes.
- **Bundled sample licensing** → CC0 + CC-BY, with a Credits screen.
- **Hosting** → Static site, deployable anywhere; works offline once loaded.
- **Input methods** → Keyboard shortcuts + microphone recording (no MIDI).
- **Visual style** → Dark, colorful, friendly: per-track colors, rounded shapes, big click targets.
- **UI mock** → Approved as-is (2026-11-19): `plan/simple-sequencer/mocks/ui-mock.html`. Layout: top bar (transport, Pattern/Song mode, tempo, key, swing, undo/redo, Songs, Export, tips toggle); track list + song timeline with pattern blocks and automation lanes; bottom pattern editor (step pads or piano roll with pattern chips, length, grid, chord stamp); right inspector with Sound / Effects / Automate tabs; modals for New song, Sound browser (import + record), Sample editor, Export, Credits.

### Implementation decisions (Stage 2)
- **Stack** → TypeScript + React + Vite.
- **Audio engine** → Tone.js.
- **State** → Zustand + Immer with patch-based undo/redo.
- **MP3 encoder** → Allow LGPL lamejs as an unmodified, lazy-loaded chunk, credited.
- **Testing** → Vitest unit tests + Playwright smoke tests (Chromium, Firefox, WebKit) + per-phase manual listening checklist.
- **Drum view** → Add a "Show all drums" toggle that stacks every drum track's pattern in the step editor.
- **Pitched samples** → A "Melodic" switch per sample track uses the scale-locked piano roll and repitches the sample.
- **Automation model** → Song-timeline breakpoints with linear ramps. Targets: track volume/pan, synth macros, sample tone, effect params.
- **Sample edits** → Non-destructive settings applied at playback; originals untouched.
- **Deploy** → GitHub Pages via GitHub Actions.
- **Set during planning (no question asked):**
  - **Sample format:** bundled samples are mono 44.1 kHz FLAC.
  - **Scheduling:** per-beat lookahead.
  - **Triplets:** the triplet grid is 24 steps per bar (16th-note triplets) and is never swung.
  - **Pitch storage:** notes are stored as scale degrees, so they're always in key.
  - **Recordings:** mic recordings are stored as WAV.
  - **Song files:** `.json`, or `.zip` when the song uses custom samples.
  - **Limits:** 16 tracks, 128 bars, 6 effects per track.
  - **Sample packs:** chosen from CC0 Freesound/Sonic Pi/VCSL sources plus CC-BY Salamander piano (see phase 06).
