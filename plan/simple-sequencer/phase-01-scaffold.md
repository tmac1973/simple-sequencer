# Phase 01 — Project scaffold, tooling and app shell

**Depends on:** nothing · **Enables:** every later phase (build, test and deploy pipeline, theme, empty layout regions)

## Goal
Set up a TypeScript + React + Vite project with linting, formatting, unit tests (Vitest), browser tests (Playwright), git, and a GitHub Pages deploy workflow. Render the approved mock's empty layout (top bar, track list, timeline, editor, inspector) with the mock's design tokens, so every later phase drops features into a fixed frame. Ships as a deployable empty app.

## Files touched
- `package.json`: scripts `dev`, `build`, `preview`, `typecheck` (`tsc -b --noEmit`), `lint` (`eslint .`), `format` (`prettier --write .`), `test` (`vitest run`, which runs both the `unit` and `audio` projects), `test:watch`, `e2e` (`playwright test`).
- `vite.config.ts`: React plugin; `base: './'` so the build works from any static path (GitHub Pages subpath, local file server).
- `vitest.workspace.ts`: two Vitest projects.
  - **`unit`**: `environment: 'jsdom'`, include `['src/**/*.test.ts?(x)', 'scripts/**/*.test.mjs']`, exclude `['src/**/*.audio.test.ts']`.
  - **`audio`**: Vitest browser mode (`@vitest/browser` with the Playwright provider, Chromium, headless), include `['src/**/*.audio.test.ts']`. Real Web Audio (`AudioContext`, `OfflineAudioContext`, `decodeAudioData`) is only available here.
  - Any test touching real audio nodes must be named `*.audio.test.ts`. Pure logic tests stay in `unit`.
- `tsconfig.json`, `tsconfig.node.json`: `strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/` → `src/`.
- `eslint.config.js`: typescript-eslint recommended + react-hooks + react-refresh.
- `.prettierrc`: `{ "singleQuote": true, "semi": true, "printWidth": 100 }`.
- `playwright.config.ts`: Chromium, Firefox and WebKit projects; `webServer` runs `npm run build && npm run preview -- --port 4173`.
- `index.html`: root div, title "Simple Sequencer".
- `src/main.tsx`: React root.
- `src/App.tsx`: renders `<AppShell/>`.
- `src/styles/tokens.css`: CSS custom properties copied from the mock (`--bg #13141b`, `--panel #1b1d27`, `--panel2 #232634`, `--panel3 #2c3042`, `--line #33374a`, `--text #eceef6`, `--muted #9a9eb5`, `--dim #6b6f86`, `--accent #8b7bff`, `--good #5ee6a8`, `--warn #ffb84d`, `--bad #ff6b6b`, radius `10px`) plus the 12-color track palette (`#ff6b6b #ffb84d #ffe066 #5ee6a8 #4dc9ff #a78bfa #ff7ac6 #7ee0ff #c3f06b #ff9e6b #b9a6ff #6bf0d8`).
- `src/styles/global.css`: resets, base typography (system-ui 14px), button, chip and segmented-control base styles from the mock.
- `src/ui/layout/AppShell.tsx` + `AppShell.module.css`: CSS grid (`62px / 1fr / 400px` rows; arrangement `250px 1fr`; bottom `1fr 340px`), `min-width: 1280px`, with five empty region components: `TopBar`, `TrackList`, `Timeline`, `EditorPanel`, `Inspector` (each in `src/ui/layout/`), each showing its title placeholder.
- `src/App.test.tsx`: renders the shell and asserts the five regions exist.
- `tests/e2e/shell.spec.ts`: loads the page and asserts the regions are visible.
- `.github/workflows/deploy.yml`: on push to `main`, run `npm ci`, `npx playwright install --with-deps chromium` (needed by the `audio` test project), typecheck, lint, test and build, then deploy `dist/` with `actions/upload-pages-artifact` + `actions/deploy-pages`.
- `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`.
- `README.md`: what the app is, how to run, test and deploy.
- `LICENSE`: MIT (the app's own code).

## Steps
1. `git init` in `/home/tim/projects/simple_sequencer`; create the default branch `main`.
2. Scaffold with `npm create vite@latest . -- --template react-ts`, then remove the template demo content.
3. Install dev dependencies: `vitest`, `@vitest/browser`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier`. Run `npx playwright install` for the browsers.
4. Write the config files listed above.
5. Port the mock's tokens and base styles into `tokens.css` and `global.css`. Use CSS Modules (`*.module.css`) for component styles from here on.
6. Build `AppShell` and the five placeholder regions to match the mock's proportions.
7. Add the unit test, the e2e smoke test, and `src/audio/smoke.audio.test.ts` (creates an `OfflineAudioContext`, renders 0.1 s of an oscillator and asserts non-silent output) to prove the `audio` project runs.
8. Add the deploy workflow. In README, note that the user must enable "GitHub Pages → Source: GitHub Actions" in repo settings after creating the GitHub repo.
9. Commit.

## Build gate
`npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

## Test plan
- Unit: `App.test.tsx` passes.
- E2E: `shell.spec.ts` passes in Chromium, Firefox and WebKit.
- Manual: `npm run dev`, then confirm the dark layout regions match the mock's proportions at 1440×900. `npm run build && npx serve dist` from a subfolder path loads correctly (relative base works).

## Commit
`chore: scaffold vite + react + ts app shell with test and deploy tooling`

## Rollback
Delete the generated files (fresh repo); nothing else depends on this phase yet. Safe to leave partially applied: config files are independent.
