# Simple Sequencer

An approachable, browser-based multitrack beat sequencer. Build songs from drum and synth
tracks, patterns and a song timeline, with no account and no server.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL in Chrome, Firefox or Safari on a desktop.

## Test

```bash
npm run typecheck && npm run lint && npm test   # unit + Web Audio (headless Chromium) tests
npm run e2e        # Playwright: Chromium, Firefox, WebKit
npm run e2e:local  # Chromium + Firefox only (for hosts where WebKit can't launch)
```

## Deploy (GitHub Pages)

1. Create a GitHub repository and push `main`.
2. In the repository settings, go to **Pages** and set **Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/`.

The build uses relative paths (`base: './'`), so `dist/` can also be served from any static host.
