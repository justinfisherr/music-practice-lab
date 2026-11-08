import { MAJOR_KEYS, diatonicChords } from './scales.js'

// Circle-of-fifths geometry for FREE PLAY, kept pure so it can be tested
// without rendering. Positions are MAJOR_KEYS indexes (C G D A E B Gb Db Ab Eb
// Bb F); the selected key is rotated to 12 o'clock at render time.

const MINOR_SUFFIXES = new Set(['m', 'm7', 'm6', 'm9', 'mMaj7', 'madd9'])

export function isMinorSuffix(suffix) {
  return MINOR_SUFFIXES.has(suffix)
}

export function keyIndexForTonic(pc) {
  const tonic = ((pc % 12) + 12) % 12
  return MAJOR_KEYS.findIndex((key) => key.tonic === tonic)
}

// Minor chords sit on the inner (relative-minor) ring of the major key a minor
// third above their root; everything else sits on its own major root slice.
export function sliceForRoot(root, suffix) {
  if (!Number.isInteger(root)) return null
  if (isMinorSuffix(suffix)) {
    return { index: keyIndexForTonic((root + 3) % 12), ring: 'inner' }
  }
  return { index: keyIndexForTonic(root), ring: 'outer' }
}

const suffixForQuality = (quality) =>
  quality === 'min' ? 'm' : quality === 'dim' ? '°' : ''

// The key's seven diatonic numerals, placed on the slice each chord occupies.
// Returns Map<keyIndex, { outer?: numeral, inner?: numeral }>.
export function diatonicMarks(keyId) {
  const marks = new Map()
  for (const chord of diatonicChords(keyId)) {
    const slice = sliceForRoot(chord.rootPc, suffixForQuality(chord.quality))
    if (!slice || slice.index < 0) continue
    const entry = marks.get(slice.index) || {}
    entry[slice.ring] = chord.numeral
    marks.set(slice.index, entry)
  }
  return marks
}

// Where the function's resolution target lives, or null when it stays in key.
export function targetSlice(fn, keyId) {
  if (!fn || !fn.target) return null
  const chord = diatonicChords(keyId).find((entry) => entry.name === fn.target)
  return chord ? sliceForRoot(chord.rootPc, suffixForQuality(chord.quality)) : null
}

// Degrees clockwise from the selected key: 0 at 12 o'clock.
export function sliceAngle(index, selectedIndex) {
  return ((index - selectedIndex + 12) % 12) * 30
}
