import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { DEFAULT_SAMPLE_EDIT, newId } from '@/model/factories';
import { SongFormatError, validateSong } from '@/model/schema';
import type {
  AutomationLane,
  AutomationTarget,
  FxSlot,
  LfoShape,
  Pattern,
  SampleEdit,
  Song,
  SynthAdvanced,
  Track,
} from '@/model/types';
import { KITS } from '@/library/ideas/model';
import { partOfTrack } from '@/library/ideas/apply';

/**
 * Share links carry the whole song in the URL fragment (after #), which browsers never send to
 * a server. The song is packed into a compact array form (no ids, rounded numbers), deflated and
 * base64url-encoded. A typical song is about 2 KB of URL.
 *
 * Your own recorded or imported sounds can't fit in a link, so tracks using them get a similar
 * built-in sound instead (and the share window says so).
 */

export const SHARE_KEY = 'song';
const FORMAT = 1;

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

type Packed = unknown[];

function packTarget(t: AutomationTarget, fx: FxSlot[], lanes: AutomationLane[]): Packed {
  switch (t.kind) {
    case 'track':
      return ['t', t.param];
    case 'synthMacro':
      return ['m', t.macro];
    case 'sampleTone':
      return ['s'];
    case 'fx':
      return ['f', fx.findIndex((f) => f.id === t.fxId), t.param];
    case 'lfo':
      return ['l', lanes.findIndex((l) => l.id === t.laneId), t.param];
  }
}

function unpackTarget(p: Packed, fx: FxSlot[], laneIds: string[]): AutomationTarget {
  switch (p[0]) {
    case 't':
      return { kind: 'track', param: p[1] as 'volume' | 'pan' };
    case 'm':
      return { kind: 'synthMacro', macro: p[1] as 'tone' | 'space' };
    case 's':
      return { kind: 'sampleTone' };
    case 'l':
      return {
        kind: 'lfo',
        laneId: laneIds[p[1] as number] ?? '',
        param: p[2] === 'speed' ? 'speed' : 'amount',
      };
    default:
      return { kind: 'fx', fxId: fx[p[1] as number]?.id ?? '', param: String(p[2]) };
  }
}

const roundParams = (o: Record<string, number>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v)]));

function editDiff(e: SampleEdit): Partial<SampleEdit> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e))
    if (DEFAULT_SAMPLE_EDIT[k as keyof SampleEdit] !== v)
      out[k] = typeof v === 'number' ? r3(v) : v;
  return out as Partial<SampleEdit>;
}

function packTrack(t: Track): Packed {
  const patterns = t.patterns.map((p) => [
    p.name,
    p.lengthBars,
    p.stepsPerBar,
    p.steps.flatMap((s) => [s.index, r2(s.velocity)]),
    p.notes.flatMap((n) => [n.start, n.length, n.degree, r2(n.velocity)]),
  ]);
  const blocks = t.blocks.flatMap((b) => [
    t.patterns.findIndex((p) => p.id === b.patternId),
    b.startBar,
  ]);
  const fx = t.fx.map((f) => [f.type, f.enabled ? 1 : 0, roundParams(f.params)]);
  const lanes = t.automation.map((l) => {
    const packed: Packed = [
      packTarget(l.target, t.fx, t.automation),
      l.visible ? 1 : 0,
      l.points.flatMap((p) => [r3(p.bar), r3(p.value)]),
    ];
    if (l.mode === 'lfo' || l.lfo)
      packed.push([
        l.mode === 'lfo' ? 1 : 0,
        l.lfo?.shape ?? 'sine',
        l.lfo?.rate ?? 2,
        r3(l.lfo?.depth ?? 0.5),
        r3(l.lfo?.center ?? 0.5),
      ]);
    return packed;
  });
  const sound = t.sample
    ? [
        t.sample.sampleId,
        t.sample.melodic ? 1 : 0,
        t.sample.rootMidi,
        r3(t.sample.tone),
        editDiff(t.sample.edit),
      ]
    : [
        t.synth!.presetId,
        [
          t.synth!.macros.tone,
          t.synth!.macros.punch,
          t.synth!.macros.space,
          t.synth!.macros.length,
        ].map(r3),
        t.synth!.advanced,
      ];
  return [
    t.name,
    t.color,
    t.kind === 'synth' ? 1 : 0,
    r2(t.volumeDb),
    r2(t.pan),
    (t.mute ? 1 : 0) + (t.solo ? 2 : 0),
    patterns,
    blocks,
    fx,
    lanes,
    sound,
  ];
}

