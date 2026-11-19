# Phase 12 — Audio export (WAV + MP3)

**Depends on:** 03, 05, 06, 07, 08, 09, 11 · **Enables:** 13 (final QA covers export)

## Goal
Render the whole song, or the current pattern loop repeated N times, offline through the exact same engine (voices, sample edits, effects, automation, limiter). Export it as WAV (16- or 24-bit) or MP3 (128/192/320 kbps) from the Export modal in the approved mock, with progress and cancel. The modal also hosts "Save song file" from phase 11.

## Files touched
- `package.json`: add `@breezystack/lamejs` (**LGPL-3.0**, the maintained ESM fork of lamejs). It's used unmodified and only through a dynamic `import()` so it ships as a separate lazy chunk. Allowed per the overview decision on the MP3 encoder license.
- `src/export/render.ts`: `renderSong({ range: 'song' | { loopRepeats: 1 | 2 | 4 | 8 }, sampleRate: 44100 }) → Promise<AudioBuffer>`.
  - It computes the duration as range bars × bar seconds + a **tail**, capped at 10 s. The tail is the largest of three values:
    - the longest enabled Reverb decay;
    - for each enabled Delay, `delayTimeSec × ln(0.001) / ln(feedback)` (the time to decay 60 dB, using feedback 0.05 when feedback is 0);
    - 2 s.
  - It preloads all referenced sample buffers through `SampleRegistry` before rendering.
  - Rendering calls `Tone.Offline(ctx => engine.buildOffline(song, ctx, range), duration, 2, 44100)`. That calls `scheduler.scheduleBeat` for every beat in the range, so notes, sample hits and automation ramps all use the live code path. It also loads the Bitcrush worklet into the offline context.
  - Pattern-loop range uses the phase-03 loop-region rule for the current selection at export time.
- `src/export/mp3.ts`: `encodeMp3(buffer, kbps, onProgress, signal)`. It loads lamejs lazily and encodes in 1152-sample frames inside a **Web Worker** (`src/export/mp3.worker.ts`, Vite `?worker`) so the UI stays responsive. It supports cancel via `AbortSignal`.
- `src/audio/wav.ts` (from phase 07): `encodeWav` is reused for 16/24-bit stereo.
- `src/export/exportController.ts`: `runExport(options)` → stages `'rendering' | 'encoding' | 'done'` with 0–1 progress. Rendering progress is estimated from elapsed vs expected time, since `Tone.Offline` has no progress events; encoding progress is exact. It produces the filename `<song name> - <YYYY-MM-DD>.<wav|mp3>`, triggers a download via an object URL, and revokes the URL after 60 s.
- `src/ui/modals/ExportModal.tsx`: as in the mock.
  - Format cards: MP3 is the default, with a quality select (Good 128 / **High 192 (default)** / Best 320); WAV offers a 16-bit (default) or 24-bit select.
  - Range cards: "Whole song" (shows bars and duration) or "Current pattern loop" with repeat 1/2/4/8× (default 4×).
  - A progress bar with stage text and a Cancel button, plus an error toast on failure.
  - The section "Song file, to back up or open on another computer" has a "💾 Save song file" button calling `exportSongFile` (its label says `.zip` and "Includes your custom sounds" when custom sounds are used, `.json` otherwise).
  - The primary button reads "Export MP3" or "Export WAV".
- `src/ui/layout/TopBar.tsx`: "⤓ Export" opens the modal and stops playback first.
- `src/credits/codeLicenses.ts`: add lamejs (LGPL-3.0) with a link to its source repository and a note that it's loaded unmodified as a separate file.
- Tests:
  - `render.audio.test.ts` (browser mode): renders a 1-bar dev-sample song in an offline context. The first kick transient lands at sample 0 ±64, the length equals bars + tail, the master limiter + safety clipper keep peak ≤ −0.3 dBFS for a 10-track stacked test song, and an automation lane changes RMS between halves.
  - `wav.test.ts`: 24-bit added.
  - `mp3.audio.test.ts` (browser mode, Chromium): encodes 1 s of a 440 Hz sine, decodes it back with `decodeAudioData`, and asserts a duration of 1 s ±50 ms and a dominant frequency of 440 Hz ±2%.
  - `tests/e2e/export.spec.ts`: exports WAV and MP3 of the Lo-fi template's loop and asserts a download with a non-trivial size; decodes the WAV and checks duration.

## Steps
1. Confirm `engine.buildOffline(song, ctx, range)` (phase 03) covers both range types. Pattern-loop range repeats the loop region `loopRepeats` times by iterating beat indices across the repeats.
2. Implement `render.ts` with tail computation and preloading.
3. Implement the MP3 worker and lazy loading; confirm in the build output that lamejs is in its own chunk.
4. Implement `exportController` and `ExportModal`.
5. Tests above.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`, and confirm `dist/assets` contains lamejs only in a separate chunk (not in the main bundle).

## Test plan
- Automated tests above pass.
- Manual: export each template as MP3 and WAV in Chrome, Firefox and Safari, then play the files in a normal media player and compare by ear with live playback. Timing, swing, effects, automation and sample edits all match, reverb tails aren't cut off, and there's no clipping. Cancel mid-render stops cleanly. Export of a 128-bar song completes and the UI stays responsive.

## Commit
`feat(export): offline wav and mp3 export of song or pattern loop`

## Rollback
Revert the commit, which removes the export path and the lamejs dependency. Song data is untouched; "Save song file" falls back to the phase-11 library row action.
