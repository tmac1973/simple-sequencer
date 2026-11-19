# Phase 03 — Audio engine core: transport, scheduler, sample voices, mixer

**Depends on:** 01, 02 · **Enables:** 04 (UI plays audio), 05 (synth voices plug into the same scheduler), 07–09 (sample edits, effects and automation hook into the track graph), 12 (offline export reuses the engine)

## Goal
Build a Tone.js-based engine that turns the song store into sound with sample-accurate timing. It covers play/stop, tempo, swing, Pattern vs Song mode, step-triggered sample voices with velocity, and a per-track channel strip (volume, pan, mute, solo, an empty effects insert point) into a master bus with an always-on limiter. **The engine is context-agnostic**: the same graph-building and scheduling code runs in the live context and inside `Tone.Offline` (used by export in phase 12). It's verified with code-generated test sounds, because the real sample library arrives in phase 06.

## Files touched
- `package.json`: add `tone`.
- `src/audio/context.ts`: `ensureAudioStarted()` calls `Tone.start()` on the first user gesture; sets `Tone.getContext().lookAhead = 0.1`.
- `src/audio/sampleRegistry.ts`: `SampleRegistry` maps `sampleId → Promise<AudioBuffer>`, with `register(id, loader)`, `get(id)`, `has(id)` and an LRU-free cache (kept for the session). Resolvers are pluggable: `addResolver(prefix, fn)` (phase 06 adds `lib:`, phase 07 adds `user:`).
- `src/audio/devSamples.ts`: generates test buffers (sine-drop kick, noise snare, filtered-noise hat) via `OfflineAudioContext` under ids `dev:kick`, `dev:snare` and `dev:hat`.
- `src/audio/trackGraph.ts`: `TrackGraph` per track: input `Gain` → effects insert chain (an empty array this phase; `setInserts(nodes[])` rewires it) → `Tone.Channel` (volume, pan, mute, solo) → master. Exposes `input`, `channel` and `dispose()`.
- `src/audio/master.ts`: master `Gain` → `Tone.Limiter(-3)` → **safety clipper** (`Tone.WaveShaper` with a tanh-style soft-clip curve whose output ceiling is −0.3 dBFS; transparent below −6 dBFS) → destination (live) or offline destination. The limiter does the audible gain control, and the clipper guarantees the output never exceeds −0.3 dBFS even on fast transients.
- `src/audio/voices/sampleVoice.ts`: `triggerSample(graph, buffer, time, velocity, settings, durationSec?)` creates a `ToneBufferSource` and a velocity `Gain` (gain = velocity²), starts at `time` and disposes on end. This phase applies the `tuneSemitones` playback rate only; the other `SampleEdit` fields are added in phase 07.
- `src/audio/scheduler.ts`: `computeBeatEvents(song, ui, beatIndex): ScheduledEvent[]`, a **pure function**, plus a `Scheduler` class. All per-beat work lives in one method, **`scheduleBeat(beatIndex, time)`**: it computes events and dispatches them at `time + offset`, and later phases add more per-beat work here (automation in phase 09). The live engine calls `scheduleBeat` from `Transport.scheduleRepeat(cb, '4n')`, and offline rendering (phase 12) calls the same method in a loop. There's only one code path, so export matches playback.
- `src/audio/engine.ts`: `Engine` singleton: `build(song)`, `syncFrom(prevSong, nextSong)` (add/remove/update track graphs on store changes), `play(fromBar = 0)` (Song mode starts at `ui.songStartBar`; Pattern mode always starts at the loop region start), `stop()`, `onPosition(cb)` (bar/step for the playhead, via `Tone.Draw`), `buildOffline(song, ctx, range)`, where `range` is `'song'` or `{ loopRepeats }` (the same graph construction against a passed context, used in phase 12).
- `src/audio/useEngineSync.ts`: subscribes the engine to `songStore` and `uiStore` (playMode, selection).
- `src/audio/scheduler.test.ts`: pure scheduler unit tests (`unit` project).
- `src/audio/engine.audio.test.ts`: browser-mode test. It builds the engine offline for a 1-bar dev song and asserts a non-silent render with the first transient at sample 0 ±64.
- `src/ui/layout/TopBar.tsx`: temporary dev-only Play/Stop button plus a "Dev song" loader (replaced by the real top bar in phase 04).

