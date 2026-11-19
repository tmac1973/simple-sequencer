# Phase 08 — Per-track effect chains

**Depends on:** 02, 03, 04 · **Enables:** 09 (effect knobs as automation targets), 10 (templates include effects), 12 (export renders effects)

## Goal
Fill the inspector's Effects tab. Each track gets a chain of up to 6 effects from the curated set of 8, each with 1–2 big knobs, an on/off toggle, an "▸ Advanced" section, remove, and drag-to-reorder, ending in the always-on master limiter display. Effects run in the track graph's insert slot built in phase 03.

## Files touched
- `src/audio/effects/registry.ts`: one definition per `FxType`: `{ type, name, emoji, blurb, main: ParamDef[] (1–2), advanced: ParamDef[], create(ctx): FxInstance }`, where `ParamDef = { key, label, default (0–1), map(v) → native value, format(v) → display text }`, and `FxInstance = { input, output, set(key, v, rampSec), dispose() }`.
- Effect definitions (`src/audio/effects/*.ts`) give each effect's main knobs (and advanced), plus the Tone node it uses:

  | Effect | Main knobs | Advanced | Tone node |
  |---|---|---|---|
  | Reverb | Size (decay 0.5–8 s; "Room"→"Hall"), Amount (wet 0–1) | Pre-delay 0–100 ms | `Tone.Reverb` (impulse regenerated on Size change, debounced 300 ms) |
  | Delay | Time (1/16, 1/8, 3/16, 1/4, 3/8, 1/2, snapped to tempo), Amount (wet) | Feedback 0–0.85, Ping-pong on/off | `Tone.FeedbackDelay` / `Tone.PingPongDelay` |
  | Filter | Cutoff (40 Hz–18 kHz, exponential; label "Darker ↔ Brighter"), Resonance (Q 0.5–15) | Type lowpass/highpass/bandpass | `Tone.Filter` |
  | Distortion | Drive (0–1), Amount (wet) | Oversample none/2x/4x | `Tone.Distortion` |
  | Compressor | Squash (threshold −40…0 dB with ratio 2–8 tied), Makeup (0–+12 dB) | Attack, Release | `Tone.Compressor` + `Tone.Gain` |
  | EQ | Low (−12…+12 dB), High (−12…+12 dB) | Mid gain, Low/High crossover freqs | `Tone.EQ3` |
  | Chorus | Width (depth 0–1), Amount (wet) | Rate 0.1–8 Hz | `Tone.Chorus` (started on create) |
  | Bitcrush | Crush (bits 16→2), Amount (wet) | Downsample 1–20× | `Tone.BitCrusher` + a sample-and-hold `AudioWorklet` |
- `src/audio/effects/downsampleWorklet.ts`: a tiny sample-and-hold `AudioWorkletProcessor` for Bitcrush downsampling, loaded via `ctx.addAudioWorkletModule` (also inside `Tone.Offline`).
- `src/audio/trackGraph.ts`: `setInserts()` is now driven by `track.fx`. It rebuilds the chain on add/remove/reorder (crossfading 30 ms from old to new chain to avoid clicks), calls `set()` for param changes, and uses a per-slot bypass (`enabled: false` routes around the effect).
- `src/audio/engine.ts`: `syncFrom` diffs `fx` arrays by slot id.
- `src/ui/inspector/EffectsTab.tsx`: effect cards as in the mock. Each card has a ⋮⋮ grip (reorder via `@dnd-kit/sortable`), emoji + name, toggle, ✕, main knobs, and "▸ Advanced" expanding the advanced knobs/selects. "+ Add effect" opens the menu of 8 with blurbs (disabled at 6 with the tooltip "A track can have up to 6 effects."). The footer row "→ Master · Limiter 🛡 always on" carries its tooltip. The tab badge shows the effect count.
- `src/credits/codeLicenses.ts`: no new deps.
- `src/ui/tooltips.ts`: copy for each effect and knob (plain English, e.g. Compressor: "Evens out loud and quiet parts so the track sounds tighter.").
- Tests: `registry.test.ts` (every def has 1–2 main params; defaults in range; map endpoints), `trackGraph.audio.test.ts` (browser mode, offline context: chain order follows `fx` order; bypass passes signal unchanged; dispose on remove; Bitcrush worklet loads), `EffectsTab.test.tsx` (add, reorder and remove dispatch), `tests/e2e/effects.spec.ts`.

## Steps
1. Write the registry and 8 effect definitions, plus the downsample worklet.
2. Rewire `trackGraph.setInserts` with crossfaded chain rebuilds and bypass.
3. Extend the engine diffing for effects.
4. Build EffectsTab with drag-reorder and the add menu.
5. Write the tooltips.
6. Tests above.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Automated tests above pass.
- Manual: each effect is clearly audible at its defaults and its main knobs do what the label says. Reordering Distortion→Filter vs Filter→Distortion sounds different. Toggling bypass is click-free. Adding 6 effects to 8 tracks keeps playback glitch-free in Chrome, Firefox and Safari (check CPU in devtools; the Reverb impulse regeneration isn't audible as a dropout). Delay time follows tempo changes.

## Commit
`feat(fx): per-track effect chains with eight curated effects`

## Rollback
Revert the commit. The `fx` arrays in songs stay in the model and are ignored (pass-through), so no data loss.
