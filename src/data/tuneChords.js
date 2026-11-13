import { diatonicChords, diatonicSevenths, keyById, keyDisplay, MAJOR_KEYS } from './scales.js'
import { noteName } from './diminishedChords.js'

// The tune's chords, read in the app's major key. A minor tune resolves to its
// relative major, so the existing changes round plays it with no new theory:
// the degrees are the relative major's, and the numerals are the minor's.
const SUFFIX = {
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  halfDim: 'm7b5',
  dim7: '°7',
  maj: '',
  min: 'm',
  dim: '°',
}

const SEVENTH_QUALITY = { maj7: 'maj7', min7: 'min7', dom7: 'dom7', halfDim: 'halfdim7' }
const TRIAD_QUALITY = { maj: 'maj', min: 'min', dim: 'dim' }
// Also read by the chord-spec changes round, so the grading triad and the
// playing pitch set cannot drift apart.
export const INTERVALS = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  halfDim: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
}

const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii']
const MINOR_NUMERALS = { 6: 'i', 7: 'ii°', 1: 'III', 2: 'iv', 3: 'v', 4: 'VI', 5: 'VII' }

function toPcs(pc, quality) {
  const intervals = INTERVALS[quality]
  if (!intervals) return []
  return [...new Set(intervals.map((step) => (pc + step) % 12))].sort((a, b) => a - b)
}

// A measured key is useful without a chart, so the label reads from the key
// alone. A minor tune resolves to its relative major for the grid and the
// selector; the label keeps the minor's own name.
export function keyLabel({ pc = 0, mode = 'major' } = {}) {
  const tonic = (((Number(pc) || 0) % 12) + 12) % 12
  const minor = mode === 'minor'
  const relative = minor ? (tonic + 3) % 12 : tonic
  const key = MAJOR_KEYS.find((entry) => entry.tonic === relative) || MAJOR_KEYS[0]
  return {
    keyId: key.id,
    mode: minor ? 'minor' : 'major',
    label: minor ? `${keyById(key.id).scale[5]} MINOR` : `${keyDisplay(key.id)} MAJOR`,
    relativeOf: minor ? `RELATIVE OF ${keyDisplay(key.id)}` : null,
  }
}

// Given the tune's key and its chords, the grid the panel renders. Degrees are
// the relative major's 1..7; a chord outside the key gets no degree and no
// numeral, and is marked OUT. That is information, not a veto: JAM plays the
// literal pitch sets either way.
export function buildTuneView({ keyPc = 0, mode = 'major', chords = [] } = {}) {
  const { keyId, label, relativeOf } = keyLabel({ pc: keyPc, mode })
  const sevenths = diatonicSevenths(keyId)
  const triads = diatonicChords(keyId)

  const cells = (Array.isArray(chords) ? chords : []).map((chord, index) => {
    const pc = ((Number(chord?.pc) || 0) % 12 + 12) % 12
    const quality = chord?.quality
    const seventh = SEVENTH_QUALITY[quality]
      ? sevenths.find((entry) => entry.rootPc === pc && entry.quality === SEVENTH_QUALITY[quality])
      : null
    const triad = TRIAD_QUALITY[quality]
      ? triads.find((entry) => entry.rootPc === pc && entry.quality === TRIAD_QUALITY[quality])
      : null
    const found = seventh || triad
    return {
      id: `${index}:${pc}:${quality}`,
      pc,
      quality,
      name: `${noteName(pc)}${SUFFIX[quality] ?? ''}`,
      numeral: found ? (mode === 'minor' ? MINOR_NUMERALS[found.degree] : MAJOR_NUMERALS[found.degree - 1]) : null,
      degree: found ? found.degree : null,
      pcs: Array.isArray(chord?.pcs) && chord.pcs.length ? chord.pcs : toPcs(pc, quality),
      outside: !found,
    }
  })

  const outsideCount = cells.filter((cell) => cell.outside).length
  return {
    keyId,
    mode,
    label,
    relativeOf,
    cells,
    diatonic: outsideCount === 0,
    outsideCount,
  }
}

// A measured key that leaves most of the chart outside it is probably the wrong
// key (a minor tune read a third off). The model's own key replaces it only when
// it is measurably better; a tie or a worse model key keeps the measurement.
export function pickTuneKey({ audioKey = null, modelKey = null, chords = [] } = {}) {
  const bars = Array.isArray(chords) ? chords : []
  if (!audioKey) return modelKey || null
  if (!modelKey || !bars.length) return audioKey
  const outsideFor = (key) =>
    buildTuneView({ keyPc: key.pc, mode: key.mode, chords: bars }).outsideCount
  const audioOutside = outsideFor(audioKey)
  if (audioOutside * 2 <= bars.length) return audioKey
  return outsideFor(modelKey) < audioOutside ? modelKey : audioKey
}
