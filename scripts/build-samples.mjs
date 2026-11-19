#!/usr/bin/env node
/**
 * Build the bundled sample library from samples-src/sources.json.
 *
 *   node scripts/build-samples.mjs            # download missing files, convert, write manifest
 *   FREESOUND_TOKEN=... node scripts/...      # also allows entries with a `freesoundId`
 *
 * Requires ffmpeg on PATH. Output: public/samples/<kit>/<id>.flac + public/samples/manifest.json
 * (mono, 44.1 kHz, 16-bit FLAC; leading silence trimmed at −50 dB, peak-normalized to −1 dBFS,
 * capped at 4 s for drums / 6 s for melodic, 30 ms fade-out).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSources } from './sources-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'samples-src', 'sources.json');
const RAW = join(ROOT, 'samples-src', 'raw');
const OUT = join(ROOT, 'public', 'samples');
const SR = 44100;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(`${cmd} failed: ${err.slice(-400)}`)),
    );
    if (input) p.stdin.end(input);
    else p.stdin.end();
  });
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function freesoundUrl(entry, token) {
  const res = await fetch(
    `https://freesound.org/apiv2/sounds/${entry.freesoundId}/?token=${token}&fields=license,previews,username`,
  );
  if (!res.ok) throw new Error(`Freesound API ${res.status} for ${entry.id}`);
  const info = await res.json();
  const want = entry.license === 'CC0-1.0' ? /publicdomain\/zero/ : /licenses\/by\//;
  if (!want.test(info.license))
    throw new Error(`License mismatch for ${entry.id}: Freesound says ${info.license}`);
  return info.previews['preview-hq-ogg'];
}

/** Decode any audio file to mono float32 at 44.1 kHz. */
async function decode(file) {
  const buf = await run('ffmpeg', [
    '-v',
    'error',
    '-i',
    file,
    '-ac',
    '1',
    '-ar',
    String(SR),
    '-f',
    'f32le',
    '-',
  ]);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function clean(pcm, maxSec) {
  const thresh = 10 ** (-50 / 20);
  let start = 0;
  while (start < pcm.length && Math.abs(pcm[start]) < thresh) start++;
  start = Math.max(0, start - 32); // keep a hair of pre-roll
  let end = Math.min(pcm.length, start + Math.round(maxSec * SR));
  // drop trailing near-silence
  const tail = 10 ** (-70 / 20);
  while (end > start + 64 && Math.abs(pcm[end - 1]) < tail) end--;
  const out = pcm.slice(start, end);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 10 ** (-1 / 20) / peak : 1;
  const fade = Math.min(out.length, Math.round(0.03 * SR));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    const fromEnd = out.length - 1 - i;
    if (fromEnd < fade) g *= fromEnd / fade;
    out[i] *= g;
  }
  return out;
}

/** Rough pitch (MIDI) by normalized autocorrelation over a steady window. */
export function detectMidi(pcm) {
  const from = Math.min(pcm.length - 4096, Math.round(0.08 * SR));
  if (from < 0) return null;
  const w = pcm.subarray(from, from + 4096);
  const minLag = Math.floor(SR / 1500);
  const maxLag = Math.floor(SR / 30);
  let best = -1;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i + lag < w.length; i++) {
      num += w[i] * w[i + lag];
      a += w[i] * w[i];
      b += w[i + lag] * w[i + lag];
    }
    const r = num / Math.sqrt(a * b + 1e-12);
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  if (best < 0.5 || !bestLag) return null;
  // prefer the shortest lag that is nearly as good (avoid octave-down errors)
  for (let div = 4; div >= 2; div--) {
    const lag = Math.round(bestLag / div);
    if (lag < minLag) continue;
    let num = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i + lag < w.length; i++) {
      num += w[i] * w[i + lag];
      a += w[i] * w[i];
      b += w[i + lag] * w[i + lag];
    }
    if (num / Math.sqrt(a * b + 1e-12) > best * 0.92) {
      bestLag = lag;
      break;
    }
  }
  const f = SR / bestLag;
  return Math.round(69 + 12 * Math.log2(f / 440));
}

async function encodeFlac(pcm, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const bytes = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  await run(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-f',
      'f32le',
      '-ar',
      String(SR),
      '-ac',
      '1',
      '-i',
      '-',
      '-sample_fmt',
      's16',
      '-compression_level',
      '8',
      dest,
    ],
    bytes,
  );
}

async function main() {
  const sources = JSON.parse(readFileSync(SRC, 'utf8'));
  const problems = validateSources(sources);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
    return;
  }
  const token = process.env.FREESOUND_TOKEN;
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  const manifest = { version: 1, kits: sources.kits, samples: [] };
  let total = 0;
  for (const e of sources.samples) {
    if (e.freesoundId && !token) {
      console.warn(`skip ${e.id}: needs FREESOUND_TOKEN`);
      continue;
    }
    const ext = (e.downloadUrl ?? '.ogg').split('?')[0].split('.').pop();
    const raw = join(RAW, e.source, `${e.id}.${ext}`);
    if (!existsSync(raw)) {
      const url = e.freesoundId ? await freesoundUrl(e, token) : e.downloadUrl;
      process.stdout.write(`↓ ${e.id} `);
      await download(url, raw);
    }
    const melodic = e.rootNote !== undefined;
    const pcm = clean(await decode(raw), e.maxSec ?? (melodic ? 6 : 4));
    const file = `${e.kit}/${e.id}.flac`;
    await encodeFlac(pcm, join(OUT, file));
    total += statSync(join(OUT, file)).size;
    let rootNote = e.rootNote;
    if (rootNote === 'auto') {
      rootNote = detectMidi(pcm) ?? 60;
      console.log(`\n  ${e.id}: detected root MIDI ${rootNote}`);
    }
    manifest.samples.push({
      id: `lib:${e.id}`,
      kit: e.kit,
      category: e.category,
      name: e.name,
      file,
      durationMs: Math.round((pcm.length / SR) * 1000),
      author: e.author,
      license: e.license,
      licenseUrl: e.licenseUrl,
      sourceUrl: e.sourceUrl,
      via: e.via,
      ...(rootNote !== undefined ? { rootNote } : {}),
      ...(e.templateRole ? { templateRole: e.templateRole } : {}),
    });
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`\n${manifest.samples.length} samples, ${(total / 1024 / 1024).toFixed(2)} MB`);
  if (total > MAX_TOTAL_BYTES) {
    console.error('Library is over the 15 MB budget.');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
