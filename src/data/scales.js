import { normalizePitchClasses } from './diminishedChords.js'

// Major-key theory: 12 keys (one per pitch class) and their seven diatonic
// triads. Spelling follows the circle of fifths — sharp keys from G round to B,
// flat keys from F back to Gb — so chord names read naturally ("F#m", not "Gbm").
// Grading in the MIDI engine is by pitch class only, so spelling is display
// sugar and never affects correctness.

export const MAJOR_KEYS = [
  { id: 'C', tonic: 0, label: 'C', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  { id: 'G', tonic: 7, label: 'G', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] },
  { id: 'D', tonic: 2, label: 'D', scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] },
  { id: 'A', tonic: 9, label: 'A', scale: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'] },
  { id: 'E', tonic: 4, label: 'E', scale: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'] },
  { id: 'B', tonic: 11, label: 'B', scale: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'] },
  { id: 'Gb', tonic: 6, label: 'Gb', scale: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'] },
  { id: 'Db', tonic: 1, label: 'Db', scale: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'] },
  { id: 'Ab', tonic: 8, label: 'Ab', scale: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'] },
  { id: 'Eb', tonic: 3, label: 'Eb', scale: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'] },
  { id: 'Bb', tonic: 10, label: 'Bb', scale: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'] },
  { id: 'F', tonic: 5, label: 'F', scale: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'] },
]

// Diatonic triad quality per scale degree (major key). Index = degree - 1.
const DEGREES = [
  { numeral: 'I', quality: 'maj' },
  { numeral: 'ii', quality: 'min' },
  { numeral: 'iii', quality: 'min' },
  { numeral: 'IV', quality: 'maj' },
  { numeral: 'V', quality: 'maj' },
  { numeral: 'vi', quality: 'min' },
  { numeral: 'vii°', quality: 'dim' },
]

const QUALITY_INTERVALS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] }
const QUALITY_SUFFIX = { maj: '', min: 'm', dim: '°' }

// Scale degree -> semitones above tonic (major scale).
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

export function keyById(id) {
  return MAJOR_KEYS.find((k) => k.id === id) ?? MAJOR_KEYS[0]
}

export function keyName(keyId) {
  return `${keyDisplay(keyId)} MAJOR`
}

// v3 displays the sixth fifth as F#: the key id stays 'Gb' for the server and
// ledger filters, but every surface renders the jazz-friendly spelling.
export function keyDisplay(id) {
  return id === 'Gb' ? 'F#' : keyById(id).label
}

// Natural relative minor: the same seven notes, centered on the 6th degree.
export function relativeMinor(keyId) {
  const key = keyById(keyId)
  const tonic = (key.tonic + 9) % 12
  const scale = [...key.scale.slice(5), ...key.scale.slice(0, 5)]
  const steps = [0, 2, 3, 5, 7, 8, 10]
  return {
    id: `${key.id}m`,
    name: `${key.scale[5]} MINOR`,
    label: key.scale[5],
    scale: [...scale, scale[0]],
    pcs: [...steps.map((step) => (tonic + step) % 12), tonic],
  }
}

// The seven diatonic triads of a major key, in order I..vii°.
//   name          — display chord name ("F#m")
//   numeral       — roman-numeral function ("ii")
//   notes         — spelled note names, root-third-fifth order ("F#", "A", "C#")
//   pitchClasses  — raw semitone classes the engine grades against
export function diatonicChords(keyId) {
  const key = keyById(keyId)
  return DEGREES.map((deg, i) => {
    const rootPc = (key.tonic + MAJOR_STEPS[i] + 12) % 12
    return {
      keyId: key.id,
      keyLabel: key.label,
      degree: i + 1,
      rootPc,
      numeral: deg.numeral,
      quality: deg.quality,
      name: `${key.scale[i]}${QUALITY_SUFFIX[deg.quality]}`,
      notes: [0, 2, 4].map((j) => key.scale[(i + j) % 7]),
      pitchClasses: normalizePitchClasses(
        QUALITY_INTERVALS[deg.quality].map((iv) => rootPc + iv),
      ),
    }
  })
}

// The seven diatonic seventh chords of a major key, I..viiø7.
//   numeral       — roman-numeral function with its seventh ("ii7", "viiø7")
//   name          — display chord name in the key's spelling ("F#m7b5")
//   notes         — spelled root-third-fifth-seventh, in that order
//   pitchClasses  — the same four in root order, so an inversion can rotate them
const SEVENTHS = [
  { numeral: 'Imaj7', quality: 'maj7', suffix: 'maj7' },
  { numeral: 'iim7', quality: 'min7', suffix: 'm7' },
  { numeral: 'iiim7', quality: 'min7', suffix: 'm7' },
  { numeral: 'IVmaj7', quality: 'maj7', suffix: 'maj7' },
  { numeral: 'V7', quality: 'dom7', suffix: '7' },
  { numeral: 'vim7', quality: 'min7', suffix: 'm7' },
  { numeral: 'viiø7', quality: 'halfdim7', suffix: 'm7b5' },
]

const SEVENTH_STEPS = [0, 2, 4, 6] // scale degrees 1, 3, 5, 7

export function diatonicSevenths(keyId) {
  const key = keyById(keyId)
  return SEVENTHS.map((entry, i) => {
    const notes = SEVENTH_STEPS.map((step) => key.scale[(i + step) % 7])
    const pitchClasses = SEVENTH_STEPS.map(
      (step) => (key.tonic + MAJOR_STEPS[(i + step) % 7]) % 12,
    )
    return {
      degree: i + 1,
      rootPc: pitchClasses[0],
      numeral: entry.numeral,
      quality: entry.quality,
      name: `${notes[0]}${entry.suffix}`,
      notes,
      pitchClasses,
    }
  })
}
