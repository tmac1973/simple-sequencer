import { engine } from '@/audio/engine';
import type { Track } from '@/model/types';
import { soundInfo } from '@/library/soundNames';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { Knob } from '../components/Knob';
import { Toggle } from '../components/controls';
import { Waveform } from '../components/Waveform';
import { useSoundNamesVersion } from '../hooks/useSoundNames';
import { trackIcon } from '../layout/TrackList';
import { tip } from '../tooltips';
import {
  fmtPan,
  fmtPct,
  fmtSemis,
  fmtTone,
  knobToPan,
  knobToPitch,
  panToKnob,
  pitchToKnob,
} from './format';
import { RootNoteSelect } from './RootNoteSelect';
import { useAutoKnob } from '../hooks/useAutoKnob';
import styles from './Inspector.module.css';

export function SampleSoundTab({ track }: { track: Track }) {
  useSoundNamesVersion();
  const s = track.sample!;
  const a = useSongStore.getState();
  const ui = useUiStore.getState();
  const info = soundInfo(s.sampleId);
  const toneA = useAutoKnob(track, { kind: 'sampleTone' });
  const panA = useAutoKnob(track, { kind: 'track', param: 'pan' });
  return (
    <>
      <div className={styles.card}>
        <div className={styles.row}>
          <span style={{ fontSize: 20 }}>{trackIcon(track)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{info.name}</b>
            <div className="small muted">{info.detail ?? ''}</div>
          </div>
          <button
            className="icon"
            aria-label="Preview sound"
            onClick={() => void engine.preview(s.sampleId, s)}
            {...tip('preview')}
          >
            ▶
          </button>
        </div>
        <div className={styles.wave}>
          <Waveform sampleId={s.sampleId} color={track.color} reverse={s.edit.reverse} />
        </div>
        <div className={styles.row}>
          <button
            style={{ flex: 1 }}
            onClick={() => ui.openModalId('browser')}
            {...tip('changeSound')}
          >
            🔍 Change sound
          </button>
          <button onClick={() => ui.openModalId('sampleEditor')} {...tip('editSample')}>
            ✂ Edit
          </button>
        </div>
      </div>
      <div className={styles.knobs}>
        <Knob
          label="Pitch"
          tipKey="pitch"
          color={track.color}
          value={pitchToKnob(s.edit.tuneSemitones)}
          defaultValue={0.5}
          format={(v) => fmtSemis(knobToPitch(v))}
          onChange={(v, g) => a.setSampleEdit(track.id, { tuneSemitones: knobToPitch(v) }, g)}
        />
        <Knob
          label="Decay"
          tipKey="decay"
          color={track.color}
          value={s.edit.fadeOut}
          defaultValue={0}
          format={(v) => (v < 0.01 ? 'Full' : fmtPct(v))}
          onChange={(v, g) => a.setSampleEdit(track.id, { fadeOut: v }, g)}
        />
        <Knob
          label="Tone"
          tipKey="tone"
          color={track.color}
          value={toneA.live ?? s.tone}
          automated={toneA.automated}
          defaultValue={1}
          format={fmtTone}
          onChange={(v, g) => a.setSampleSettings(track.id, { tone: v }, g)}
        />
        <Knob
          label="Pan"
          tipKey="pan"
          color={track.color}
          value={panA.live ?? panToKnob(track.pan)}
          automated={panA.automated}
          defaultValue={0.5}
          format={(v) => fmtPan(knobToPan(v))}
          onChange={(v, g) => a.setPan(track.id, knobToPan(v), g)}
        />
      </div>
      <label className={styles.lineField} {...tip('melodic')}>
        <span>
          <b>Melodic</b> <span className="small muted">play it in a piano roll</span>
        </span>
        <Toggle
          on={s.melodic}
          onChange={(v) => a.setSampleSettings(track.id, { melodic: v })}
          label="Melodic"
        />
      </label>
      {s.melodic && (
        <div className={styles.lineField} {...tip('rootNote')}>
          <span>Root note</span>
          <RootNoteSelect
            value={s.rootMidi}
            onChange={(m) => a.setSampleSettings(track.id, { rootMidi: m })}
          />
        </div>
      )}
    </>
  );
}
