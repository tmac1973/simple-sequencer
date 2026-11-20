# Simple Sequencer

An approachable, browser-based multitrack beat sequencer. Build songs from drum and synth
tracks, patterns and a song timeline, with no account and no server.

**▶ Try it: https://tmac1973.github.io/simple-sequencer/**

![Simple Sequencer](docs/screenshot.png)

## What you can do

- **Start playing straight away** with five ready-made templates: Lo-fi Beat, House, Hip-hop, Trip-hop and Empty.
- **💡 Ideas**: a library of 106 ready-made grooves, fills, percussion, basslines, chords and melodies. Preview one, then drop it into your song. It fits your key and picks matching sounds.
- **Drum and sample tracks** use a step grid. Drag up or down on a step to make it louder or softer. "Show all drums" shows the whole kit at once.
- **Synth tracks** have 20 presets (from acid bass and supersaw to strings, organ and chiptune) and 4 friendly knobs (Tone, Punch, Space, Length), plus an Advanced drawer. Notes go in a **scale-locked piano roll**, so a note can't sound wrong, and a **chord stamp** places whole chords in one click.
- **Patterns** (A, B, C…, 1–4 bars, 16ths or triplets) are painted onto a **song timeline**.
- **Song arranging**: right-click a bar number to insert, duplicate or delete 1, 4 or 8 bars anywhere in the song, and everything after it moves along.
- **Loop a section**: drag along the bar numbers to loop just those bars in Song mode while you work on them; 🔁 Loop turns it on and off, and export can render just the loop.
- **Play from your keyboard**: the letter keys play the selected track, always in key (A–L, Q–P an octave up, Z/X to change octave), or finger-drum every drum track at once.
- **MIDI keyboards**: plug one in and play (Chrome, Edge, Firefox); notes snap to the song's key and drum pads play each drum.
- **● Rec**: count in, loop the pattern with a click, and record what you play from either keyboard. Each pass adds notes and one undo removes the whole take.
- **Melodic samples**: play any sound in tune in the piano roll (piano, vocal chop…).
- **148 built-in sounds**: 4 drum kits, a percussion kit (crash, tambourine, congas, bongos, claves…), guitars (clean, hollow-body and muted electric, acoustic, nylon, banjo, chords and slides), strings (violin, viola, cello and double bass, bowed and pizzicato, plus harp), and melodic, FX and vocal sounds. All are CC0 or CC-BY.
- **Your own sounds**: import WAV, MP3, OGG or FLAC, or **record from your microphone**.
- **Sample editor**: trim, reverse, tune, loop, fade and normalize. Edits never change the original file.
- **Sidechain pump**: 💓 Pump to the kick makes a track dip each time the kick hits and swell back, the classic house "breathing" sound (any track can duck to any other).
- **Chance and humanize**: give a step or note a chance of playing so loops vary each time round, and humanize a track so its timing and loudness feel played, not programmed. Exports match what you hear.
- **Effects**: 8 curated effects per track (Reverb, Delay, Filter, Distortion, Compressor, EQ, Chorus, Bitcrush), each reorderable by drag. An always-on limiter stops the song from distorting.
- **Automation lanes**: draw how a knob moves over the song.
- **Wobble (LFO) lanes**: switch any lane to Wobble and the knob moves up and down by itself, in time with the song. Pick from 6 shapes and speeds from a 1/16 note to 8 bars, or use a one-click quick wobble (wobble bass, tremolo, auto-pan, slow sweep). The wobble's amount and speed can be automated too.
- **Share links**: 🔗 Share turns your song into a link. Whoever opens it gets the song in their browser, with no account or server. Sounds you recorded or imported are swapped for similar built-in ones.
- **Saving and export**: autosave in your browser, a song library, `.json`/`.zip` song files, and **WAV/MP3 export**.
- **Make songs with code**: the song file format, plus every built-in sound, synth preset and effect, is documented in [docs/SONG_FORMAT.md](docs/SONG_FORMAT.md). There are runnable examples in [docs/examples/](docs/examples/), including a showcase song that uses every option, and `npm run validate-song -- file.json` checks a song file before you load it.
- **Help as you go**: undo/redo, keyboard shortcuts (press `?`), and a plain-English tooltip on every control.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL in Chrome, Firefox or Safari on a desktop.

## Test

```bash
npm run typecheck && npm run lint && npm test   # unit + Web Audio tests (headless Chromium)
npm run e2e        # Playwright: Chromium, Firefox, WebKit
npm run e2e:local  # Chromium + Firefox only (for hosts where WebKit can't launch)
npm run e2e:perf   # stress-song performance check (run alone; timing-sensitive)
```

The manual listening checklist is in [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md).

## Deploy (GitHub Pages)

The live app at https://tmac1973.github.io/simple-sequencer/ is deployed this way.

1. Create a GitHub repository and push `main`.
2. In the repository settings, go to **Pages** and set **Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/`.

The build uses relative paths, so `dist/` can also be served from any static host. Microphone
recording needs HTTPS (or localhost).

## Sounds and licenses

- **App code**: MIT.
- **Built-in sounds**: listed in `samples-src/sources.json`, each with its source, author and license.
  - Most are **CC0** (public domain): the Sonic Pi sample library (originally from freesound.org), the Versilian Community Sample Library, VS Chamber Orchestra 2: Community Edition (Versilian Studios and Ivy Audio), and Karoryfer Samples' guitar libraries.
  - The piano is the **Salamander Grand Piano** by Alexander Holm (**CC-BY 3.0**), and the nylon guitar is by quartertone on freesound.org (**CC-BY 4.0**). Both are credited in the app.
- **Excluded sources**: anything considered and rejected is listed with reasons in `samples-src/EXCLUDED.md`.
- **Rebuilding the library**: run `node scripts/build-samples.mjs` (needs `ffmpeg`). Entries with a `freesoundId` also need a free Freesound API token in `FREESOUND_TOKEN`.
- **MP3 encoder**: MP3 export uses [lamejs](https://github.com/shijinyu/lamejs) (**LGPL-3.0**). It ships unmodified as a separate file (`mp3.worker-*.js`) that only loads when you export an MP3.
