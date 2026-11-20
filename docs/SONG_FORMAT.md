# Song file format

This page describes the song files Simple Sequencer saves and opens, so you can write songs with code and load them into the app.

- **Loading a file:** in the app, click **📁 Songs → Open song file** and pick a `.json` or `.zip` file. The song opens as a new song with a new id, so it never overwrites a saved one. If something in the file is wrong, the app shows which field and why, for example `tracks[2].patterns[0].steps[3].velocity should be between 0 and 1`.
- **A working example:** [`examples/make-song.mjs`](examples/make-song.mjs) is a dependency-free Node script that builds an 8-bar house groove, using drums, a bass, a pad that pumps to the kick, and filter automation. Its output is [`examples/example-song.json`](examples/example-song.json).
  ```bash
  node docs/examples/make-song.mjs > my-song.json
  ```
- **Every option in one song:** [`examples/showcase-song.json`](examples/showcase-song.json) is a 16-bar lo-fi tune in D dorian that uses every setting in this format at least once, including all eight effects, every kind of automation lane, triplet patterns, chance, humanize, the pump, reversed and looping samples, and a muted track. It's built by [`examples/make-showcase.mjs`](examples/make-showcase.mjs), which explains each part in comments. A test checks that it keeps covering every option.
- **Check a file before loading it:**
  ```bash
  npm run validate-song -- my-song.json
  ```
  The validator runs the app's own reader, so a pass means the app will open the file. It also warns about things the app quietly drops or ignores: unknown sounds or presets, blocks pointing to missing patterns, steps outside the pattern, unsorted automation points, a melodic sample whose `rootMidi` doesn't match its recording, and more. Add `--strict` to fail on warnings too, which is useful in a script. It reads `.zip` files and checks the sounds inside them. It needs this repository with `npm install` done.
