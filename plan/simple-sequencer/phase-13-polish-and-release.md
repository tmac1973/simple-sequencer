# Phase 13 — Approachability polish, cross-browser QA and first release

**Depends on:** 01–12 · **Enables:** v1 release on GitHub Pages

## Goal
Make the app meet every success criterion in the overview. Audit tooltip and label coverage for plain English, add a first-run experience, finish error states, check performance at the stated scale, run the full cross-browser checklist, and ship v1 to GitHub Pages.

## Files touched
- `src/ui/tooltips.ts`: final copy pass. A test enforces that every interactive element has a tip.
- `src/ui/tooltipCoverage.test.tsx`: renders the app with a template and each modal open, then asserts every `button`, `input`, `select` and `[role=slider]` (which includes every Knob, per phase 04) is wrapped by `<Tip>` or carries `aria-describedby` pointing to a tooltip (an allowlist covers modal close ✕ buttons only).
- `src/ui/FirstRunHint.tsx`: on first launch only (`localStorage['ss:seenHint']`, try/catch). Phase 11 loads the Lo-fi template directly on first run with no modal, so once the workspace has rendered, a dismissible callout points at the Play button ("Press Space or ▶ to hear your song"), then at a kick step ("Click a square to add or remove a drum hit"). There are two steps, then it disappears; no forced tutorial.
- `src/ui/modals/ShortcutsModal.tsx`: complete list; linked from 💡 as well.
- `src/ui/ErrorBoundary.tsx`: catches render errors, shows "Something went wrong. Your song is saved." with Reload, and logs to the console.
- `src/audio/context.ts`: if the AudioContext gets suspended (tab backgrounded on Safari), the next Play resumes it; on `AudioContext` creation failure a toast explains it.
- `src/ui/layout/TopBar.tsx`: an "About & credits" item (opens CreditsModal) behind the logo.
- Performance work (all three are done):
  - `src/ui/layout/TimelineRow.tsx` and `src/ui/editor/StepEditor.tsx`: rows memoized by pattern/track object reference (`React.memo`).
  - `src/ui/layout/Timeline.tsx`: playhead updates throttled to one per animation frame, and timeline columns virtualized so only the visible bars ± 8 are rendered.
- `tests/e2e/smoke.spec.ts`: the full primary flow in all 3 browsers. Launch, choose Hip-hop, toggle a step, add a synth track, stamp a chord, add Reverb, paint a block, add a volume lane point, export a WAV, reload, and confirm the song restores.
- `docs/QA-CHECKLIST.md`: the manual cross-browser checklist (below), with checkboxes.
- `README.md`: features, screenshots (taken from the running app), how to run/test/deploy, the sample license summary, and the LGPL note for the MP3 encoder.
- `package.json`: `"version": "1.0.0"`.

## Steps
1. Write the tooltip-coverage test, fix every gap, and review all copy for jargon (e.g. no "LFO", "ADSR" or "send" outside the Advanced drawers).
2. Add FirstRunHint, ErrorBoundary and audio-context resilience.
3. **Performance check:** build a stress song of 16 tracks × 128 bars, each with 3 effects and one automation lane. Play in Chrome, Firefox and Safari with devtools Performance recording. Targets: no audible dropouts; UI interactions respond within 100 ms; main-thread long tasks during playback under 50 ms. Implement the three optimizations above, then measure. Any target still failing is a bug fixed in this phase before release.
4. Run `docs/QA-CHECKLIST.md` in Chrome, Firefox and Safari (latest):
   - Template → edit → hear it within 2 minutes.
   - An 8-track × 16-bar song plays without timing glitches for 5 minutes.
   - Synth notes stay in key through key changes.
   - Import and recording work, the sample editor works, and effects reorder.
   - Swing, velocity, 1–4 bar patterns, triplets and automation are heard in both playback and export.
   - Autosave restores the song after closing the browser.
   - A `.zip` round trip reloads identically.
   - WAV and MP3 exports match playback.
   - Credits lists all CC-BY items.
   - The app runs from the deployed GitHub Pages URL with no server code.
5. Fix the issues found. Re-run the checklist until it's fully checked.
6. Create the GitHub repo (user action), push `main`, enable Pages (Source: GitHub Actions), and confirm the deployed site works, including mic recording over HTTPS.
7. Tag `v1.0.0`.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`, plus every box in `docs/QA-CHECKLIST.md` checked, plus a successful GitHub Actions deploy.

## Test plan
- `tooltipCoverage.test.tsx` and `smoke.spec.ts` pass in all 3 browsers.
- The manual QA checklist is fully checked in Chrome, Firefox and Safari.
- The stress song meets the performance targets.
- A first-time user test: someone who hasn't seen the app makes a change to a template beat and exports an MP3 without help.

## Commit
`chore(release): approachability polish, qa checklist and v1.0.0`

## Rollback
Each fix is small and revertible individually. If the deploy regresses, re-run the GitHub Pages workflow on the previous tag (`git revert` + push, or re-deploy the prior commit).
