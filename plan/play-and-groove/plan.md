# Loop, play & record, groove and pump — plan

Five features in one batch: **loop a section**, **play notes from the computer keyboard** (and record them), **MIDI keyboard input**, **sidechain pump (ducking)**, and **per-step chance + humanize**. The UI is shown in `plan/play-and-groove/mocks/play-mock.html`.

## Decisions

### 1. Loop a section (Song mode)
- **Set a loop by dragging along the ruler** across 2 or more bars. A loop bar (accent colour, with handles at both ends and a ✕) appears above the bar numbers. A plain click still sets where playback starts (▼), as it does today.
- The ruler's right-click menu also gets **🔁 Loop these 4 bars** and **🔁 Loop these 8 bars**.
- **🔁 Loop button** in the transport, next to Pattern/Song. It turns the loop on or off without forgetting where the loop is. It's shown only in Song mode. In Pattern mode the ruler keeps showing the pattern's loop, as it does today.
- When the loop is on and you press play, playback starts at the loop's start (or at ▼ if ▼ is inside the loop) and repeats the looped bars.
- Dragging a handle resizes the loop and dragging the loop bar moves it. Both snap to whole bars.
- **Where the loop is stored:** in UI state, so it isn't undoable and isn't saved in song files or share links. It's remembered per song for the session, and adding or deleting bars moves it along with the music.
- **Export always renders the whole song.** The export dialog gets a choice: **Whole song / Just the loop**, with Whole song as the default.

### 2. Play notes from the computer keyboard
- When a synth or melodic-sample track is selected, the letter keys play it, scale-locked, so nothing sounds wrong:
  - **A S D F G H J K L ;** play the next ten notes of the scale, starting from the root shown at the bottom of the piano roll.
  - **Q W E R T Y U I O P** play the same notes an octave higher.
  - **Z / X** move the keyboard down or up an octave.
- On a drum or sample track, any of those keys hits that track's sound. In **Show all drums**, A S D F … each play one drum track in order (kick, snare, hats…), for finger drumming.
- Notes held on the keyboard sustain until the key is released. Velocity is fixed at 80%.
- The piano roll lights up the row being played, and the step grid lights up the pad.
- Keys are ignored while typing in a text field, while a dialog is open, or when Ctrl, ⌘ or Alt is held. The shortcuts Space, 1–9, [ ] and ? keep working.
- **🎹 Keys** toggle in the editor header (on by default) with a tooltip listing the keys. When off, letters do nothing.
- A small hint line under the editor header the first time a note track is selected: "Tip: play notes with A–L on your keyboard".

### 3. MIDI keyboard input
- Uses Web MIDI, which works in Chrome, Edge and Firefox (Firefox asks once for permission). Safari doesn't support it, so the setting says that and nothing breaks.
- **Off until you turn it on:** a **🎛 MIDI** button in the editor header opens a small popover:
  - Turn on; this asks the browser for permission.
  - Device: **All devices** (default) or a specific one.
  - A status line: "Connected: Arturia KeyStep" or "No MIDI keyboard found. Plug one in and it'll appear here".
- **Notes snap to the song's scale.** A note outside the key plays the nearest scale note (rounding down on ties), so every key sounds right and the stored data stays scale degrees. The tooltip says so.
- Velocity comes from the MIDI keyboard.
- Note-off ends the note. The sustain pedal (CC64) holds notes.
- On drum tracks, MIDI note 36 and up map to drum tracks in order, as in Show all drums, so pads on a MIDI controller work.
- The on/off setting is remembered in the browser. Permission is asked only when the user clicks.

### 4. Record what you play (keyboard or MIDI)
- **● Rec** button in the editor header, for the selected pattern.
  1. Press it, and you get **one bar of count-in clicks**.
  2. The pattern then loops, with a metronome click on each beat, and what you play is added to the pattern.
  3. Press ● Rec, ■ or Space to stop.