## Steps
1. **Scheduling model (per-beat lookahead).** `Transport.scheduleRepeat` fires once per quarter note, shortly before it. For that beat, `computeBeatEvents`:
   - Converts the transport position into an absolute beat index. In Song mode this is wrapped to `song.lengthBars`; in Pattern mode it's wrapped to the **loop region** (next item).
   - For every audible track (solo logic: if any track is soloed, only soloed tracks play; muted tracks never), finds the pattern playing at that bar. In Song mode that's `blockAt(track, bar)`; in Pattern mode it's the rule below. It then collects that pattern's steps/notes whose start falls inside this beat. Pattern-local position = `(bar − block.startBar) mod pattern.lengthBars`.
   - Emits `{ trackId, offsetBeats (including swing from timing.ts), velocity, kind: 'hit' | 'note', degree?, lengthBeats? }`.
   - A beat contains exactly 4 sixteenth steps or 6 triplet steps, so both grids are exact. Edits made while playing are heard from the next beat (≤ 1 beat + 100 ms latency).
2. **Pattern mode loop region.** Let the selected track be T, with selected pattern P. The loop region starts at the first block of P on T's timeline (or bar 0 if P isn't placed) and lasts `P.lengthBars`. Track T always plays P throughout the region; every other track plays whatever its timeline blocks hold in those bars. The region is exposed as `getLoopRegion(song, ui)` so the ruler (phase 04) can highlight it.
3. **Song mode** plays bars `0 … lengthBars−1`, then loops to the start (a loop toggle is not in v1; Song mode always loops).
4. **Track graphs.** `syncFrom` diffs tracks by id: creates or disposes graphs, and updates `channel.volume`/`pan`/`mute`/`solo` with `rampTo` (20 ms) to avoid clicks.
5. **Voices.** `kind: 'hit'` on sample tracks calls `triggerSample` with the track's buffer from the registry (skipped silently if the buffer isn't loaded yet; the registry is warmed whenever a track's `sampleId` changes). `kind: 'note'` events are produced but ignored until phase 05.
6. **Position callback.** `Tone.Draw.schedule` reports `{bar, step}` for the playhead at each step boundary.
7. **Offline-readiness.** All node construction goes through a `ctx` parameter, and nothing reads the global context directly except `context.ts`. `buildOffline(song, offlineCtx, range)` constructs master + track graphs inside `Tone.Offline` and calls `scheduler.scheduleBeat(beat, beatTime)` synchronously for every beat in the range.
8. **Dev harness.** A temporary dev song (kick/snare/hat tracks using `dev:` samples, 2 patterns, 8 bars) loads from the temporary TopBar button so timing can be judged by ear.
9. **Tests** (`scheduler.test.ts`): events for a 4-on-the-floor pattern; swing offsets on odd 16ths only; triplet grid emits 6 per beat; mute and solo rules; Pattern-mode loop region for placed and unplaced patterns; a 3-bar pattern repeating inside a 4-bar span; empty bars emit nothing.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build`

## Test plan
- Unit tests above pass.
- Manual (Chrome, Firefox, Safari): load the dev song and press Play. The beat is steady over 2+ minutes with no drift; BPM changes (via dev console store action) take effect within a beat; swing 0.3 audibly shuffles; mute and solo respond without clicks; the master never clips with 8 stacked hits (limiter).

## Commit
`feat(audio): tone.js engine with per-beat scheduler, sample voices, mixer and limiter`

## Rollback
Revert the commit. The temporary TopBar dev controls are the only UI touched, and the store is unchanged.
