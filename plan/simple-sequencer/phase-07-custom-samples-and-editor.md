# Phase 07 — Custom samples (import, mic recording) and the sample editor

**Depends on:** 02, 03, 04, 05 (melodic mode note lengths), 06 · **Enables:** 11 (song files bundle custom samples), 12 (export applies sample edits)

## Goal
Let users bring their own sounds, by importing audio files or recording from the microphone, stored in IndexedDB under "My Sounds". Add the non-destructive sample editor (trim, reverse, tune, loop, fade-out, normalize) from the approved mock, and make every `SampleEdit` field plus the Tone knob audible in the engine.

## Files touched
- `package.json`: add `idb` (ISC) and dev dependency `fake-indexeddb`.
- `src/credits/codeLicenses.ts`: add `idb` (ISC).
- `src/storage/db.ts`: opens IndexedDB `simple-sequencer`, **version 1**, creating **both** object stores used by the app so phase 11 needs no schema upgrade: `samples` (key `id`; value `{ id, name, mime, bytes: Blob, hash (SHA-256 hex of the bytes, computed via `crypto.subtle.digest` in `addUserSample`), durationMs, createdAt }`, with index `hash`) and `songs` (key `id`; value `{ id, name, updatedAt, bpm, trackCount, song }`, index `updatedAt`). It also exports `StorageQuotaError` and wraps `QuotaExceededError` into it.
- `src/storage/userSamples.ts`: `addUserSample(name, blob)`, `listUserSamples()`, `getUserSampleBlob(id)`, `renameUserSample`, `deleteUserSample` (refused with the message "Used by: <track names>" if the current song references it; phase 11 extends the check to all saved songs).
- `src/library/userResolver.ts`: registers the `user:` prefix in `SampleRegistry` (IndexedDB blob → `decodeAudioData`).
- `src/audio/recorder.ts`: `startRecording()` uses `getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}})` and `MediaRecorder` with the browser's default mime; returns `{ stop(): Promise<Blob>, level$: () => number }` (an `AnalyserNode` RMS for the meter). Max length 30 s with auto-stop. After stop, the blob is decoded and **re-encoded to 16-bit WAV** (`src/audio/wav.ts`) so recordings are portable across browsers.
- `src/audio/wav.ts`: `encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24): Blob` (also used by export in phase 12).
- `src/audio/import.ts`: accepts `.wav .mp3 .ogg .flac .m4a .aac` up to 20 MB and 60 s. Decodes first to validate; on failure the toast reads "This file couldn't be read. Try WAV or MP3." The original bytes are stored as-is.
- `src/audio/voices/sampleVoice.ts`: apply the full `SampleEdit`:
  - **start/end**: `source.start(time, offset=start*dur, duration=(end−start)*dur/rate)`.
  - **reverse**: a cached reversed copy per `(sampleId)`, with trim positions mirrored.
  - **tuneSemitones**: `playbackRate`.
  - **loop**: `source.loop=true`, `loopStart`/`loopEnd` = loopStart/end positions. Looped hits last one step in step mode, or the note length in melodic mode.
  - **fadeOut**: the last `fadeOut × length` of the hit gets a linear gain ramp to 0.
  - **normalize**: gain = `0.89 / peak`, where the peak is computed once per buffer and cached.
  - **tone**: a per-track lowpass `Tone.Filter` (300 Hz–20 kHz, exponential) inserted at the sample track input.
- `src/ui/modals/SoundBrowserModal.tsx`: enables the dropzone, "Import file…" (multiple files) and "● Record". Recording shows an inline panel with a level meter, timer, Stop and Discard; after stop it previews and offers "Save to My Sounds" with a name field (default "Recording N"). The My Sounds category lists user samples with rename and delete (behind a "…" menu).
- `src/ui/modals/SampleEditorModal.tsx`: as in the mock. A large canvas waveform shows trim shading, draggable start/end handles (yellow) and a loop marker (green, shown when Loop is on). It also has ▶ Preview (respects all edits), Reverse, the Loop checkbox, Tune knob (−24…+24 semitones), Fade out knob, and Normalize toggle. Edits apply live to the track (one coalesced undo step per drag), and Done closes. It works for both library and user samples (edits are per track, never altering the source).
- `src/ui/inspector/SampleSoundTab.tsx`: "✂ Edit" opens the editor; Pitch and Decay knobs bind to `edit.tuneSemitones` and `edit.fadeOut`; Tone binds to `sample.tone`.
- `src/ui/components/Toast.tsx` + `src/ui/toast.ts`: a toast queue `toast({ kind: 'info' | 'error', message, action?: { label, onClick }, durationMs = 5000 })`, used for import, recording and quota errors (phase 11 uses `action` for "Undo").
- `src/audio/voices/sampleTiming.ts`: pure function `computeHitTiming(edit, bufferDuration, rate, reversed) → { offset, duration, loopStart, loopEnd, fadeStart }`, which `sampleVoice.ts` uses (so it's unit-testable without Web Audio).
- `src/ui/tooltips.ts`: copy for new controls.
- Tests: `wav.test.ts` (header fields, sample round trip on a synthetic `AudioBuffer`-shaped object), `sampleTiming.test.ts` (offset/duration math for trim+reverse+rate; fade ramp times), `sampleVoice.audio.test.ts` (browser mode: a reversed, trimmed hit renders with energy in the expected window), `userSamples.test.ts` (via `fake-indexeddb` dev dependency), `SampleEditorModal.test.tsx`, `tests/e2e/import.spec.ts` (imports a fixture WAV via file chooser and assigns it).

## Steps
1. Implement `db.ts` with both stores, then `userSamples.ts` and the `user:` resolver.
2. Implement `wav.ts`, `import.ts` and `recorder.ts`. Recording requires a secure context; when unavailable, the Record button is disabled with the tooltip "Recording needs the app to be opened over https or localhost."
3. Extend `sampleVoice.ts` with all edit fields and the per-track tone filter.
4. Build the Sound browser import/record UI and My Sounds management.
5. Build the SampleEditorModal and wire the inspector.
6. Catch `StorageQuotaError` and show the toast "Your browser storage is full. Delete some sounds or songs in My Sounds / Songs."
7. Tests listed above. Add `tests/fixtures/snap.wav` (generated by a test helper, not downloaded).

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass.
- Manual (Chrome, Firefox, Safari): import WAV, MP3, OGG (Chrome/Firefox) and FLAC files. Record a 3-second clap with the mic; it appears in My Sounds, survives a page reload, and plays on a track. In the editor, trimming removes the leading silence audibly; reverse plays backwards; tune ±12 shifts an octave; loop + a long melodic note sustains; fade shortens the tail; normalize raises a quiet file. Deleting a sound that's in use is refused with the track names.

## Commit
`feat(samples): import and mic recording to my sounds, non-destructive sample editor`

## Rollback
Revert the commit. The IndexedDB database stays in users' browsers harmlessly (phase 11 reuses it). Sample settings already in the model are ignored by the older voice (only tune applied).