- **The easiest way to learn the format** is to make something in the app, then use **Export → Save song file** and read the JSON.
- **Source of truth:** [`src/model/types.ts`](../src/model/types.ts) defines the types and [`src/model/schema.ts`](../src/model/schema.ts) validates them. The [sound, preset and effect lists](#built-in-sounds-presets-and-effects) at the end are generated from the app's own data, and a test fails if they go out of date.

## Files: `.json` or `.zip`

| File        | When                                | Contents                                                           |
| ----------- | ----------------------------------- | ------------------------------------------------------------------ |
| `name.json` | The song only uses built-in sounds. | The song object below.                                             |
| `name.zip`  | The song uses your own audio files. | `song.json` (the song), `samples/index.json`, and the audio files. |

### Bringing your own sounds (`.zip`)

`samples/index.json` lists each audio file:

```json
[{ "id": "user:my-bass", "name": "My bass", "mime": "audio/wav", "file": "samples/my-bass.wav" }]
```

- A track uses the sound by setting `"sampleId": "user:my-bass"`, the same `id` as in the index.
- On import, each file is added to **My Sounds** and the track is pointed at it. A file identical to one already in My Sounds is reused instead of added twice.
- The `mime` types the app uses are `audio/wav`, `audio/mpeg` (mp3), `audio/ogg`, `audio/flac`, `audio/mp4` (m4a), `audio/aac` and `audio/webm`.
- The zip can be stored or compressed.
- The `id` can be any text, but start it with `user:` to match what the app writes.

## Concepts

- **Time.**
  - Everything is in 4/4 time.
  - Bars are counted **from 0** in the file. The app shows them from 1.
  - A beat is a quarter note.
- **A song** has tracks.
- **A track** is one instrument. It is either a **sample** track (plays an audio file) or a **synth** track (plays a built-in synth preset).
- **Patterns** are short loops of 1–4 bars, named A, B, C…, that belong to a track.
- **Blocks** place a pattern on the song's timeline at a bar.
- **What plays:**
  - **Drum tracks** play a pattern's **steps**. A drum track is a sample track with `melodic: false`.
  - **Synth tracks and melodic sample tracks** play a pattern's **notes**. The list a track doesn't use is ignored; leave it empty.
- **Pitch** is written as a **scale degree** in the song's key, not a MIDI note, so notes are always in key and changing the song's key transposes everything.
- **Knob values** are mostly normalized to the range 0–1, where 0 is a knob turned fully left and 1 fully right.

## Song

```jsonc
{
  "format": "simple-sequencer-song", // required, exactly this
  "version": 1, // required, exactly 1
  "id": "any-unique-text", // replaced with a new id when imported
  "name": "My song",
  "bpm": 120, // 40–220
  "swing": 0, // 0–0.75
  "key": { "root": 9, "scale": "minor" },
  "lengthBars": 16, // 1–128: where the song ends
  "tracks": [/* Track, … */],
  "createdAt": 1763600000000, // ms since 1970 (Date.now())
  "updatedAt": 1763600000000,
}
```

- **`swing`** delays every second 16th step by `swing × 1/8` of a beat. At 0.75 the off-16th lands well into a triplet feel. Patterns with 24 steps per bar (triplets) are never swung.
- **`key.root`** is 0 = C, 1 = C♯/D♭, 2 = D, … 9 = A, 10 = B♭, 11 = B.
- **`key.scale`** is one of:

  | scale             | notes from the root (semitones) | degrees per octave |
  | ----------------- | ------------------------------- | ------------------ |
  | `major`           | 0 2 4 5 7 9 11                  | 7                  |
  | `minor`           | 0 2 3 5 7 8 10                  | 7                  |
  | `dorian`          | 0 2 3 5 7 9 10                  | 7                  |
  | `mixolydian`      | 0 2 4 5 7 9 10                  | 7                  |
  | `harmonicMinor`   | 0 2 3 5 7 8 11                  | 7                  |
  | `majorPentatonic` | 0 2 4 7 9                       | 5                  |
  | `minorPentatonic` | 0 3 5 7 10                      | 5                  |

- **`lengthBars`** is where playback and export stop. Blocks after it don't play.

### Limits the editor keeps to

The file reader doesn't check these, but the editor never goes past them, so stay inside them:

- 16 tracks;
- 26 patterns per track (named A–Z);
- 6 effects per track.

## Track

```jsonc
{
  "id": "kick", // unique within the song
  "name": "Kick",
  "color": "#ff6b6b", // any CSS colour; the app uses #ff6b6b #ffb84d #ffe066 #5ee6a8 #4dc9ff #a78bfa #ff7ac6 #7ee0ff #c3f06b #ff9e6b #b9a6ff #6bf0d8
  "kind": "sample", // "sample" or "synth"
  "volumeDb": 0, // -60 … +6 (-60 = silent)
  "pan": 0, // -1 (left) … 1 (right)
  "mute": false,
  "solo": false,
  "patterns": [/* Pattern, … at least one */],
  "blocks": [/* Block, … */],
  "fx": [/* FxSlot, … in chain order */],
  "automation": [/* AutomationLane, … */],
  "humanize": 0.3, // optional, 0–1
  "duck": {/* optional, see below */},
  "sample": {/* required when kind = "sample" */},
  "synth": {/* required when kind = "synth" */},
}
```

- **`humanize`** (0–1, missing = 0) nudges each hit by up to ±12 ms and its loudness by up to ±20%, scaled by the value. Hits on the beat move half as much. The randomness is repeatable: the same song always plays and exports the same way.
- **`duck`** is the sidechain pump: this track gets quieter each time another track plays.
  ```json
  { "sourceId": "kick", "on": true, "amount": 0.7, "release": 2 }
  ```
  | field      | meaning                                                                                                  |
  | ---------- | -------------------------------------------------------------------------------------------------------- |
  | `sourceId` | The id of another track in this song. A missing track, or this track itself, removes the duck on import. |
  | `amount`   | 0–1, how far the volume dips (1 = silent at each hit). Quieter hits dip less.                            |
  | `release`  | How quickly the volume comes back, as an index: `0` = 1/16 note, `1` = 1/8, `2` = 1/4, `3` = 1/2.        |

### `sample`: sample track settings

```jsonc
{
  "sampleId": "lib:club-kick", // a built-in sound (lib: or dev:), or user:… from a .zip
  "melodic": false, // false = plays steps (drums); true = plays notes at pitch
  "rootMidi": 60, // the MIDI note the recording is at (use the sound's root note)
  "tone": 1, // 0–1 low-pass "Tone" knob; 1 = fully open
  "edit": {
    // every field is required
    "start": 0, // 0–1: where in the sound playback starts
    "end": 1, // 0–1, after start
    "reverse": false,
    "loop": false, // loop between loopStart and end while the note/step is held
    "loopStart": 0, // 0–1, between start and end
    "tuneSemitones": 0, // -24 … 24
    "fadeOut": 0, // 0–1: how much of each hit fades out ("Decay" knob)
    "normalize": false, // boost quiet sounds to full level
  },
}
```

- **Melodic samples** play at their recorded pitch when the note's MIDI pitch equals `rootMidi`, and are sped up or slowed down for other notes.
- In the [library table](#sample-library-lib-ids), sounds with a **root note** are meant for this. Set `melodic: true` and `rootMidi` to that number.
- An unknown `sampleId` doesn't stop the song from loading, but that track stays silent.

### `synth`: synth track settings

```jsonc
{
  "presetId": "warm-bass", // see the preset table
  "macros": { "tone": 0.55, "punch": 0.5, "space": 0.2, "length": 0.5 }, // all 0–1, all required
  "advanced": {}, // optional overrides, see below
}
```

| macro    | what it does                                                              |
| -------- | ------------------------------------------------------------------------- |
| `tone`   | Brightness: a low-pass filter from 200 Hz (0) to 12 kHz (1).              |
| `punch`  | Attack from slow to fast, plus a filter "pluck" of up to 3 octaves.       |
| `space`  | Built-in reverb, from none (0) up to 45% wet (1).                         |
| `length` | Decay from 0.1 to 2 s and release from 0.05 to 3 s, scaled by the preset. |

The new-track defaults are `tone 0.55, punch 0.5, space 0.2, length 0.5`.

**`advanced`** overrides what the preset and macros work out. Every field is optional. The reader only checks that each is a number (or, for `oscType`, a known name), so keep to sensible values:

| field                      | unit                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `oscType`                  | `sine` `triangle` `sawtooth` `square` `fmsine` `fatsawtooth` `fatsquare` `fattriangle` `amsine` `fmsquare` |
| `attack` `decay` `release` | seconds                                                                                                    |
| `sustain`                  | 0–1                                                                                                        |
| `filterCutoffHz`           | Hz: the voice filter's base cutoff                                                                         |
| `filterQ`                  | Resonance (about 0.5–10)                                                                                   |
| `filterEnvAmount`          | Octaves the filter opens on each note                                                                      |
| `vibratoRate`              | Hz                                                                                                         |
| `vibratoDepth`             | 0–1                                                                                                        |
| `glide`                    | Seconds to slide between notes (mono presets)                                                              |

An unknown `presetId` loads, but plays as the first preset (`warm-bass`).

## Pattern

```jsonc
{
  "id": "kick-A", // unique within the track
  "name": "A", // a single letter A–Z, as the app names them
  "lengthBars": 1, // 1, 2, 3 or 4
  "stepsPerBar": 16, // 16 = 16th notes, 24 = 16th-note triplets
  "steps": [
    { "index": 0, "velocity": 1 },
    { "index": 4, "velocity": 0.9, "chance": 0.5 },
  ],
  "notes": [{ "start": 0, "length": 4, "degree": 0, "velocity": 0.8 }],
}
```

- **Grid:** a 1-bar, 16-step pattern has steps 0–15, and a 4-bar one has 0–63. Step 4 is beat 2 and step 8 is beat 3. Indexes outside `0 … lengthBars × stepsPerBar − 1` never play.
- **`steps`** (drum tracks): one entry per hit. List each `index` once, in any order.
  - `velocity` is 0–1; the editor uses 0.1–1.
  - `chance` is optional, 0–1, the share of passes the hit plays on (0.5 = half the time). Missing means always. The editor uses 0.1–1.
- **`notes`** (synth and melodic sample tracks):
  - `start` is the step index.
  - `length` is in steps, at least 1. A note can run past the end of the pattern, but it's cut when the block ends.
  - `velocity` and `chance` work as for steps.
  - `degree` is the pitch, explained below.

### Degrees → pitch

`degree` counts scale notes up from the key's root in octave 3:

- Degree 0 is the root at MIDI `48 + key.root`. For example, A minor's degree 0 is A2, MIDI 57.
- Each step of 1 is the next note of the scale.
- In a 7-note scale, degree 7 is the root an octave up, and degree −7 is an octave down. In a pentatonic scale an octave is 5 degrees.
- The range is −64 to 64.
- A chord is several notes with the same `start`. For example, degrees `0, 2, 4` make the root triad.
- Synth presets then shift by their own **octave** (see the preset table). Bass presets play one octave lower.

```
midi = 48 + key.root + 12 × floor(degree / N) + scale[degree mod N]      (N = notes in the scale)
```

## Block

```json
{ "id": "kick-block-1", "patternId": "kick-A", "startBar": 0 }
```

- A block plays its pattern once, starting at `startBar` (0-based, at most 127) and lasting the pattern's `lengthBars`.
- **To repeat a pattern**, add a block per repeat. For example, a 1-bar pattern over 8 bars needs `startBar` 0 through 7.
- **Overlaps:** if two blocks overlap, the one that starts later wins for the bars they share.
- **Bad references:** blocks whose `patternId` isn't on the track are dropped on import.

## Effects (`fx`)

```json
{ "id": "pad-filter", "type": "filter", "enabled": true, "params": { "cutoff": 0.35 } }
```

- **Order:** effects run in list order.
- **`params`** values are all 0–1. Leave any out to use its default.
- **Reference:** the [effects table](#effects-fxtype-and-fxparams) lists each type's params, what 0 and 1 mean, and which can be automated.

## Automation (`automation`)

A lane moves one knob over time, either by following drawn points or by wobbling by itself (an LFO).

```jsonc
{
  "id": "pad-filter-lane", // unique within the track
  "target": { "kind": "fx", "fxId": "pad-filter", "param": "cutoff" },
  "visible": true, // whether the lane is shown open under the track
  "points": [
    { "bar": 0, "value": 0.3 },
    { "bar": 4, "value": 0.85 },
  ],
  "mode": "draw", // optional: "draw" (default) or "lfo"
  "lfo": {/* optional, used when mode = "lfo" */},
}
```

**Targets.** A track may have at most one lane per target.

| target                                                           | knob                  | value 0 … 1 means                                                                                |
| ---------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `{ "kind": "track", "param": "volume" }`                         | Track volume          | The fader position: 0 = silent, 0.5 ≈ −6 dB, 0.708 ≈ 0 dB, 1 = +6 dB. In dB: `20·log10(v²) + 6`. |
| `{ "kind": "track", "param": "pan" }`                            | Pan                   | 0 = left, 0.5 = centre, 1 = right.                                                               |
| `{ "kind": "synthMacro", "macro": "tone" }`                      | Synth Tone            | As the `tone` macro. Synth tracks only.                                                          |
| `{ "kind": "synthMacro", "macro": "space" }`                     | Synth Space           | As the `space` macro. Synth tracks only.                                                         |
| `{ "kind": "sampleTone" }`                                       | Sample Tone           | As `sample.tone`. Sample tracks only.                                                            |
| `{ "kind": "fx", "fxId": "…", "param": "…" }`                    | An effect knob        | The param's 0–1 value. Only params marked **auto** in the effects table.                         |
| `{ "kind": "lfo", "laneId": "…", "param": "amount" \| "speed" }` | Another lane's wobble | `amount` scales its depth. `speed` picks a rate step (0 = 1/16 note … 1 = 8 bars).               |

**Points:**

- `bar` is fractional and song-based: 0 is the start, 2.5 is halfway through bar 3 as the app shows it.
- **Sort points by `bar`.** Values ramp in a straight line between points, hold the first value before the first point, and hold the last value after the last point.
- Two points on the same `bar` make an instant jump to the second value.

**Wobble (LFO):** set `"mode": "lfo"` plus

```json
{ "shape": "sine", "rate": 4, "depth": 0.5, "center": 0.5 }
```

| field    | meaning                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------- |
| `shape`  | `sine` `triangle` `square` `rampUp` `rampDown` `random`                                         |
| `rate`   | Index: `0` 1/16 note, `1` 1/8, `2` 1/4, `3` 1/2, `4` 1 bar, `5` 2 bars, `6` 4 bars, `7` 8 bars. |
| `depth`  | 0–1, how far the knob swings (± depth/2 around the centre).                                     |
| `center` | 0–1, the middle of the swing.                                                                   |

- Wobbles are locked to the song's bars.
- `points` are kept, so switching the lane back to `draw` restores them.
- An `lfo` target must point at a lane on the same track. Lanes pointing at a missing effect or lane are dropped on import.

## Checklist for generated songs

`npm run validate-song` checks all of these for you.

- **Top level:** `format` and `version` are exactly `"simple-sequencer-song"` and `1`. `createdAt` and `updatedAt` are numbers.
- **Ids:** every id is unique where it needs to be: tracks in the song; patterns, blocks, fx and lanes in their track.
- **Track settings:** each track has at least one pattern, and its `sample` or `synth` object matches its `kind`. `sample.edit` has all eight fields, and `synth.macros` has all four.
- **What plays:** drum tracks use `steps` and synth or melodic tracks use `notes`. To repeat a pattern on the timeline, add more blocks.
- **Automation:** points are sorted by `bar`.
- **Sounds and presets:** use only the ids listed below, or `user:` sounds shipped in a `.zip`.

---

## Built-in sounds, presets and effects

<!-- catalog:start (generated by scripts/songFormatDoc.test.mjs; do not edit by hand) -->

### Sample library (`lib:` ids)

148 sounds in 10 kits. Use the **id** as `sample.sampleId`. For sounds with a **root note**, set `sample.rootMidi` to it (and usually `sample.melodic: true`) so notes play in tune; for everything else use `rootMidi: 60`.

#### Dusty Kit (`dusty`): Warm acoustic drums for lo-fi and boom-bap

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:dusty-kick` | Dusty Kick | Kicks | 0.69 s |  | CC0-1.0 (menegass) |
| `lib:dusty-kick-soft` | Soft Kick | Kicks | 0.56 s |  | CC0-1.0 (menegass) |
| `lib:dusty-kick-heavy` | Heavy Kick | Kicks | 0.27 s |  | CC0-1.0 (Zajo) |
| `lib:dusty-snare` | Dusty Snare | Snares | 0.44 s |  | CC0-1.0 (menegass) |
| `lib:dusty-snare-soft` | Soft Snare | Snares | 0.31 s |  | CC0-1.0 (menegass) |
| `lib:dusty-snare-dolf` | Crack Snare | Snares | 0.38 s |  | CC0-1.0 (Dolfeus) |
| `lib:dusty-hat` | Closed Hat | Hi-hats | 0.21 s |  | CC0-1.0 (menegass) |
| `lib:dusty-hat-pedal` | Pedal Hat | Hi-hats | 0.27 s |  | CC0-1.0 (menegass) |
| `lib:dusty-hat-open` | Open Hat | Hi-hats | 1.8 s |  | CC0-1.0 (menegass) |
| `lib:dusty-snap` | Finger Snap | Claps & snaps | 0.31 s |  | CC0-1.0 (SoundCollectah) |
| `lib:dusty-snap-2` | Snap 2 | Claps & snaps | 0.17 s |  | CC0-1.0 (Peram) |
| `lib:dusty-tom-lo` | Low Tom | Percussion | 0.86 s |  | CC0-1.0 (menegass) |
| `lib:dusty-tom-hi` | High Tom | Percussion | 0.63 s |  | CC0-1.0 (menegass) |
| `lib:dusty-cowbell` | Cowbell | Percussion | 0.35 s |  | CC0-1.0 (Neotone) |
| `lib:dusty-ride` | Ride | Cymbals | 3.0 s |  | CC0-1.0 (trivialAccapella) |
| `lib:dusty-crash` | Crash | Cymbals | 1.6 s |  | CC0-1.0 (menegass) |
| `lib:dusty-crash-soft` | Soft Crash | Cymbals | 0.95 s |  | CC0-1.0 (menegass) |
| `lib:dusty-splash` | Splash | Cymbals | 2.6 s |  | CC0-1.0 (menegass) |
| `lib:dusty-tom-mid` | Mid Tom | Percussion | 0.73 s |  | CC0-1.0 (menegass) |
| `lib:dusty-ride-jazz` | Jazz Ride | Cymbals | 4.0 s |  | CC0-1.0 (trivialAccapella) |

#### 808 Kit (`808`): Booming electronic drums for trap and hip-hop

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:808-kick` | 808 Kick | Kicks | 0.56 s |  | CC0-1.0 (EKVelika) |
| `lib:808-boom` | 808 Boom | Kicks | 1.7 s |  | CC0-1.0 (Snapper4298) |
| `lib:808-zum` | Zum Kick | Kicks | 0.13 s |  | CC0-1.0 (n1ghthawk) |
| `lib:808-snare` | Dub Snare | Snares | 0.28 s |  | CC0-1.0 (Adriak909) |
| `lib:808-snare-zome` | Snap Snare | Snares | 0.47 s |  | CC0-1.0 (Dolfeus) |
| `lib:808-snare-hi` | Tight Snare | Snares | 0.20 s |  | CC0-1.0 (looppool) |
| `lib:808-hat` | Tap Hat | Hi-hats | 0.17 s |  | CC0-1.0 (TheEndOfACycle) |
| `lib:808-hat-cats` | Tick Hat | Hi-hats | 0.35 s |  | CC0-1.0 (TheEndOfACycle) |
| `lib:808-hat-open` | Metal Open Hat | Hi-hats | 0.56 s |  | CC0-1.0 (Stereo surgeon) |
| `lib:808-clap` | Snap Clap | Claps & snaps | 0.17 s |  | CC0-1.0 (TheEndOfACycle) |
| `lib:808-clap-pop` | Pop Clap | Claps & snaps | 0.09 s |  | CC0-1.0 (looppool) |
| `lib:808-rim` | Wood Block | Percussion | 0.48 s |  | CC0-1.0 (looppool) |
| `lib:808-tick` | Tick | Percussion | 0.02 s |  | CC0-1.0 (looppool) |
| `lib:808-blip` | Blip | Percussion | 0.16 s |  | CC0-1.0 (looppool) |
| `lib:808-tom` | Fuzz Tom | Percussion | 0.37 s |  | CC0-1.0 (looppool) |

#### Club Kit (`club`): Punchy drums for house and dance

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:club-kick` | House Kick | Kicks | 0.22 s |  | CC0-1.0 (Rodrigo The Mad) |
| `lib:club-kick-klub` | Club Kick | Kicks | 0.35 s |  | CC0-1.0 (zgump) |
| `lib:club-kick-tek` | Tek Kick | Kicks | 0.24 s |  | CC0-1.0 (DWSD) |
| `lib:club-snare` | Club Snare | Snares | 0.54 s |  | CC0-1.0 (hullum) |
| `lib:club-snare-elec` | Electro Snare | Snares | 0.39 s |  | CC0-1.0 (looppool) |
| `lib:club-snare-mid` | Mid Snare | Snares | 0.70 s |  | CC0-1.0 (looppool) |
| `lib:club-hat` | Club Hat | Hi-hats | 0.23 s |  | CC0-1.0 (pjcohen) |
| `lib:club-hat-gnu` | Bright Hat | Hi-hats | 0.22 s |  | CC0-1.0 (gnuoctathorpe) |
| `lib:club-hat-open` | Open Hat | Hi-hats | 0.86 s |  | CC0-1.0 (lennartgreen) |
| `lib:club-clap` | Filtered Clap | Claps & snaps | 1.5 s |  | CC0-1.0 (looppool) |
| `lib:club-clap-flip` | Flip Clap | Claps & snaps | 0.07 s |  | CC0-1.0 (looppool) |
| `lib:club-perc-shaker` | Shaker | Percussion | 0.40 s |  | CC0-1.0 (medetix) |
| `lib:club-perc-bong` | Bong | Percussion | 0.35 s |  | CC0-1.0 (looppool) |
| `lib:club-perc-ping` | Ping | Percussion | 0.21 s |  | CC0-1.0 (looppool) |
| `lib:club-perc-triangle` | Triangle | Percussion | 0.22 s |  | CC0-1.0 (looppool) |

#### Analog Kit (`analog`): Small, crunchy electronic drums

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:analog-kick` | Pure Kick | Kicks | 0.43 s |  | CC0-1.0 (EKVelika) |
| `lib:analog-kick-sone` | Round Kick | Kicks | 0.41 s |  | CC0-1.0 (soneproject) |
| `lib:analog-kick-zome` | Deep Kick | Kicks | 0.46 s |  | CC0-1.0 (Dolfeus) |
| `lib:analog-snare` | Low Snare | Snares | 0.66 s |  | CC0-1.0 (looppool) |
| `lib:analog-hat` | Raw Hat | Hi-hats | 0.21 s |  | CC0-1.0 (cabled_mess) |
| `lib:analog-hat-mess` | Mess Hat | Hi-hats | 0.28 s |  | CC0-1.0 (cabled_mess) |
| `lib:analog-hat-open` | Gump Open Hat | Hi-hats | 0.45 s |  | CC0-1.0 (zgump) |
| `lib:analog-clap` | Tap Clap | Claps & snaps | 0.11 s |  | CC0-1.0 (The Black Dog) |
| `lib:analog-clap-2` | Tap Clap 2 | Claps & snaps | 0.11 s |  | CC0-1.0 (The Black Dog) |
| `lib:analog-perc-blip` | Blip | Percussion | 0.12 s |  | CC0-1.0 (The Black Dog) |
| `lib:analog-perc-hat` | Tick Perc | Percussion | 0.10 s |  | CC0-1.0 (The Black Dog) |
| `lib:analog-perc-plip` | Plip | Percussion | 0.20 s |  | CC0-1.0 (looppool) |
| `lib:analog-perc-twip` | Twip | Percussion | 0.10 s |  | CC0-1.0 (looppool) |
| `lib:analog-crash` | Electro Crash | Cymbals | 0.56 s |  | CC0-1.0 (looppool) |

#### Percussion (`perc`): Hand drums, shakers, bells and cymbals

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:perc-crash` | Big Crash | Cymbals | 4.0 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-cymbal-bell` | Cymbal Bell | Cymbals | 4.0 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-cymbal-swell` | Cymbal Swell | FX & risers | 4.0 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-rim-click` | Rim Click | Percussion | 0.76 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-rimshot` | Rimshot | Percussion | 1.5 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-tambourine` | Tambourine | Percussion | 0.73 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-claves` | Claves | Percussion | 0.43 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-cajon` | Cajón Bass | Percussion | 0.69 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-cajon-slap` | Cajón Slap | Percussion | 1.4 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-conga-open` | Conga Open | Percussion | 0.62 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-conga-mute` | Conga Muted | Percussion | 0.78 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-conga-low` | Low Conga | Percussion | 0.64 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-bongo-hi` | Bongo High | Percussion | 0.57 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-bongo-lo` | Bongo Low | Percussion | 0.54 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-agogo-hi` | Agogo High | Percussion | 0.42 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-agogo-lo` | Agogo Low | Percussion | 1.0 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-guiro` | Guiro | Percussion | 0.26 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-cabasa` | Cabasa | Percussion | 0.31 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-shaker-small` | Small Shaker | Percussion | 0.26 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-sleigh` | Sleigh Bells | Percussion | 1.6 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-triangle` | Triangle | Percussion | 3.9 s |  | CC0-1.0 (Versilian Studios & contributors) |
| `lib:perc-timpani` | Timpani | Percussion | 4.0 s |  | CC0-1.0 (Versilian Studios & contributors) |

#### Melodic (`melodic`): Basses, keys and bells you can play in tune

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:bass-hard` | Hard Bass | Melodic one-shots | 1.5 s | 36 | CC0-1.0 (ani_music) |
| `lib:bass-thick` | Thick Bass | Melodic one-shots | 4.0 s | 36 | CC0-1.0 (ani_music) |
| `lib:bass-woodsy` | Woody Bass | Melodic one-shots | 3.3 s | 36 | CC0-1.0 (ani_music) |
| `lib:keys-highkey` | High Keys | Melodic one-shots | 1.1 s | 60 | CC0-1.0 (The Black Dog) |
| `lib:bell-elec` | Electric Bell | Melodic one-shots | 0.28 s | 60 | CC0-1.0 (looppool) |
| `lib:piano-c2` | Piano C2 | Melodic one-shots | 6.0 s | 36 | CC-BY-3.0 (Alexander Holm) |
| `lib:piano-c3` | Piano C3 | Melodic one-shots | 6.0 s | 48 | CC-BY-3.0 (Alexander Holm) |
| `lib:piano-c4` | Piano C4 | Melodic one-shots | 6.0 s | 60 | CC-BY-3.0 (Alexander Holm) |
| `lib:piano-c5` | Piano C5 | Melodic one-shots | 6.0 s | 72 | CC-BY-3.0 (Alexander Holm) |
| `lib:fm-piano` | FM Piano | Melodic one-shots | 5.0 s | 48 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:clavisynth` | Clavi Synth | Melodic one-shots | 3.1 s | 48 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:marimba` | Marimba | Melodic one-shots | 1.2 s | 72 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:vibes` | Vibraphone | Melodic one-shots | 5.0 s | 60 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:glockenspiel` | Glockenspiel | Melodic one-shots | 2.3 s | 96 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:tubular-bells` | Tubular Bells | Melodic one-shots | 6.0 s | 72 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:harp` | Harp | Melodic one-shots | 5.0 s | 48 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:pipe-organ` | Pipe Organ | Melodic one-shots | 4.0 s | 60 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:harmonica` | Harmonica | Melodic one-shots | 4.0 s | 72 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:tenor-sax` | Tenor Sax | Melodic one-shots | 4.0 s | 60 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:ocarina` | Ocarina | Melodic one-shots | 4.0 s | 84 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:hand-chimes` | Hand Chimes | Melodic one-shots | 5.0 s | 72 | CC0-1.0 (Versilian Studios & contributors) |
| `lib:bass-trance` | Trance Bass | Melodic one-shots | 3.6 s | 36 | CC0-1.0 (ani_music) |
| `lib:bass-dnb` | DnB Bass | Melodic one-shots | 0.87 s | 29 | CC0-1.0 (Exsomniel) |

#### Guitars (`guitar`): Electric, acoustic and nylon guitars you can play in tune, plus chords and effects

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:gtr-clean` | Clean Electric | Guitars | 4.0 s | 45 | CC0-1.0 (Brian Wood) |
| `lib:gtr-hollow` | Hollow Electric | Guitars | 3.4 s | 45 | CC0-1.0 (Brian Wood) |
| `lib:gtr-muted` | Muted Electric | Guitars | 0.72 s | 45 | CC0-1.0 (Brian Wood) |
| `lib:gtr-mellow` | Mellow Electric | Guitars | 4.0 s | 57 | CC0-1.0 (D. Smolken) |
| `lib:gtr-archtop` | Archtop Electric | Guitars | 4.0 s | 57 | CC0-1.0 (D. Smolken) |
| `lib:gtr-acoustic` | Acoustic Guitar | Guitars | 4.0 s | 57 | CC0-1.0 (D. Smolken) |
| `lib:gtr-nylon` | Nylon Guitar | Guitars | 3.1 s | 57 | CC-BY-4.0 (quartertone) |
| `lib:gtr-banjo` | Guitar Banjo | Guitars | 1.1 s | 45 | CC0-1.0 (itsclipping) |
| `lib:gtr-power-chord` | Power Chord | Guitars | 4.0 s | 40 | CC0-1.0 (Sub-d) |
| `lib:gtr-minor9-chord` | Minor 9 Chord | Guitars | 5.0 s | 40 | CC0-1.0 (Sub-d) |
| `lib:gtr-slide` | Guitar Slide | Guitars | 4.3 s |  | CC0-1.0 (Suva) |
| `lib:gtr-harmonics` | Guitar Harmonics | Guitars | 3.5 s |  | CC0-1.0 (BStateham) |

#### Strings (`strings`): Violin, viola, cello, double bass and harp you can play in tune, bowed or plucked

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:str-violin` | Solo Violin | Strings | 6.0 s | 64 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-violin-pizz` | Violin Pizzicato | Strings | 1.5 s | 64 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-violins` | Violin Section | Strings | 6.0 s | 62 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-violins-trem` | Violin Tremolo | Strings | 6.0 s | 62 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-violins-pizz` | Violin Section Pizzicato | Strings | 1.2 s | 62 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-viola` | Viola Section | Strings | 6.0 s | 55 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-cello` | Cello Section | Strings | 6.0 s | 57 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-cello-pizz` | Cello Pizzicato | Strings | 2.0 s | 57 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-cello-spic` | Cello Spiccato | Strings | 1.0 s | 57 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-bass` | Double Bass | Strings | 6.0 s | 45 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-bass-pizz` | Double Bass Pizzicato | Strings | 2.5 s | 45 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |
| `lib:str-harp` | Harp | Strings | 4.0 s | 55 | CC0-1.0 (Versilian Studios (Sam Gossner) / Ivy Audio (Simon Dalzell)) |

#### FX (`fx`): Risers, scratches and swooshes

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:bell-chime` | Chime | FX & risers | 2.3 s |  | CC0-1.0 (looppool) |
| `lib:pluck-twang` | Twang | FX & risers | 0.62 s |  | CC0-1.0 (looppool) |
| `lib:fx-backspin` | Vinyl Backspin | FX & risers | 1.1 s |  | CC0-1.0 (il112) |
| `lib:fx-rewind` | Vinyl Rewind | FX & risers | 2.7 s |  | CC0-1.0 (TasmanianPower) |
| `lib:fx-scratch` | Scratch | FX & risers | 0.27 s |  | CC0-1.0 (hello_flowers) |
| `lib:fx-hiss` | Vinyl Hiss | FX & risers | 6.0 s |  | CC0-1.0 (veezay) |
| `lib:fx-swoosh` | Swoosh | FX & risers | 0.35 s |  | CC0-1.0 (hullum) |
| `lib:fx-swash` | Swash | FX & risers | 0.32 s |  | CC0-1.0 (qubodup) |
| `lib:fx-impact` | Impact | FX & risers | 1.1 s |  | CC0-1.0 (hullum) |
| `lib:fx-riser` | Dark Riser | FX & risers | 3.7 s |  | CC0-1.0 (EcoDTR) |
| `lib:fx-windchimes` | Wind Chimes | FX & risers | 5.0 s |  | CC0-1.0 (Versilian Studios & contributors) |

#### Vocals (`vocal`): Voices and vocal tones

| id | name | category | length | root note | license |
|---|---|---|---|---|---|
| `lib:vox-tone` | Vocal Tone | Vocal chops | 3.7 s | 74 | CC0-1.0 (The Black Dog) |
| `lib:vox-choir` | Choir Ahh | Vocal chops | 1.6 s |  | CC0-1.0 (Exsomniel) |
| `lib:vox-robot` | Robot Voice | Vocal chops | 0.93 s |  | CC0-1.0 (hullum) |
| `lib:vox-glitch` | Glitch Voice | Vocal chops | 1.0 s |  | CC0-1.0 (hullum) |

### Built-in test sounds (`dev:` ids)

Simple sounds generated by code. They always load, even offline: `dev:kick`, `dev:snare`, `dev:hat`, `dev:tone`.

### Synth presets (`synth.presetId`)

**Octave** is added on top of the note: a bass preset with −1 plays degree 0 one octave lower. **Mono** presets play one note at a time (a new note cuts the last one).

| presetId | name | category | oscillator | octave | voices |
|---|---|---|---|---|---|
| `warm-bass` | Warm Bass | Bass | sawtooth | -1 | mono |
| `sub-bass` | Sub Bass | Bass | sine | -1 | mono |
| `reese-bass` | Reese Bass | Bass | fatsawtooth | -1 | mono |
| `dusty-keys` | Dusty Keys | Keys | triangle | 0 | poly |
| `electric-piano` | Electric Piano | Keys | fmsine | 0 | poly |
| `soft-pad` | Soft Pad | Pads | fatsawtooth | 0 | poly |
| `soft-pluck` | Soft Pluck | Plucks & bells | triangle | +1 | poly |
| `bright-lead` | Bright Lead | Leads | sawtooth | +1 | mono |
| `bell` | Bell | Plucks & bells | fmsine | +1 | poly |
| `retro-square` | Retro Square | Leads | square | 0 | mono |
| `acid-bass` | Acid Bass | Bass | sawtooth | -1 | mono |
| `growl-bass` | Growl Bass | Bass | fmsquare | -1 | mono |
| `organ` | Organ | Keys | fatsquare | 0 | poly |
| `strings` | Strings | Pads | fatsawtooth | 0 | poly |
| `choir-pad` | Choir Pad | Pads | amsine | 0 | poly |
| `supersaw` | Supersaw Lead | Leads | fatsawtooth | 0 | poly |
| `brass-stab` | Brass Stab | Leads | sawtooth | 0 | poly |
| `chiptune` | Chiptune | Leads | square | +1 | mono |
| `arp-pluck` | Arp Pluck | Plucks & bells | sawtooth | 0 | poly |
| `mallet` | Mallet | Plucks & bells | fattriangle | 0 | poly |

### Effects (`fx[].type` and `fx[].params`)

Every param is a number from 0 to 1; a missing param uses its default. **Range** shows what 0, the default and 1 mean. Params marked **auto** can be automated with an `fx` lane.

#### `reverb`: Reverb. Makes it sound like a room or hall

| param | label | default | range | auto |
|---|---|---|---|---|
| `size` | Size | 0.5 | 0 = Room; default = Hall; 1 = Huge | auto |
| `amount` | Amount | 0.3 | 0 = 0%; default = 30%; 1 = 100% | auto |
| `predelay` | Pre-delay | 0.1 | 0 = 0 ms; default = 10 ms; 1 = 100 ms |  |

#### `delay`: Delay. Echoes that repeat in time with the song

| param | label | default | range | auto |
|---|---|---|---|---|
| `time` | Time | 0.4 | 0 = 1/16; default = 3/16; 1 = 1/2 | auto |
| `amount` | Amount | 0.25 | 0 = 0%; default = 25%; 1 = 100% | auto |
| `feedback` | Repeats | 0.4 | 0 = 0%; default = 34%; 1 = 85% |  |
| `pingpong` | Ping-pong | 0 | Off = 0, On = 1 |  |

#### `filter`: Filter. Make it darker or thinner

| param | label | default | range | auto |
|---|---|---|---|---|
| `cutoff` | Cutoff | 0.6 | 0 = Darker · 40 Hz; default = 1.6 kHz; 1 = 18.0 kHz | auto |
| `resonance` | Resonance | 0.2 | 0 = 0.5; default = 1.0; 1 = 15.0 | auto |
| `type` | Type | 0 | Low-pass = 0, High-pass = 0.5, Band-pass = 1 |  |

#### `distortion`: Distortion. Grit, warmth or crunch

| param | label | default | range | auto |
|---|---|---|---|---|
| `drive` | Drive | 0.4 | 0 = 0%; default = 40%; 1 = 100% | auto |
| `amount` | Amount | 0.5 | 0 = 0%; default = 50%; 1 = 100% | auto |
| `oversample` | Smoothing | 0.5 | Off = 0, 2× = 0.5, 4× = 1 |  |

#### `compressor`: Compressor. Evens out loud and quiet parts so it sounds tighter

| param | label | default | range | auto |
|---|---|---|---|---|
| `squash` | Squash | 0.5 | 0 = 0%; default = 50%; 1 = 100% | auto |
| `makeup` | Boost | 0.3 | 0 = 0.0 dB; default = +3.6 dB; 1 = +12.0 dB | auto |
| `attack` | Attack | 0.35 | 0 = 1 ms; default = 7 ms; 1 = 300 ms |  |
| `release` | Release | 0.4 | 0 = 20 ms; default = 96 ms; 1 = 1.0 s |  |

#### `eq`: EQ. Turn up or down the lows, mids and highs

| param | label | default | range | auto |
|---|---|---|---|---|
| `low` | Low | 0.5 | 0 = -12.0 dB; default = 0.0 dB; 1 = +12.0 dB | auto |
| `high` | High | 0.5 | 0 = -12.0 dB; default = 0.0 dB; 1 = +12.0 dB | auto |
| `mid` | Mid | 0.5 | 0 = -12.0 dB; default = 0.0 dB; 1 = +12.0 dB |  |
| `lowFreq` | Low edge | 0.4 | 0 = 100 Hz; default = 230 Hz; 1 = 800 Hz |  |
| `highFreq` | High edge | 0.5 | 0 = 1.5 kHz; default = 3.7 kHz; 1 = 9.0 kHz |  |

#### `chorus`: Chorus. Wide, shimmering, doubled sound

| param | label | default | range | auto |
|---|---|---|---|---|
| `width` | Width | 0.5 | 0 = 0%; default = 50%; 1 = 100% | auto |
| `amount` | Amount | 0.5 | 0 = 0%; default = 50%; 1 = 100% | auto |
| `rate` | Speed | 0.3 | 0 = 0.1 Hz; default = 0.4 Hz; 1 = 8.0 Hz |  |

#### `bitcrush`: Bitcrush. Lo-fi, retro, crunchy digital sound

| param | label | default | range | auto |
|---|---|---|---|---|
| `crush` | Crush | 0.5 | 0 = 16-bit; default = 9-bit; 1 = 2-bit | auto |
| `amount` | Amount | 0.5 | 0 = 0%; default = 50%; 1 = 100% | auto |
| `down` | Downsample | 0 | 0 = Off; default = Off; 1 = 20× |  |

<!-- catalog:end -->
