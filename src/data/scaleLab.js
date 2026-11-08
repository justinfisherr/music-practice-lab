import { keyById, relativeMinor } from './scales.js'
import { noteName } from './diminishedChords.js'

// Scale Lab harmony: the major home, its relative minor, and the parallel
// minor. Everything is derived from the key so the keyboard, the ear, and the
// borrowed chords can never disagree.
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]
const BLUES_STEPS = [0, 3, 5, 6, 7, 10]
const TRIAD_INTERVALS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] }
const TRIAD_SUFFIX = { maj: '', min: 'm', dim: '°' }
const MINOR_CHORDS = [
  { numeral: 'i', quality: 'min' },
  { numeral: 'ii°', quality: 'dim' },
  { numeral: 'bIII', quality: 'maj' },
  { numeral: 'iv', quality: 'min' },
  { numeral: 'v', quality: 'min' },
  { numeral: 'bVI', quality: 'maj' },
  { numeral: 'bVII', quality: 'maj' },
]

export function labForKey(keyId) {
  const key = keyById(keyId)
  const majorPcs = MAJOR_STEPS.map((step) => (key.tonic + step) % 12)
  const major = {
    id: 'major',
    name: `${key.scale[0]} MAJOR`,
    notes: [...key.scale, key.scale[0]],
    pcs: [...majorPcs, key.tonic],
    homePc: key.tonic,
  }

  const rel = relativeMinor(keyId)
  const relative = {
    id: 'relative',
    name: rel.name,
    notes: rel.scale,
    pcs: rel.pcs,
    homePc: rel.pcs[0],
  }

  const parallelPcs = MINOR_STEPS.map((step) => (key.tonic + step) % 12)
  const parallelNotes = parallelPcs.map(noteName)
  const parallel = {
    id: 'parallel',
    name: `${noteName(key.tonic)} MINOR`,
    notes: [...parallelNotes, parallelNotes[0]],
    pcs: [...parallelPcs, key.tonic],
    homePc: key.tonic,
  }

  const borrowedNotes = parallelPcs
    .filter((pc) => !majorPcs.includes(pc))
    .map((pc) => ({ pc, name: noteName(pc) }))

  const bluesPcs = BLUES_STEPS.map((step) => (key.tonic + step) % 12)
  const bluesNotes = bluesPcs.map(noteName)
  const blues = {
    id: 'blues',
    name: `${key.scale[0]} BLUES`,
    notes: [...bluesNotes, bluesNotes[0]],
    pcs: [...bluesPcs, key.tonic],
    homePc: key.tonic,
  }

  const borrowedChords = MINOR_CHORDS.map((chord, index) => {
    const rootPc = parallelPcs[index]
    return {
      numeral: chord.numeral,
      quality: chord.quality,
      name: `${noteName(rootPc)}${TRIAD_SUFFIX[chord.quality]}`,
      rootPc,
      notes: [0, 2, 4].map((offset) => parallelNotes[(index + offset) % 7]),
      pcs: TRIAD_INTERVALS[chord.quality].map((interval) => (rootPc + interval) % 12),
    }
  })

  return { major, relative, parallel, blues, borrowedNotes, borrowedChords }
}

// Diatonic seventh on a scale degree, stacked in scale thirds. Pass the seven
// unique pitch classes (no octave) of the current home.
export function seventhByDegreeForScale(scalePcs, degree) {
  const size = scalePcs.length
  const root = scalePcs[(degree - 1) % size]
  const third = scalePcs[(degree + 1) % size]
  const fifth = scalePcs[(degree + 3) % size]
  const seventh = scalePcs[(degree + 5) % size]
  const thirdGap = (third - root + 12) % 12
  const fifthGap = (fifth - root + 12) % 12
  const seventhGap = (seventh - root + 12) % 12
  const quality =
    thirdGap === 4
      ? seventhGap === 11
        ? 'maj7'
        : '7'
      : fifthGap === 6
        ? 'halfDim'
        : seventhGap === 11
          ? 'minMaj7'
          : 'min7'
  const suffix = { maj7: 'maj7', '7': '7', min7: 'm7', halfDim: 'ø7', minMaj7: 'mMaj7' }[quality]
  return {
    pcs: [root, third, fifth, seventh],
    notes: [root, third, fifth, seventh].map(noteName),
    label: `${noteName(root)}${suffix}`,
  }
}

// Diatonic triad on a scale degree, stacked in scale thirds.
export function triadByDegree(scalePcs, degree) {
  const size = scalePcs.length
  const root = scalePcs[(degree - 1) % size]
  const third = scalePcs[(degree + 1) % size]
  const fifth = scalePcs[(degree + 3) % size]
  const thirdGap = (third - root + 12) % 12
  const fifthGap = (fifth - root + 12) % 12
  const quality = thirdGap === 3 && fifthGap === 6 ? 'dim' : thirdGap === 3 ? 'min' : 'maj'
  return {
    pcs: [root, third, fifth],
    notes: [root, third, fifth].map(noteName),
    label: `${noteName(root)}${TRIAD_SUFFIX[quality]}`,
  }
}
