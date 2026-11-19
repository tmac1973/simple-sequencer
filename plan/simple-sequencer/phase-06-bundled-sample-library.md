# Phase 06 — Bundled sample library, sound browser, credits

**Depends on:** 03, 04, 05 (melodic one-shots carry a `rootNote` used by melodic mode) · **Enables:** 07 (custom sounds join the same browser), 10 (templates use bundled kits), 12 (export resolves library samples)

## Goal
Ship a curated, legally redistributable sample library: 4 drum kits plus melodic, FX and vocal one-shots, ≤ 15 MB, as mono 44.1 kHz 16-bit **FLAC** (lossless, no MP3/AAC encoder delay to throw off drum timing, and decodable by Chrome, Firefox and Safari). Add a manifest that carries per-file license metadata, lazy per-kit loading, the Sound browser modal (categories, search, preview) and the Credits modal. This replaces the `dev:` sounds as defaults.

## Sources (decided)
CC0 and CC-BY only. Each was checked during planning by reading the license on its source page; the build script re-checks each file.

| Kit / set | Source | License | Use |
|---|---|---|---|
| **Dusty Kit** (lo-fi/acoustic) | Freesound: menegass "Guigui acoustic drum set" + "Rick Acoustic Drum" packs; Sonic Pi `perc_snap`, `vinyl_hiss` | CC0 | kick, snare, hats, toms, cymbal, snap, vinyl FX |
| **808 Kit** (trap/hip-hop) | Sonic Pi `bd_808`, `bd_boom`, `bass_*` subs; Freesound Uberproduktion "Filthy Drums 808 Analog Drum Hits" | CC0 | kicks, 808 subs, snare, rim, hats, cowbell, congas |
| **Club Kit** (house) | Sonic Pi `bd_haus`, `bd_klub`, `bd_tek`; Freesound waveplaySFX "Claps & Snares"; AKUSTIKA "Analog Juice Drumkit" hats | CC0 | four-on-floor kicks, claps, open/closed hats |
| **Analog 606 Kit** | Freesound oceansonmars "Modified 606" | CC0 | kicks, snares, hats, cymbals |
| **Melodic one-shots** | Sonic Pi `bass_*`, `elec_*` (plucks/bells); VCSL (github.com/sgossner/VCSL) TX81Z keys and bass, kalimba (single notes) | CC0 | melodic samples (melodic mode) |
| **Piano** | Salamander Grand Piano (github.com/sfzinstruments/SalamanderGrandPiano), one medium velocity layer, 4 single-note one-shots: "Piano C2", "Piano C3", "Piano C4", "Piano C5" (separate sounds, each with its `rootNote`; a track uses one and repitches it in melodic mode) | **CC-BY 3.0**: attribution "Salamander Grand Piano by Alexander Holm" | melodic piano |
| **FX & risers** | Freesound waveplaySFX "Impacts/Hits for EDM" + "FX/One-shots"; Sonic Pi `vinyl_backspin`, `vinyl_rewind`, `vinyl_scratch` | CC0 | FX |
| **Vocal chops** | Freesound f-r-a-g-i-l-e "Vocal Chops": **only** the author's own "contact samples" and "Blip" chops | CC0 | vocal chops |

**Excluded** (recorded in `samples-src/EXCLUDED.md`): 99Sounds and Bedroom Producers Blog packs (their terms forbid redistribution); tidal-drum-machines and Dirt-Samples (no license, commercial-hardware sources); Hydrogen TR808EmulationKit (GPL); `@fluid-music/tr-909` and oramics/sampled (unclear provenance); the bdu TR606 re-upload; Sonic Pi `loop_amen*` and `loop_breakbeat` (sampled from records); f-r-a-g-i-l-e "Killer Queen", "Peggy" and "Vintage" chops (copyrighted sources).

