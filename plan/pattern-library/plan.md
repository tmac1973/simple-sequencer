# Pattern library ("💡 Ideas") — plan

## Goal
A beginner can open the pattern editor, press **💡 Ideas**, browse ~60 genre patterns (drum grooves, fills, percussion, basslines, chords, melodies), **preview them with their own sounds at the song's tempo and key**, and drop one in with a click, then tweak it. This is the fastest way to piece a track together from known-good parts.

## Decisions
- **Size** → about 60 patterns in v1 (counts below).
- **Drum grooves** → one pick fills the **whole kit** (kick, snare, hats, …), matching existing tracks and adding any missing ones.
- **Notes** → **in key only.** Basslines, chords and melodies are stored as scale steps (like every note in the app), so they fit any key and can never sound wrong. Walking bass is diatonic.
- **Naming** → style names only ("swung boom-bap"), never song titles. Every pattern is written from scratch.
- **UI** → as in the approved mock, `plan/pattern-library/mocks/ideas-mock.html`.

## Content (61 patterns)

| Group | Count | Patterns |
|---|---|---|
| 🥁 Drum grooves | 22 | **Hip-hop:** boom-bap (straight), boom-bap (swung), lazy lo-fi, dusty lo-fi with ghost notes, trap with triplet hi-hat rolls, trap half-time, UK drill. **Dance:** house four-on-the-floor, deep house, disco, UK garage 2-step, breakbeat, drum & bass two-step, dubstep half-time. **Trip-hop:** half-time. **Live feels:** rock basic, rock driving, funk 16ths with ghost notes, blues shuffle (triplets), jazz ride swing, reggae one-drop, reggaeton dembow |
| 💥 Fills & builds | 6 | snare roll (1 bar), tom fill, build-up (denser and louder over 2 bars), crash on the one, stop-time break, half-bar drop-out |
| 🪘 Percussion | 5 | shaker 16ths, conga tumbao, 3-2 son clave, cowbell disco, rim "click" pattern |
| 〰️ Basslines | 12 | root notes, root–fifth, octave bounce (disco), walking bass (jazz, in key), funk syncopation, reggae one-drop, rock eighths, Motown-style melodic, 808 long notes (trap), offbeat house bass, synthwave arpeggio, dub bass |
| 🎹 Chords | 10 | pop I–V–vi–IV (held), pop I–V–vi–IV (stabs), jazz ii–V–I (comping), dark minor i–VI–III–VII, lo-fi i–iv (7ths), Andalusian cadence, house piano stabs, reggae offbeat skank, arpeggio up, arpeggio up-and-down |
| 🎵 Melodies | 6 | pentatonic riff, call and response, arpeggio lead, hook motif (2 bars), simple counter-melody, sparse "lo-fi" melody |

Every pattern carries: genre tags, a suggested tempo range, an optional suggested swing, length (1–4 bars), grid (16ths or triplets), and optional "pairs well with" links (e.g. walking bass → jazz ii–V–I).

## How it works
- **Where:** a **💡 Ideas** button in the pattern editor header opens the "Pattern ideas" window. It opens on the category that fits the selected track (drum track → drum grooves; synth or melodic sample track → basslines). The left column switches categories, the chips filter by genre, and there's a search box.
- **Preview:** the card's ▶ plays the idea on a loop **with the song's own sounds, tempo and key**, without changing the song. Only one preview plays at a time, and it stops when the window closes.
- **Use / Add as new:**
  - **Use** replaces the selected pattern.
  - **Add as new pattern** puts the idea in the next free letter (B, C…).
  - Either way it's **one undo step**, and the new pattern is selected so the user can paint it onto the timeline straight away.
- **Drum grooves fill the kit.** Each groove is made of parts (kick, snare, clap, closed hat, open hat, rim, percussion, tom, cymbal).
  - **Matching:** each part goes to the existing drum track whose sound fits it. The track's sound category (Kicks, Snares, Hi-hats, …) is checked first, then its name.
  - **Missing parts:** a new track is added using the sound of the same kind from the kit the song already uses. The apply bar shows this mapping before the user clicks (e.g. "Rim → new track").
- **Feel:** an "also set tempo & swing" checkbox applies the idea's suggested tempo and swing. It's on by default for drum grooves.

## Phases
1. **Data and content.**
   - `src/library/ideas/` holds a typed `PatternIdea` model and the 61 patterns as data.
   - Unit tests check every idea: steps sit inside the grid, notes are whole scale steps, lengths and tempos are valid, IDs are unique, and every genre filter has at least one idea.
2. **Apply logic.**
   - A store action applies an idea as a single undo step: `Use` / `Add as new`, drum part→track matching, creating missing tracks within the 16-track limit, and optional tempo/swing.
   - The engine can preview a temporary song without touching the real one.
   - Unit tests cover the matching, the one-step undo, the track limit and preview isolation.
3. **UI.**
   - The 💡 Ideas button and the "Pattern ideas" window as in the mock: categories, genre chips, search, cards with mini grids or piano rolls, ▶ preview, the apply bar with the kit mapping, tooltips everywhere.
   - Playwright tests: open, filter, preview, Use, Add as new, undo, in Chromium and Firefox (WebKit in CI).
   - Push live when green.

## Done when
- All 61 ideas load, preview, and apply correctly on every template.
- Applying a drum groove to the Empty template fills the kit and adds the missing tracks.
- One Ctrl+Z undoes a whole apply.
- Every control has a tooltip (the coverage test is extended to the new window).
- CI passes in all three browsers, and the live site has the feature.

## As built (changes from the plan)
- **"Crash on the one" is "Big hit on the one"** (kick + ride + open hat). The bundled library has no crash cymbal.
- **Drum ideas line the kit up on the timeline.** In pattern mode only the selected track plays its pattern freely, so a new Rim track with no blocks would be silent. Wherever one kit track already plays the pattern, the others now play it too. If the pattern isn't placed yet (e.g. "Add as new"), it goes in at the first bar where all of its tracks are free.
- **Longer patterns keep playing in full.** When "Use" makes a pattern longer, back-to-back blocks of it are re-laid at the new length.
- **Note ideas on a drum track add a synth track** (Bass, Keys or Lead) instead of being disabled.
- **Preview follows the tempo & swing checkbox,** so you hear what "Use" will give you.
- **Pentatonic keys:** ideas are written for 7-note scales; in a pentatonic key each note moves to the nearest scale note.
