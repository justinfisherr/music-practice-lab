import { noteName, normalizePitchClasses } from './diminishedChords.js'

// Chord *qualities* used to build custom quizzes. Each type is a root-relative
// set of semitone intervals plus a display name and the suffix used when
// spelling the chord (e.g. root C + `min` -> "Cm"). This is the generation
// counterpart to chordDictionary.js's TEMPLATES (which does recognition); kept
// separate so the two can evolve independently without breaking FREE PLAY.
//
// `dim` is intentionally first-ish and used as the default selection — the app
// started life as a diminished trainer and that stays the sensible default.
export const CHORD_TYPES = [
  { id: 'maj', name: 'MAJOR', suffix: '', intervals: [0, 4, 7] },
  { id: 'min', name: 'MINOR', suffix: 'm', intervals: [0, 3, 7] },
  { id: 'dim', name: 'DIMINISHED', suffix: '°', intervals: [0, 3, 6] },
  { id: 'aug', name: 'AUGMENTED', suffix: '+', intervals: [0, 4, 8] },
  { id: 'sus2', name: 'SUS2', suffix: 'sus2', intervals: [0, 2, 7] },
  { id: 'sus4', name: 'SUS4', suffix: 'sus4', intervals: [0, 5, 7] },
  { id: 'maj7', name: 'MAJOR 7TH', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'dom7', name: 'DOMINANT 7TH', suffix: '7', intervals: [0, 4, 7, 10] },
  { id: 'min7', name: 'MINOR 7TH', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'mMaj7', name: 'MINOR-MAJOR 7TH', suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
  { id: 'm7b5', name: 'HALF-DIMINISHED 7TH', suffix: 'm7b5', intervals: [0, 3, 6, 10] },
  { id: 'dim7', name: 'DIMINISHED 7TH', suffix: '°7', intervals: [0, 3, 6, 9] },
  { id: 'maj6', name: 'MAJOR 6TH', suffix: '6', intervals: [0, 4, 7, 9] },
  { id: 'min6', name: 'MINOR 6TH', suffix: 'm6', intervals: [0, 3, 7, 9] },
  { id: 'dom9', name: 'DOMINANT 9TH', suffix: '9', intervals: [0, 2, 4, 7, 10] },
]

export const DEFAULT_TYPE_ID = 'dim'

export function chordTypeById(id) {
  return CHORD_TYPES.find((t) => t.id === id) ?? CHORD_TYPES[0]
}

// Build a concrete chord from a root pitch class (0-11) and a chord-type id.
// Returns everything the drill engine needs to prompt and grade it.
export function buildChord(root, typeId) {
  const type = chordTypeById(typeId)
  const r = ((root % 12) + 12) % 12
  const pitchClasses = normalizePitchClasses(type.intervals.map((i) => r + i))
  return {
    name: `${noteName(r)}${type.suffix}`,
    root: r,
    typeId: type.id,
    pitchClasses,
    notes: type.intervals.map((i) => noteName(r + i)),
    notesToCollect: pitchClasses.length,
  }
}