- **Overdub:** each pass adds notes and nothing is erased. One undo step removes the whole take.
- **Snap to grid:** on by default (quantizes to the pattern's grid: 16ths or triplets). A switch in the Rec popover turns it off, which still rounds to the nearest step, since steps are the smallest unit.
- Note lengths come from how long the key was held, rounded to whole steps (at least 1). Notes held past the end of the loop are cut at the end.
- On drum tracks, each hit becomes a step, with velocity from MIDI or 80% from the keyboard.
- The metronome click uses its own sound and isn't part of exports. A **click volume** knob is in the Rec popover.
- Recording happens in **Pattern mode**. Pressing ● Rec in Song mode switches to Pattern mode first.

### 5. Sidechain pump (ducking)
- Per track: **"Duck when [Kick ▾] plays"**, a card at the top of the **Effects** tab.
  - **Amount** knob: how far the volume dips, 0–100%; 100% means silence at the hit.
  - **Release** knob: how quickly the volume comes back: 1/16, 1/8, 1/4, 1/2 note, in time with the tempo.
  - The source can be any other track (drum or synth). The default is a track whose sound is a kick, otherwise the first drum track.
- **Quick button:** **💓 Pump to the kick** sets Amount to 70% and Release to 1/4, for the classic house "breathing" sound. It appears in the Effects tab when the song has a kick track.
- **How it sounds:**
  - The dip follows the source track's **scheduled hits**, so it's sample-accurate and the same live and in exports.
  - It only happens when the source track is audible. It uses each hit's velocity, so ghost notes dip less.
  - It's a fast 5 ms dip followed by a smooth curve back up. A new hit restarts the dip from wherever the volume is.
- **Track list badge:** "⤵ Kick" on a ducked track.
- **Saving:** song files and share links carry the setting. Duplicating or deleting tracks keeps the source pointer valid: if the source track is deleted, ducking is removed.

### 6. Chance and humanize
- **Chance (per step and per note):** how often it plays, from 100% down to 10%.
  - The step grid gets a **Loudness / Chance** switch in its header. In Chance mode, dragging a step up or down sets its chance, and pads show a dotted outline with the percentage instead of the fill height.
  - In the piano roll, a note's chance is set in the velocity strip under the notes, using the same switch.
  - Steps under 100% have a small dice dot in Loudness mode too, so they're never invisible.
- **Humanize (per track):** a knob in the Sound tab (0–100%, default 0).
  - It nudges each hit's timing by up to ±12 ms and its loudness by up to ±20%, scaled by the knob.
  - Hits on the beat move half as much, so the groove stays tight.
- **Randomness is repeatable:** it's seeded from the track, the step, the song bar and how many times the loop has played. So:
  - an export sounds exactly like the first time through live playback;
  - each repeat of a loop varies (it's random), but the same song always plays back the same way.
- **Saving:** steps and notes gain an optional `chance` field, and tracks gain an optional `humanize` field. Older songs load unchanged, and share links carry both.
- **Ideas:** none of the 106 ideas use chance yet. Adding chance to a few hi-hat grooves is a later idea, not part of this batch.

## Phases
1. **Model.**
   - Add `chance` on Step and Note, `humanize` and `duck { sourceId, amount, release }` on Track, schema validation, defaults, share-link packing, pruning ducking when its source is deleted, and remapping it when tracks are duplicated.
   - Unit tests.
2. **Engine.**
   - Seeded chance and humanize in `computeBeatEvents`, plus a pass counter passed in from the live clock and the export.
   - A duck gain node in each track graph, with dips scheduled from source hits in `scheduleBeat`.
   - Song-mode loop region in `songBeatFor` and the engine.
   - Audio tests: a ducked pad dips at kick hits; export with chance matches live pass 0; humanize stays within bounds.
3. **Loop a section.** Ruler drag and handles, context menu items, the 🔁 transport toggle, export Whole song / Just the loop, the loop moving with bar insert and delete, tooltips, e2e.
4. **Play from the keyboard.** A shared `livePlay` module (note on/off, routed to the selected track's synth or sample voice, scale-locked mapping), keyboard handler, 🎹 Keys toggle, highlighting, hint, e2e.
5. **MIDI input.** The 🎛 MIDI popover, device list, permission flow, mapping to the scale and to drums, sustain pedal, Safari message. Unit tests use a fake MIDIAccess.
6. **Record.** ● Rec with count-in, metronome, overdub as one undo step, snap, drums and notes, e2e (keyboard-driven record with fake time).
7. **Pump, chance and humanize UI.**
   - The Duck card plus 💓 quick button, track badge, Loudness/Chance switch for the step grid and velocity strip, Humanize knob, tooltips.
   - E2e for each.
   - Update the README feature list.
   - Push live when CI is green.

## Done when
- A looped section plays seamlessly in Song mode, and export can render the whole song or just the loop.
- Letter keys and a MIDI keyboard play the selected track in key, and ● Rec captures takes into the pattern with count-in and metronome, as one undo step.
- 💓 Pump to the kick makes a pad breathe, sounding the same live and exported.
- Chance and humanize vary each pass but render exactly the same in export as in live playback's first pass.
- Old songs and share links still open. The tooltip coverage test passes. CI is green in all three browsers.

## As built (differences from the plan)
- **Snap** is a choice of **Steps / 1/8 / Beats** rather than on/off. "Off" would still have rounded to the nearest step, so coarser snaps are the useful option.
- **The keyboard tip is in the editor's help line** (`A–L play notes · Z/X octave`), not a one-time row under the header, so the piano roll keeps its height. The 🎹 button is icon-only; its tooltip lists the keys.
- **Export** keeps its "Current pattern loop" option and adds **🔁 Just the song loop** when a Song-mode loop is set.
- **Ducking follows scheduled hits only.** Notes played live on the keyboard or MIDI don't make other tracks pump.
- The **metronome** only runs while recording; there's no general metronome toggle yet.
