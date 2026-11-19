import { useEffect, useMemo, useState } from 'react';
import { engine } from '@/audio/engine';
import { usesNotes } from '@/audio/scheduler';
import {
  findIdeas,
  GENRES,
  IDEA_CATEGORIES,
  IDEAS,
  ideaById,
  isDrumCategory,
  partLabel,
  type Genre,
  type IdeaCategory,
  type PatternIdea,
} from '@/library/ideas';
import { buildPreviewSong, planIdea, type IdeaPlan } from '@/library/ideas/apply';
import { keyLabel } from '@/model/scale';
import { loadManifest } from '@/library/manifest';
import { soundInfo } from '@/library/soundNames';
import { useSoundNamesVersion } from '../hooks/useSoundNames';
import type { Track } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { Modal } from '../components/controls';
import { useSelection } from '../hooks/selection';
import { toast, toastError } from '../toast';
import { stopPlayback } from '../transport';
import { tip } from '../tooltips';
import styles from './IdeasModal.module.css';

/** Open on the kind of idea that suits the selected track. */
function startCategory(track: Track | undefined): IdeaCategory {
  if (!track || !usesNotes(track)) return 'groove';
  const hay = `${track.name} ${track.synth?.presetId ?? ''}`.toLowerCase();
  if (/pad|keys|piano|chord|organ/.test(hay)) return 'chords';
  if (/lead|pluck|bell|melod|vibes|marimba|vox/.test(hay)) return 'melody';
  return 'bass';
}

const PART_COLORS = ['#ff6b6b', '#ffb84d', '#ffe066', '#5ee6a8', '#4dc9ff', '#a78bfa', '#ff7ac6'];