## Files touched
- `samples-src/sources.json`: the source of truth, one entry per file: `{ id, kit, category, name, sourceUrl, downloadUrl, author, license ('CC0-1.0' | 'CC-BY-3.0' | 'CC-BY-4.0'), licenseUrl, trimMs?, gainDb?, rootNote? (MIDI), templateRole? }`. Freesound entries record the per-sound URL, since Freesound shows the license per sound, not per pack.
- `samples-src/EXCLUDED.md`: the exclusion list above, with reasons.
- `scripts/build-samples.mjs`: a developer script (run manually, not in CI). It downloads each `downloadUrl` into `samples-src/raw/` (gitignored). For Freesound, it uses the Freesound API with a developer token from the `FREESOUND_TOKEN` env var and asserts that the API's `license` field matches `sources.json`, stopping on any mismatch. It then converts with `ffmpeg` (mono, 44.1 kHz, 16-bit, silence-trimmed at −50 dB, peak-normalized to −1 dBFS, max 4 s for drums and 6 s for melodic) to `public/samples/<kit>/<id>.flac`, and writes `public/samples/manifest.json`. It fails if the total exceeds 15 MB.
- `public/samples/**`: the generated FLAC files (committed).
- `public/samples/manifest.json`: `{ version: 1, kits: [{ id, name, description }], samples: [{ id, kit, category, name, file, durationMs, author, license, sourceUrl, rootNote?, templateRole? }] }`. `rootNote` is a MIDI note number, copied into `sample.rootMidi` when the sound is chosen. Categories: Kicks, Snares, Hi-hats, Claps & snaps, Percussion, FX & risers, Melodic one-shots, Vocal chops.
- `src/library/manifest.ts`: fetches and caches the manifest; `searchSamples(query, category)` (name + kit + category, case-insensitive).
- `src/library/libraryResolver.ts`: registers resolver prefix `lib:` in `SampleRegistry`, which fetches the `.flac` and calls `decodeAudioData`. `preloadKit(kitId)` loads a kit's files in parallel when a song referencing it opens.
- `src/ui/modals/SoundBrowserModal.tsx`: layout as in the mock. Left column: categories with counts, plus "⭐ My Sounds" (empty state "Import or record your own sounds", filled in phase 07). Search box; list rows with ▶ preview (plays immediately via a dedicated preview channel), name, kit and license badge. "Use this sound" sets the track's `sampleId` and `rootMidi` (from `rootNote`, else 60) as one undo step, and resets `edit` to defaults. Footer link to Credits. The import/record dropzone renders disabled with the tooltip "Available soon" until phase 07.
- `src/ui/modals/CreditsModal.tsx`: groups the manifest by source; lists every CC-BY item first with author, source link and license link; then a CC0 thank-you list; then a section for third-party code licenses (populated from `src/credits/codeLicenses.ts`).
- `src/credits/codeLicenses.ts`: static list of every runtime dependency so far (React, Tone.js, Zustand, Immer, nanoid, dnd-kit) with license names. Every later phase that adds a runtime dependency appends it here.
- `src/ui/inspector/SampleSoundTab.tsx`: sound card subtitle shows "Kit · License"; "Change sound" opens the browser.
- `src/App.tsx`: default startup song now uses Dusty Kit samples instead of `dev:`. The `dev:` generator stays, for tests only.
- `.gitignore`: `samples-src/raw/`.
- Tests: `manifest.test.ts` (search, categories), `scripts/build-samples.test.mjs` (validates `sources.json`: every entry has a license in the allowed set and a sourceUrl; no duplicate ids), `CreditsModal.test.tsx` (every CC-BY sample appears with its author), `libraryResolver.audio.test.ts` (browser mode: decodes one FLAC from `public/samples`), `tests/e2e/browser.spec.ts`.

## Steps
1. **Curate `sources.json`.** This is the one curation step in the phase; its output, the committed `sources.json`, is the authoritative file list. The rules are fixed:
   - **Sources:** only the packs in the table above.
   - **Counts per drum kit:** a target of 3 kicks, 3 snares, 2 closed hats, 1 open hat, 2 claps/snaps and 4 percussion.
     - If a kit's own packs can't fill a slot, fill it from the other CC0 sources in the table, in this order: Sonic Pi `perc_*`/`elec_*` files, then waveplaySFX claps, then AKUSTIKA percussion.
     - If a slot still can't be filled, ship the kit with fewer sounds in that category. Every kit must still have at least 1 kick, 1 snare, 1 closed hat and 1 clap/snap.
   - **Melodic and other counts:** 9 melodic one-shots (3 basses, 3 keys, 3 plucks/bells, each with `rootNote`), the 4 piano notes, 8 FX and 6 vocal chops.
   - **Which files:** within a pack, prefer files under 4 s with a clean start, and pick the most distinct-sounding candidates by listening.
   - **Sonic Pi:** these named files are fixed: `bd_808`, `bd_boom`, `bd_haus`, `bd_klub`, `bd_tek`, `perc_snap`, `vinyl_hiss`, `vinyl_backspin`, `vinyl_rewind`, `vinyl_scratch`.
   - **Template sounds:** the House percussion comes from the AKUSTIKA pack, and the Hip-hop vocal chop is a f-r-a-g-i-l-e "Blip" chop. Mark them with `"templateRole": "house-perc"` and `"templateRole": "hiphop-chop"` so phase 10 can reference them by role. While choosing, open each Freesound sound page, confirm the license line reads Creative Commons 0 (or the stated CC-BY), and drop any file that doesn't.
2. Write and run `build-samples.mjs` (requires `ffmpeg` on PATH and a free Freesound API token). Commit the generated `public/samples`.
3. Implement manifest loading, the `lib:` resolver and kit preloading.
4. Build SoundBrowserModal and CreditsModal per the mock.
5. Switch default sounds to library samples.
6. Add `.flac` to the Vite asset handling (served from `public/`, no import needed).
7. Tests listed above.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`, plus `du -sh public/samples` ≤ 15 MB.

## Test plan
- Automated tests above pass.
- Manual: in Chrome, Firefox and Safari, every sample in the browser previews (proves FLAC decoding). Search "kick" finds kicks across kits. Swapping a track's sound takes effect on the next hit. Credits lists Salamander with attribution. The first load fetches only the manifest + one kit (check the network panel).

## Commit
`feat(library): bundled CC0/CC-BY sample kits, sound browser and credits`

## Rollback
Revert the commit, which restores the `dev:` default sounds. `public/samples` is static data, safe to remove. Re-running the build script is idempotent.
