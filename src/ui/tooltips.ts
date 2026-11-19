/**
 * All tooltip copy in one place, in plain English. Elements opt in with `{...tip('key')}`.
 * A literal "Title|Body" string also works for one-off tips.
 */
export interface TipCopy {
  title: string;
  body: string;
}

export const TIPS: Record<string, TipCopy> = {
  // top bar
  songName: { title: 'Song name', body: 'Click to rename. Your song saves automatically.' },
  play: { title: 'Play / Stop', body: 'Start or stop the music. Shortcut: Space.' },
  playMode: {
    title: 'What plays',
    body: "'Pattern' loops just the pattern you're editing. 'Song' plays the whole timeline.",
  },
  tempo: {
    title: 'Tempo (BPM)',
    body: 'How fast the song is, in beats per minute. Lo-fi is usually 70–90, house about 120–128. Click the number to type, or drag it up/down.',
  },
  key: {
    title: 'Key',
    body: 'The home note of your song. Synth tracks only show notes that fit the key, so nothing sounds "wrong".',
  },
  scale: {
    title: 'Scale',
    body: 'The mood of the notes. Minor sounds moody, major sounds bright. Pentatonic is extra safe for melodies.',
  },
  swing: {
    title: 'Swing',
    body: 'Delays every other step slightly for a bouncy, human groove. Try 20–40% for hip-hop and lo-fi.',
  },
  undo: { title: 'Undo', body: 'Take back your last change. Shortcut: Ctrl+Z (⌘Z on Mac).' },
  redo: { title: 'Redo', body: 'Put back what you undid. Shortcut: Ctrl+Shift+Z.' },
  saveStatus: { title: 'Autosave', body: 'Every change is saved in this browser automatically.' },
  songs: { title: 'Songs', body: 'Start a new song, open a saved one, or load a song file.' },
  export: {
    title: 'Export',
    body: 'Turn your song into a WAV or MP3 file you can share, or save a song file to back it up.',
  },
  tips: { title: 'Tips', body: 'Turn these hover tips on or off.' },
  shortcuts: { title: 'Keyboard shortcuts', body: 'See every shortcut. Press ? anytime.' },
  about: { title: 'About & credits', body: 'Who made the sounds and libraries in this app.' },

  // track list
  paint: {
    title: 'Painting patterns',
    body: 'Pick a pattern letter in the editor below, then click or drag on the timeline to paint it in.',
  },
  trackRow: {
    title: 'Track',
    body: 'Click to edit this track. Double-click the name to rename. Right-click for more. Drag to reorder.',
  },
  volume: { title: 'Volume', body: 'How loud this track is.' },
  volumeAutomated: {
    title: 'Volume (automated)',
    body: 'This volume is automated. Edit its lane in the timeline.',
  },
  mute: { title: 'Mute', body: 'Silence this track.' },
  solo: { title: 'Solo', body: 'Hear only this track (and any other soloed tracks).' },
  addSample: {
    title: 'Add a drum / sample track',
    body: 'Plays a sound (kick, snare, your own recording…) on a step grid.',
  },
  addSynth: {
    title: 'Add a synth track',
    body: 'A built-in instrument for bass, chords and melodies.',
  },
  trackLimit: { title: 'Track limit', body: 'A song can have up to 16 tracks.' },

  // timeline
  ruler: {
    title: 'Song start',
    body: 'Click a bar number to choose where Song mode starts playing.',
  },
  timelineEmpty: {
    title: 'Empty bar',
    body: 'Click to paint the selected pattern here. Drag to paint several bars.',
  },
  timelineBlock: {
    title: 'Pattern block',
    body: 'Click to remove it. Click an empty bar to paint.',
  },
  addBars: { title: 'Longer song', body: 'Add 4 more bars to the end of the song.' },
  removeBars: { title: 'Shorter song', body: 'Remove 4 bars from the end of the song.' },
  shortenBlocked: {
    title: 'Shorter song',
    body: 'There are pattern blocks in the last bars. Remove them first, or use Trim.',
  },
  trimSong: { title: 'Trim', body: 'Make the song end right after its last pattern block.' },
  songEnd: {
    title: 'Song end',
    body: 'Drag left or right to make the song shorter or longer. It stops at your last pattern block.',
  },

  // editor
  patterns: {
    title: 'Patterns',
    body: 'Each track can have several patterns (A, B, C…). Click one to edit it and to paint it on the timeline.',
  },
  newPattern: {
    title: 'New pattern',
    body: 'Make a fresh empty pattern, or copy this one to start a variation.',
  },
  patternLength: {
    title: 'Pattern length',
    body: 'How many bars this pattern lasts before it repeats.',
  },
  grid: {
    title: 'Step size',
    body: "16ths are the normal grid. Triplets fit 3 steps per half-beat, which suits shuffles and trap hi-hats. Triplets don't swing.",
  },
  drumView: {
    title: 'Show all drums',
    body: 'See every drum track together, like a classic drum machine, so you can build a whole beat in one place.',
  },
  clear: { title: 'Clear pattern', body: 'Removes every note in this pattern. You can undo it.' },
  step: { title: 'Step', body: 'Click: on/off · Drag up/down: louder/softer.' },
  chordStamp: {
    title: 'Chord stamp',
    body: 'When on, one click places a whole chord that fits the key.',
  },
  pianoKeys: {
    title: 'Notes in your key',
    body: "Only notes that fit the song's key are shown. ● marks the home note.",
  },
  pianoGrid: {
    title: 'Piano roll',
    body: 'Click to add a note. Drag a note to move it, drag its right edge to make it longer. Right-click to delete.',
  },
  octaveUp: { title: 'Higher notes', body: 'Show the octave above.' },
  octaveDown: { title: 'Lower notes', body: 'Show the octave below.' },
  noteVelocity: {
    title: 'Note loudness',
    body: 'Drag a bar up or down to make that note louder or softer.',
  },

  // inspector
  tabSound: { title: 'Sound', body: 'Choose and shape what this track sounds like.' },
  tabFx: { title: 'Effects', body: 'Add effects like reverb or distortion to this track.' },
  tabAuto: {
    title: 'Automation',
    body: 'Make a knob move by itself over the song, e.g. a filter sweep into the drop.',
  },
  preview: { title: 'Preview', body: 'Hear this sound.' },
  changeSound: {
    title: 'Change sound',
    body: 'Browse built-in sounds, import a file or record your own.',
  },
  editSample: { title: 'Edit sample', body: 'Trim, reverse, tune or loop this sound.' },
  pitch: { title: 'Pitch', body: 'Tune the sound up or down, in semitones (piano keys).' },
  decay: {
    title: 'Decay',
    body: 'Fade the end of each hit. Turn it up for shorter, tighter hits.',
  },
  tone: {
    title: 'Tone',
    body: 'Turn left to make the sound darker and softer, right for brighter.',
  },
  pan: { title: 'Pan', body: 'Move the sound to the left or right speaker.' },
  melodic: {
    title: 'Melodic',
    body: 'Play this sound at different pitches in a piano roll, like an instrument.',
  },
  rootNote: {
    title: 'Root note',
    body: "The note this sample was recorded at, so it plays in tune. Leave it if you're not sure.",
  },
  preset: {
    title: 'Preset',
    body: 'A ready-made synth sound. Pick one, then shape it with the knobs.',
  },
  macroTone: { title: 'Tone', body: 'Darker ↔ brighter.' },
  macroPunch: {
    title: 'Punch',
    body: 'How sharply each note starts. Turn up for snappy, plucky notes.',
  },
  macroSpace: { title: 'Space', body: 'Adds a little room around the sound.' },
  macroLength: { title: 'Length', body: 'How long notes ring out after they start.' },
  advanced: {
    title: 'Advanced',
    body: "Waveforms, filter, envelope and vibrato settings for when you're curious.",
  },
  resetPreset: { title: 'Reset', body: 'Undo all advanced tweaks and go back to the preset.' },
  knob: {
    title: 'Knob',
    body: 'Drag up or down to change. Double-click to reset. Hold Shift for fine control.',
  },
  templates: {
    title: 'Templates',
    body: 'Pick a starting point. Every template is already playable. Press Space to hear it.',
  },
  soundCategories: {
    title: 'Sound types',
    body: 'Browse sounds by type. My Sounds holds the sounds you imported or recorded.',
  },
  soundSearch: {
    title: 'Search',
    body: 'Type a name, kit or type of sound, like "kick", "808" or "snap".',
  },
  useSound: { title: 'Use this sound', body: 'Put the selected sound on this track.' },
  resetEdit: { title: 'Reset', body: 'Undo every edit and go back to the original sound.' },
  exportFormat: {
    title: 'File type',
    body: 'MP3 is small and plays everywhere. WAV is full quality.',
  },
  exportQuality: {
    title: 'Quality',
    body: 'Higher quality sounds better but makes a bigger file.',
  },
  exportRange: {
    title: 'What to export',
    body: 'The whole song, or just the pattern you are editing, repeated a few times.',
  },
  exportRepeats: { title: 'Repeats', body: 'How many times the pattern loop plays in the file.' },
  exportGo: { title: 'Export', body: 'Make the audio file. It downloads when it is ready.' },
  exportCancel: { title: 'Cancel', body: 'Stop making the file.' },
  comingSoon: { title: 'Coming soon', body: 'This part of the app is on its way.' },
  laneShow: { title: 'Show / hide', body: 'Hide the lane in the timeline. It still plays.' },
  laneAdd: {
    title: 'Add automation',
    body: 'Adds a line under the track in the timeline. Click the line to add points and shape how this knob moves.',
  },
  fxToggle: { title: 'On / off', body: 'Switch this effect off to hear the difference.' },
  fxRemove: { title: 'Remove effect', body: 'Take this effect off the track. You can undo it.' },
  'fx.reverb.size': {
    title: 'Size',
    body: 'How big the space sounds, from a small room to a huge hall.',
  },
  'fx.reverb.amount': {
    title: 'Amount',
    body: 'How much reverb you hear compared to the dry sound.',
  },
  'fx.reverb.predelay': {
    title: 'Pre-delay',
    body: 'A short gap before the reverb starts. Keeps vocals and drums clear.',
  },
  'fx.delay.time': {
    title: 'Time',
    body: 'How far apart the echoes are, locked to the song tempo.',
  },
  'fx.delay.amount': { title: 'Amount', body: 'How loud the echoes are.' },
  'fx.delay.feedback': {
    title: 'Repeats',
    body: 'How many times the echo repeats before fading away.',
  },
  'fx.filter.cutoff': {
    title: 'Cutoff',
    body: 'Turn left for darker and muffled, right for bright and open.',
  },
  'fx.filter.resonance': {
    title: 'Resonance',
    body: 'Adds a whistly peak at the cutoff. Great for sweeps.',
  },
  'fx.distortion.drive': {
    title: 'Drive',
    body: 'How hard the sound is pushed. More drive means more grit.',
  },
  'fx.distortion.amount': { title: 'Amount', body: 'Blend between the clean and distorted sound.' },
  'fx.compressor.squash': {
    title: 'Squash',
    body: 'How much loud parts are turned down so everything sits more evenly.',
  },
  'fx.compressor.makeup': { title: 'Boost', body: 'Turn the sound back up after squashing it.' },
  'fx.compressor.attack': {
    title: 'Attack',
    body: 'How quickly squashing kicks in. Slower lets drum hits punch through.',
  },
  'fx.compressor.release': { title: 'Release', body: 'How quickly squashing lets go.' },
  'fx.eq.low': { title: 'Low', body: 'Turn the bass up or down.' },
  'fx.eq.mid': { title: 'Mid', body: 'Turn the middle (body) of the sound up or down.' },
  'fx.eq.high': { title: 'High', body: 'Turn the treble (sparkle) up or down.' },
  'fx.eq.lowFreq': { title: 'Low edge', body: 'Where "low" ends and "mid" begins.' },
  'fx.eq.highFreq': { title: 'High edge', body: 'Where "mid" ends and "high" begins.' },
  'fx.chorus.width': { title: 'Width', body: 'How wide and wobbly the doubled sound gets.' },
  'fx.chorus.amount': { title: 'Amount', body: 'Blend between the normal and chorused sound.' },
  'fx.chorus.rate': { title: 'Speed', body: 'How fast the shimmer moves.' },
  'fx.bitcrush.crush': { title: 'Crush', body: 'Fewer bits = rougher, more retro sound.' },
  'fx.bitcrush.amount': { title: 'Amount', body: 'Blend between the clean and crushed sound.' },
  'fx.bitcrush.down': {
    title: 'Downsample',
    body: 'Lowers the sample rate for a gritty, old-sampler sound.',
  },
};

export function tip(key: string): { 'data-tip': string } {
  return { 'data-tip': key };
}

export function resolveTip(value: string): TipCopy | null {
  if (TIPS[value]) return TIPS[value];
  const i = value.indexOf('|');
  if (i > 0) return { title: value.slice(0, i), body: value.slice(i + 1) };
  return value ? { title: value, body: '' } : null;
}