function DrumArt({ idea }: { idea: PatternIdea }) {
  const total = idea.bars * idea.grid;
  const parts = Object.entries(idea.parts ?? {});
  return (
    <div className={styles.art} aria-hidden>
      {parts.map(([part, steps], r) => {
        const on = new Map(steps.map((s) => [s.index, s.velocity]));
        return (
          <div
            key={part}
            className={styles.artRow}
            style={{ gridTemplateColumns: `46px repeat(${total}, 1fr)` }}
          >
            <span>{partLabel(part as never)}</span>
            {Array.from({ length: total }, (_, i) => (
              <i
                key={i}
                className={i % idea.grid === 0 && i > 0 ? styles.barLine : undefined}
                style={
                  on.has(i)
                    ? {
                        background: PART_COLORS[r % PART_COLORS.length],
                        opacity: 0.35 + 0.65 * on.get(i)!,
                      }
                    : undefined
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function NoteArt({ idea, color }: { idea: PatternIdea; color: string }) {
  const notes = idea.notes ?? [];
  const total = idea.bars * idea.grid;
  const lo = Math.min(...notes.map((n) => n.degree));
  const hi = Math.max(...notes.map((n) => n.degree));
  const span = Math.max(1, hi - lo);
  return (
    <div className={`${styles.art} ${styles.roll}`} aria-hidden>
      {Array.from({ length: idea.bars - 1 }, (_, b) => (
        <i
          key={`b${b}`}
          className={styles.rollBar}
          style={{ left: `${((b + 1) / idea.bars) * 100}%` }}
        />
      ))}
      {notes.map((n, i) => (
        <i
          key={i}
          style={{
            left: `${(n.start / total) * 100}%`,
            width: `max(3px, ${(n.length / total) * 100}% - 1px)`,
            top: `${(1 - (n.degree - lo) / span) * 82}%`,
            background: color,
            opacity: 0.45 + 0.55 * n.velocity,
          }}
        />
      ))}
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Mapping({ plan }: { plan: IdeaPlan }) {
  useSoundNamesVersion();
  useEffect(() => void loadManifest().catch(() => undefined), []);
  if (plan.noteTrack)
    return (
      <div className={styles.map}>
        <div className={plan.noteTrack.trackId ? '' : styles.newTrack}>
          Notes → <b>{plan.noteTrack.trackId ? plan.noteTrack.trackName : 'new track'}</b>
          {!plan.noteTrack.trackId && ` (${plan.noteTrack.trackName} synth)`}
        </div>
      </div>
    );
  return (
    <div className={styles.map}>
      {plan.parts.map((a) => (
        <div key={a.part} className={a.trackId ? '' : styles.newTrack}>
          {a.label} → <b>{a.trackId ? a.trackName : 'new track'}</b>
          {!a.trackId && a.sampleId && ` (${soundInfo(a.sampleId).name})`}
        </div>
      ))}
      {plan.skipped.length > 0 && (
        <div className={styles.skipped}>
          Left out (16-track limit): {plan.skipped.map(partLabel).join(', ')}
        </div>
      )}
    </div>
  );
}

export function IdeasModal({ onClose }: { onClose: () => void }) {
  const song = useSongStore((s) => s.song);
  const { track, pattern } = useSelection();
  const [category, setCategory] = useState<IdeaCategory>(() => startCategory(track));
  const [genre, setGenre] = useState<Genre | null>(null);
  const [query, setQuery] = useState('');
  const list = useMemo(() => findIdeas(category, genre, query), [category, genre, query]);
  const [pickedId, setPickedId] = useState<string | null>(() => list[0]?.id ?? null);
  const picked = (pickedId && ideaById(pickedId)) || list[0] || null;
  const [setFeel, setSetFeel] = useState(() => picked?.category === 'groove');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const sel = { trackId: track?.id ?? null, patternId: pattern?.id ?? null };
  const planUse = picked ? planIdea(song, picked, sel, 'use') : null;
  const planNew = picked ? planIdea(song, picked, sel, 'new') : null;

  const pick = (idea: PatternIdea) => {
    setPickedId(idea.id);
    setSetFeel(idea.category === 'groove');
  };

  const stopPreview = () => {
    engine.stopSongPreview();
    setPlayingId(null);
  };

  const startPreview = (idea: PatternIdea, feel: boolean) => {
    const plan = planIdea(song, idea, sel, 'use');
    const p = buildPreviewSong(song, idea, plan, feel);
    if (!p) return;
    stopPlayback();
    setPlayingId(idea.id);
    engine.previewSong(p).catch((e) => {
      setPlayingId(null);
      toastError(e);
    });
  };

  const togglePreview = (idea: PatternIdea) => {
    if (playingId === idea.id) return stopPreview();
    const feel = idea.id === picked?.id ? setFeel : idea.category === 'groove';
    pick(idea);
    setSetFeel(feel);
    startPreview(idea, feel);
  };

  // stop the preview when the window closes
  useEffect(() => () => engine.stopSongPreview(), []);

  const apply = (plan: IdeaPlan) => {
    if (!picked) return;
    stopPreview();
    const r = useSongStore.getState().applyIdea(picked, plan, setFeel, sel.trackId);
    if (!r) return;
    const ui = useUiStore.getState();
    for (const [trackId, patternId] of Object.entries(r.patterns))
      ui.selectPattern(trackId, patternId);
    ui.selectTrack(r.focusTrackId);
    const added = r.addedTrackIds.length;
    toast({
      kind: 'info',
      message: `${picked.name} is in pattern ${plan.patternName}${added ? ` (${added} new track${added > 1 ? 's' : ''})` : ''}. Ctrl+Z undoes it.`,
    });
    onClose();
  };

  const counts = (c: IdeaCategory) =>
    IDEAS.filter((i) => i.category === c && (!genre || i.genres.includes(genre))).length;
  const forWhat =
    picked && !isDrumCategory(picked.category)
      ? planUse?.noteTrack?.trackId
        ? planUse.noteTrack.trackName
        : 'a new track'
      : 'your drum kit';

  return (
    <Modal
      title={
        <>
          Pattern ideas{' '}
          <span className={styles.for}>
            · for <span style={{ color: track?.color }}>{forWhat}</span>
          </span>
        </>
      }
      onClose={onClose}
      width={1080}
      footer={
        picked && planUse && planNew ? (
          <div className={styles.apply}>
            <div>
              <div className={styles.applyTitle}>
                {picked.name}{' '}
                <span className="muted small">
                  ·{' '}
                  {isDrumCategory(picked.category)
                    ? planUse.parts.length > 1
                      ? 'fills your whole kit'
                      : 'one drum part'
                    : `always in ${keyLabel(song.key)}`}
                </span>
              </div>
              {planUse.problem ? (
                <div className={styles.skipped}>{planUse.problem}</div>
              ) : (
                <Mapping plan={planUse} />
              )}
              <div className={styles.feel}>
                Sounds best around{' '}
                <b>
                  {picked.bpm[0]}–{picked.bpm[1]} BPM
                </b>
                {picked.swing ? (
                  <>
                    {' '}
                    with <b>{pct(picked.swing)} swing</b>
                  </>
                ) : null}{' '}
                ·{' '}
                <label {...tip('ideaFeel')}>
                  <input
                    type="checkbox"
                    checked={setFeel}
                    onChange={(e) => {
                      setSetFeel(e.target.checked);
                      if (playingId === picked.id) startPreview(picked, e.target.checked);
                    }}
                  />{' '}
                  also set tempo &amp; swing
                </label>
              </div>
              {picked.pairsWith && picked.pairsWith.length > 0 && (
                <div className={styles.pairs} {...tip('ideaPairs')}>
                  Goes well with:{' '}
                  {picked.pairsWith.map((id) => {
                    const other = ideaById(id)!;
                    return (
                      <button
                        key={id}
                        className={styles.link}
                        onClick={() => {
                          setQuery('');
                          setGenre(null);
                          setCategory(other.category);
                          pick(other);
                        }}
                      >
                        {other.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className={styles.actions}>
              <button
                onClick={() => togglePreview(picked)}
                aria-pressed={playingId === picked.id}
                {...tip('ideaPreview')}
              >
                {playingId === picked.id ? '■ Stop' : '▶ Preview'}
              </button>
              <button
                disabled={!!planNew.problem}
                onClick={() => apply(planNew)}
                {...tip('ideaAddNew')}
              >
                ＋ Add as new pattern
              </button>
              <button
                className="primary"
                disabled={!!planUse.problem}
                onClick={() => apply(planUse)}
                {...tip('ideaUse')}
              >
                Use (replace {planUse.patternName})
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className={styles.body}>
        <div
          className={styles.cats}
          role="tablist"
          aria-label="Idea types"
          {...tip('ideaCategories')}
        >
          {IDEA_CATEGORIES.map((c, i) => (
            <div key={c.id} className={styles.catGroup}>
              {i === 3 && <div className={styles.sep} />}
              <button
                role="tab"
                aria-selected={category === c.id && !query}
                className={category === c.id && !query ? styles.on : ''}
                onClick={() => {
                  setCategory(c.id);
                  setQuery('');
                  const first = findIdeas(c.id, genre, '')[0];
                  if (first) pick(first);
                }}
              >
                {c.label}
                <span>{counts(c.id)}</span>
              </button>
            </div>
          ))}
          <div className={styles.sep} />
          <p className={styles.keyNote}>
            Basslines, chords and melodies always fit your song's key ({keyLabel(song.key)}).
          </p>
        </div>
        <div className={styles.main}>
          <div className={styles.filters} role="group" aria-label="Genres" {...tip('ideaGenres')}>
            <button
              className={!genre ? styles.on : ''}
              aria-pressed={!genre}
              onClick={() => setGenre(null)}
            >
              All
            </button>
            {GENRES.map((g) => (
              <button
                key={g.id}
                className={genre === g.id ? styles.on : ''}
                aria-pressed={genre === g.id}
                onClick={() => setGenre(genre === g.id ? null : g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <input
            className={styles.search}
            type="search"
            placeholder="Search ideas… e.g. “boom bap”, “shuffle”, “rolls”"
            aria-label="Search ideas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            {...tip('ideaSearch')}
          />
          {list.length === 0 ? (
            <p className="muted">No ideas match. Try another genre or search.</p>
          ) : (
            <div className={styles.grid}>
              {list.map((idea) => (
                <div
                  key={idea.id}
                  className={`${styles.card} ${idea.id === picked?.id ? styles.on : ''}`}
                  onClick={() => pick(idea)}
                >
                  <div className={styles.top}>
                    <button
                      className={styles.cardName}
                      onClick={(e) => {
                        e.stopPropagation();
                        pick(idea);
                      }}
                      aria-pressed={idea.id === picked?.id}
                      {...tip('ideaCard')}
                    >
                      {idea.name}
                    </button>
                    <button
                      className={`${styles.pv} ${playingId === idea.id ? styles.playing : ''}`}
                      aria-label={`${playingId === idea.id ? 'Stop' : 'Preview'} ${idea.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreview(idea);
                      }}
                      {...tip('ideaPreview')}
                    >
                      {playingId === idea.id ? '■' : '▶'}
                    </button>
                  </div>
                  {isDrumCategory(idea.category) ? (
                    <DrumArt idea={idea} />
                  ) : (
                    <NoteArt idea={idea} color={track?.color ?? '#8b7bff'} />
                  )}
                  <div className={styles.desc}>{idea.description}</div>
                  <div className={styles.tags}>
                    {idea.genres.map((g) => (
                      <span key={g} className={`${styles.tag} ${styles.genre}`}>
                        {GENRES.find((x) => x.id === g)!.label}
                      </span>
                    ))}
                    <span className={styles.tag}>
                      {idea.bpm[0]}–{idea.bpm[1]} BPM
                    </span>
                    <span className={styles.tag}>
                      {idea.bars} bar{idea.bars > 1 ? 's' : ''}
                    </span>
                    {idea.grid === 24 && <span className={styles.tag}>triplets</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
