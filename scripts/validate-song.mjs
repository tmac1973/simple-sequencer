#!/usr/bin/env node
/**
 * Check song files before opening them in Simple Sequencer.
 *
 *   npm run validate-song -- my-song.json other-song.zip
 *   npm run validate-song -- --strict my-song.json     # warnings count as failures too
 *
 * Uses the app's own reader (src/model/schema.ts), so "valid" here means the app will open
 * it. On top of that it warns about things the app quietly drops or ignores: unknown sounds
 * or presets, blocks pointing to missing patterns, steps outside the pattern, unsorted
 * automation points, and so on (src/model/songLint.ts).
 *
 * Exit code: 0 = all files open (and, with --strict, no warnings); 1 = otherwise.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read a .json or .zip song file → { raw, userSounds } or { error }. */
export function readSongFile(bytes, name) {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  try {
    if (!isZip) return { raw: JSON.parse(strFromU8(bytes)), userSounds: new Set() };
  } catch (e) {
    return { error: `${name} isn't valid JSON: ${e.message}` };
  }
  let entries;
  try {
    entries = unzipSync(bytes);
  } catch {
    return { error: `${name} looks like a zip but couldn't be opened.` };
  }
  if (!entries['song.json']) return { error: `${name} has no song.json inside.` };
  let raw;
  try {
    raw = JSON.parse(strFromU8(entries['song.json']));
  } catch (e) {
    return { error: `song.json in ${name} isn't valid JSON: ${e.message}` };
  }
  const userSounds = new Set();
  const problems = [];
  if (entries['samples/index.json']) {
    let index = [];
    try {
      index = JSON.parse(strFromU8(entries['samples/index.json']));
    } catch {
      problems.push("samples/index.json isn't valid JSON.");
    }
    for (const s of Array.isArray(index) ? index : []) {
      if (!entries[s.file])
        problems.push(`samples/index.json lists "${s.file}", which isn't in the zip.`);
      else userSounds.add(s.id);
    }
  }
  return { raw, userSounds, zipProblems: problems };
}

async function main(argv) {
  const strict = argv.includes('--strict');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.log('Usage: npm run validate-song -- [--strict] <song.json | song.zip> …');
    return 1;
  }
  const vite = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  let failed = false;
  try {
    const { lintSong } = await vite.ssrLoadModule('/src/model/songLint.ts');
    const { PRESETS } = await vite.ssrLoadModule('/src/audio/synthPresets.ts');
    const manifest = JSON.parse(readFileSync(join(ROOT, 'public/samples/manifest.json'), 'utf8'));
    const sounds = new Map(manifest.samples.map((s) => [s.id, s.rootNote]));
    for (const id of ['dev:kick', 'dev:snare', 'dev:hat', 'dev:tone']) sounds.set(id, undefined);
    const presetIds = new Set(PRESETS.map((p) => p.id));

    for (const file of files) {
      const name = basename(file);
      let bytes;
      try {
        bytes = new Uint8Array(readFileSync(file));
      } catch (e) {
        console.log(`✗ ${name}: can't read it (${e.code ?? e.message})`);
        failed = true;
        continue;
      }
      const read = readSongFile(bytes, name);
      if (read.error) {
        console.log(`✗ ${name}\n  error: ${read.error}`);
        failed = true;
        continue;
      }
      const r = lintSong(read.raw, { sounds, presetIds, userSounds: read.userSounds });
      const warnings = [...(read.zipProblems ?? []), ...r.warnings];
      if (r.errors.length) {
        console.log(`✗ ${name}: the app won't open it`);
        for (const e of r.errors) console.log(`  error: ${e}`);
        failed = true;
      } else {
        const s = r.song;
        const summary = `${s.tracks.length} tracks, ${s.lengthBars} bars, ${s.bpm} BPM`;
        console.log(`${warnings.length ? '!' : '✓'} ${name}: opens in the app (${summary})`);
        if (strict && warnings.length) failed = true;
      }
      for (const m of warnings) console.log(`  warning: ${m}`);
    }
  } finally {
    await vite.close();
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2)).then((code) => (process.exitCode = code));
