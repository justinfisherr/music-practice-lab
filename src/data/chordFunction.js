import { diatonicChords, keyById, keyDisplay } from './scales.js'

// Function analysis for FREE PLAY: take an identified chord and the current
// key, and say what it is doing. Diatonic chords get their numeral; the common
// chromatic chords get a named function and their resolution.
const QUALITY = {
  '': 'major',
  maj7: 'major',
  maj9: 'major',
  '6': 'major',
  '6/9': 'major',
  add9: 'major',
  m: 'minor',
  m7: 'minor',
  m6: 'minor',
  m9: 'minor',
  mMaj7: 'minor',
  madd9: 'minor',
  '7': 'dominant',
  '9': 'dominant',
  '7#9': 'dominant',
  '7b5': 'dominant',
  '7#5': 'dominant',
  '°': 'dim',
  '°7': 'dim',
  m7b5: 'dim',
  '+': 'aug',
  sus2: 'sus',
  sus4: 'sus',
}

const PARALLEL_MINOR = [
  { numeral: 'i', quality: 'minor', semis: 0 },
  { numeral: 'ii°', quality: 'dim', semis: 2 },
  { numeral: 'bIII', quality: 'major', semis: 3 },
  { numeral: 'iv', quality: 'minor', semis: 5 },
  { numeral: 'v', quality: 'minor', semis: 7 },
  { numeral: 'bVI', quality: 'major', semis: 8 },
  { numeral: 'bVII', quality: 'major', semis: 10 },
]

function qualityOf(suffix) {
  return QUALITY[suffix] || 'other'
}

// The base triad a chord is built on. Dominant sevenths are major triads.
function baseOf(quality) {
  if (quality === 'dominant') return 'major'
  if (quality === 'major' || quality === 'minor' || quality === 'dim') return quality
  return quality
}

function diatonicBase(chord) {
  if (chord.quality === 'maj') return 'major'
  if (chord.quality === 'min') return 'minor'
  return 'dim'
}

export function analyzeFunction(analysis, keyId) {
  if (!analysis || analysis.kind !== 'chord' || !Number.isInteger(analysis.root)) return null
  const quality = qualityOf(analysis.suffix)
  const base = baseOf(quality)
  const key = keyById(keyId)
  const chords = diatonicChords(keyId)
  const root = analysis.root
  const degree = chords.find((chord) => chord.rootPc === root)
  const tonic = chords[0]
  const targetDegree = (targetRoot) =>
    chords.find((chord) => chord.rootPc === targetRoot && chord.degree !== 1)

  // Diatonic. A dominant 7 belongs here only on the V; elsewhere it is a
  // secondary dominant (C7 = V/IV, D7 = V/V, etc.).
  if (degree && base === diatonicBase(degree)) {
    const dominantOffTheFive = quality === 'dominant' && degree.degree !== 5
    if (!dominantOffTheFive) {
      return {
        inKey: true,
        label: degree.numeral,
        target: null,
        foundation: 'function',
        detail: `diatonic in ${keyDisplay(keyId)} major: ${degree.numeral}.`,
      }
    }
  }

  // Secondary dominant: a major triad/dominant a fifth above a diatonic degree.
  if (base === 'major') {
    const target = targetDegree((root + 5) % 12)
    if (target) {
      return {
        inKey: false,
        label: `${quality === 'dominant' ? 'V7' : 'V'}/${target.numeral}`,
        target: target.name,
        foundation: 'secondary-dominants',
        detail: `the dominant of ${target.numeral}; pulls to ${target.name}.`,
      }
    }
  }

  // Secondary leading-tone: a diminished chord a semitone under a degree.
  if (base === 'dim') {
    const target = targetDegree((root + 1) % 12)
    if (target) {
      return {
        inKey: false,
        label: `${analysis.suffix === '°7' ? 'vii°7' : 'vii°'}/${target.numeral}`,
        target: target.name,
        foundation: 'secondary-dominants',
        detail: `the leading tone of ${target.numeral}; pulls to ${target.name}.`,
      }
    }
  }

  // Chromatic dominants.
  if (quality === 'dominant') {
    const dominantRoot = (key.tonic + 7) % 12
    if ((root - dominantRoot + 12) % 12 === 6) {
      return {
        inKey: false,
        label: 'subV7/I',
        target: tonic.name,
        foundation: 'secondary-dominants',
        detail: 'a tritone substitute for V; resolves to I.',
      }
    }
    if (root === (key.tonic + 10) % 12) {
      return {
        inKey: false,
        label: 'bVII7',
        target: tonic.name,
        foundation: 'borrowed-chords',
        detail: 'a backdoor dominant; resolves to I.',
      }
    }
  }

  // Borrowed from the parallel minor.
  const borrowed = PARALLEL_MINOR.find(
    (chord) => (key.tonic + chord.semis) % 12 === root && chord.quality === base,
  )
  if (borrowed) {
    return {
      inKey: false,
      label: borrowed.numeral,
      target: null,
      foundation: 'borrowed-chords',
      detail: `borrowed from the parallel minor (${borrowed.numeral}).`,
    }
  }

  return {
    inKey: false,
    label: 'OUTSIDE',
    target: null,
    foundation: null,
    detail: 'outside the key — no standard function found.',
  }
}