function unpackTrack(p: Packed): Track {
  const [name, color, synth, volumeDb, pan, flags, pats, blocks, fxs, lanes, sound] = p as [
    string,
    string,
    number,
    number,
    number,
    number,
    Packed[],
    number[],
    Packed[],
    Packed[],
    Packed,
  ];
  const patterns: Pattern[] = pats.map((q) => {
    const [pname, lengthBars, stepsPerBar, steps, notes] = q as [
      string,
      Pattern['lengthBars'],
      Pattern['stepsPerBar'],
      number[],
      number[],
    ];
    const s: Pattern['steps'] = [];
    for (let i = 0; i + 1 < steps.length; i += 2)
      s.push({ index: steps[i]!, velocity: steps[i + 1]! });
    const n: Pattern['notes'] = [];
    for (let i = 0; i + 3 < notes.length; i += 4)
      n.push({
        start: notes[i]!,
        length: notes[i + 1]!,
        degree: notes[i + 2]!,
        velocity: notes[i + 3]!,
      });
    return { id: newId(), name: pname, lengthBars, stepsPerBar, steps: s, notes: n };
  });
  const bl: Track['blocks'] = [];
  for (let i = 0; i + 1 < blocks.length; i += 2) {
    const pat = patterns[blocks[i]!];
    if (pat) bl.push({ id: newId(), patternId: pat.id, startBar: blocks[i + 1]! });
  }
  const fx: FxSlot[] = fxs.map((f) => {
    const [type, enabled, params] = f as [FxSlot['type'], number, Record<string, number>];
    return { id: newId(), type, enabled: !!enabled, params };
  });
  const laneIds = lanes.map(() => newId());
  const automation: AutomationLane[] = lanes.map((l, li) => {
    const [target, visible, pts, wobble] = l as [Packed, number, number[], Packed | undefined];
    const points: AutomationLane['points'] = [];
    for (let i = 0; i + 1 < pts.length; i += 2) points.push({ bar: pts[i]!, value: pts[i + 1]! });
    const lane: AutomationLane = {
      id: laneIds[li]!,
      target: unpackTarget(target, fx, laneIds),
      visible: !!visible,
      points,
    };
    if (wobble) {
      const [on, shape, rate, depth, center] = wobble as [number, LfoShape, number, number, number];
      lane.mode = on ? 'lfo' : 'draw';
      lane.lfo = { shape, rate, depth, center };
    }
    return lane;
  });
  const t: Track = {
    id: newId(),
    name,
    color,
    kind: synth ? 'synth' : 'sample',
    volumeDb,
    pan,
    mute: !!(flags & 1),
    solo: !!(flags & 2),
    patterns,
    blocks: bl,
    fx,
    automation,
  };
  if (synth) {
    const [presetId, m, advanced] = sound as [string, number[], Partial<SynthAdvanced>];
    t.synth = {
      presetId,
      macros: { tone: m[0]!, punch: m[1]!, space: m[2]!, length: m[3]! },
      advanced: advanced ?? {},
    };
  } else {
    const [sampleId, melodic, rootMidi, tone, edit] = sound as [
      string,
      number,
      number,
      number,
      Partial<SampleEdit>,
    ];
    t.sample = {
      sampleId,
      melodic: !!melodic,
      rootMidi,
      tone,
      edit: { ...DEFAULT_SAMPLE_EDIT, ...edit },
    };
  }
  return t;
}

/** A built-in stand-in for one of the user's own sounds. */
export function standIn(t: Track): { sampleId: string; rootMidi: number } {
  if (t.sample?.melodic) return { sampleId: 'lib:piano-c4', rootMidi: 60 };
  const part = partOfTrack({ ...t, sample: { ...t.sample!, sampleId: 'user:x' } });
  return { sampleId: part ? KITS.dusty[part] : 'lib:analog-perc-blip', rootMidi: 60 };
}

/** Tracks whose sounds can't travel in a link (the user's own recordings and imports). */
export function ownSoundTracks(song: Song): Track[] {
  return song.tracks.filter((t) => t.sample && !t.sample.sampleId.startsWith('lib:'));
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The part of a share link after `#song=`. */
export function encodeShare(song: Song): string {
  const tracks = song.tracks.map((t) => {
    if (!t.sample || t.sample.sampleId.startsWith('lib:')) return t;
    const s = standIn(t);
    return { ...t, sample: { ...t.sample, ...s, edit: { ...DEFAULT_SAMPLE_EDIT } } };
  });
  const packed = [
    FORMAT,
    song.name,
    song.bpm,
    r3(song.swing),
    song.key.root,
    song.key.scale,
    song.lengthBars,
    tracks.map(packTrack),
  ];
  return toBase64Url(deflateSync(strToU8(JSON.stringify(packed)), { level: 9 }));
}

const BROKEN =
  'This share link is broken or incomplete. Ask for the link again, and copy all of it.';

/** Turn the data from a share link back into a song (with fresh ids). */
export function decodeShare(data: string): Song {
  let packed: unknown;
  try {
    packed = JSON.parse(strFromU8(inflateSync(fromBase64Url(data.trim()))));
  } catch {
    throw new SongFormatError(BROKEN);
  }
  if (!Array.isArray(packed)) throw new SongFormatError(BROKEN);
  if (packed[0] !== FORMAT)
    throw new SongFormatError(
      typeof packed[0] === 'number' && packed[0] > FORMAT
        ? 'This song was shared from a newer version of Simple Sequencer. Reload the page and try again.'
        : BROKEN,
    );
  const [, name, bpm, swing, root, scale, lengthBars, tracks] = packed as [
    number,
    string,
    number,
    number,
    number,
    Song['key']['scale'],
    number,
    Packed[],
  ];
  const now = Date.now();
  try {
    return validateSong({
      format: 'simple-sequencer-song',
      version: 1,
      id: newId(),
      name,
      bpm,
      swing,
      key: { root, scale },
      lengthBars,
      tracks: (tracks ?? []).map(unpackTrack),
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    if (e instanceof SongFormatError) throw e;
    throw new SongFormatError(BROKEN);
  }
}

/** A full link to this song on the current site. */
export function shareUrl(song: Song, base = location.href): string {
  const u = new URL(base);
  u.search = '';
  u.hash = `${SHARE_KEY}=${encodeShare(song)}`;
  return u.toString();
}

/** The share data in a location hash, if there is any. */
export function shareDataFromHash(hash: string): string | null {
  const m = new RegExp(`^#${SHARE_KEY}=(.+)$`).exec(hash);
  return m ? m[1]! : null;
}
