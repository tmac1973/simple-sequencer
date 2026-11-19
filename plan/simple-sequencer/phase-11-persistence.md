# Phase 11 — Autosave, song library and song files

**Depends on:** 02, 06, 07, 10 · **Enables:** 12 (the Export modal hosts "Save song file"), 13 (restore-on-launch onboarding)

## Goal
Songs never get lost. They autosave to IndexedDB (the `songs` store created in phase 07), there's an in-app song library inside the "Start a song" dialog, and the app restores the last song on launch. Users can save and load portable song files: `.json` when the song uses only bundled sounds, `.zip` (song.json + custom sample files) when it uses My Sounds.

## Files touched
- `package.json`: add `fflate` (MIT).
- `src/credits/codeLicenses.ts`: add `fflate` (MIT).
- `src/storage/userSamples.ts`: `deleteUserSample` now refuses if **any** saved song (current or in the library) references the sample, listing the song names.
- `src/storage/songs.ts`: `saveSong(song)` (upsert with `updatedAt`), `listSongs()` (sorted by updatedAt desc, summaries only), `loadSongById`, `renameSong`, `duplicateSong`, `deleteSong` (moves the song to a `trash` key inside the record with `deletedAt`, purged after 30 days on launch; a toast with an "Undo" action for 8 s, using the phase-07 toast `action`).
- `src/storage/autosave.ts`: subscribes to `songStore`, debounced 1.5 s after the last change, and calls `saveSong`. It also saves on `visibilitychange` → hidden and `pagehide`. It exposes status `'saving' | 'saved' | 'error'` for the TopBar (replacing the phase-04 placeholder: "● Saved", "Saving…", or a red "Not saved, storage full" that opens a help toast). `localStorage['ss:lastSongId']` records the current song id (inside try/catch).
- `src/storage/songFile.ts`:
  - `exportSongFile(song) → { blob, filename }`:
    - If no track references a `user:` sample, the result is `<name>.json` (pretty-printed song).
    - Otherwise it's `<name>.zip` containing `song.json` plus `samples/<sampleId>.<ext>` for every referenced user sample, with `samples/index.json` (`[{ id, name, mime, file }]`).
  - `importSongFile(file) → Song`:
    - It accepts `.json` or `.zip`, runs `migrateSong` then `validateSong`, and **assigns a new song id** so importing never overwrites an existing song.
    - Zip samples are added to My Sounds; if a sample with the same content hash already exists (looked up via the `hash` index added in phase 07), the existing id is reused. References are remapped.
    - Errors surface as `SongFormatError` messages in a toast.
- `src/ui/modals/NewSongModal.tsx`:
  - A "Your songs (saved in this browser)" list as in the mock, showing name, BPM, track count and relative edited time.
  - Each row has an Open button and a "…" menu with Rename, Duplicate, Download song file, and Delete.
  - "Open song file…" is enabled (file picker for `.json`/`.zip`), and the replace-current-song prompt from phase 10 is removed.
- `src/ui/layout/TopBar.tsx`: real autosave status.
- `src/App.tsx`: on launch, load `lastSongId` if present and valid. Otherwise (first run, or the song is missing) load a fresh Lo-fi template as the current song, autosaved like any other. No modal opens, so a first-time user lands straight in a playable song (phase 13 adds the first-run hint on top).
- `src/ui/dragDrop.ts`: dropping a `.json`/`.zip` onto the window imports it; dropping audio files opens the Sound browser import flow (phase 07).
- Tests:
  - `songs.test.ts` (with `fake-indexeddb`): save/list/rename/duplicate/delete/undo-delete/purge.
  - `autosave.test.ts`: debounce, and a flush on hide.
  - `songFile.test.ts`:
    - A JSON round trip is deep-equal apart from id.
    - A zip round trip with 2 user samples restores the samples and remaps ids.
    - Hash dedupe works.
    - Corrupt files, wrong format and future versions are rejected with readable messages.
  - `tests/e2e/persistence.spec.ts`: edit, reload, and the edit persists; download a song file and re-import it via the file chooser.

## Steps
1. Implement `songs.ts`, then autosave with status.
2. Implement `songFile.ts` (fflate `zipSync`/`unzipSync`).
3. Extend NewSongModal with the library, file open and row actions.
4. Restore on launch and handle first run.
5. Window drag-and-drop.
6. Quota handling reuses `StorageQuotaError` from phase 07.
7. Tests above.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass.
- Manual: close the tab mid-edit and reopen, and nothing is lost. Make 3 songs and switch between them. A song with a recorded sound exports to `.zip` and imports in a different browser profile (and a different browser) with the sound intact. Delete + Undo restores a song. Simulate a full quota (devtools → Application → storage override), and the status shows the error without crashing.

## Commit
`feat(storage): indexeddb autosave, song library and json/zip song files`

## Rollback
Revert the commit. Saved records in IndexedDB remain and are readable again on re-apply. The app falls back to starting from the template each launch.
