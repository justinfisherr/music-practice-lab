import test from 'node:test'
import assert from 'node:assert/strict'
import { labForKey, seventhByDegreeForScale, triadByDegree } from './scaleLab.js'

test('C major: the home scale runs to the octave and accents the tonic', () => {
  const lab = labForKey('C')
  assert.equal(lab.major.name, 'C MAJOR')
  assert.deepEqual(lab.major.notes, ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'])
  assert.deepEqual(lab.major.pcs, [0, 2, 4, 5, 7, 9, 11, 0])
  assert.equal(lab.major.homePc, 0)
})

test('C relative minor keeps the same seven notes and moves the home to A', () => {
  const lab = labForKey('C')
  assert.equal(lab.relative.name, 'A MINOR')
  assert.equal(lab.relative.homePc, 9)
  assert.deepEqual(
    [...new Set(lab.relative.pcs)].sort((a, b) => a - b),
    [...new Set(lab.major.pcs)].sort((a, b) => a - b),
  )
})

test('C parallel minor swaps in b3, b6, b7 and keeps C as home', () => {
  const lab = labForKey('C')
  assert.deepEqual(lab.parallel.pcs, [0, 2, 3, 5, 7, 8, 10, 0])
  assert.deepEqual(lab.parallel.notes, ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb', 'C'])
  assert.equal(lab.parallel.homePc, 0)
  assert.deepEqual(
    lab.borrowedNotes.map((note) => note.name),
    ['Eb', 'Ab', 'Bb'],
  )
})

test('borrowed chords are the parallel minor triads, including iv and bVII', () => {
  const lab = labForKey('C')
  const byNumeral = Object.fromEntries(lab.borrowedChords.map((chord) => [chord.numeral, chord]))
  assert.deepEqual(
    lab.borrowedChords.map((chord) => chord.numeral),
    ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'],
  )
  assert.deepEqual(
    lab.borrowedChords.map((chord) => chord.name),
    ['Cm', 'D°', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb'],
  )
  assert.deepEqual(byNumeral.iv.pcs, [5, 8, 0])
  assert.deepEqual(byNumeral.iv.notes, ['F', 'Ab', 'C'])
  assert.deepEqual(byNumeral.bVII.pcs, [10, 2, 5])
  assert.deepEqual(byNumeral.bVII.notes, ['Bb', 'D', 'F'])
})

test('another key derives the same relationships', () => {
  const lab = labForKey('G')
  assert.equal(lab.relative.name, 'E MINOR')
  assert.equal(lab.relative.homePc, 4)
  assert.deepEqual(
    lab.borrowedNotes.map((note) => note.name),
    ['Bb', 'Eb', 'F'],
  )
  assert.equal(lab.borrowedChords.find((chord) => chord.numeral === 'iv').name, 'Cm')
  assert.equal(lab.borrowedChords.find((chord) => chord.numeral === 'bVII').name, 'F')
})

test('the blues home is the six-note blues scale, home to octave', () => {
  const lab = labForKey('C')
  assert.equal(lab.blues.name, 'C BLUES')
  assert.deepEqual(lab.blues.notes, ['C', 'Eb', 'F', 'Gb', 'G', 'Bb', 'C'])
  assert.deepEqual(lab.blues.pcs, [0, 3, 5, 6, 7, 10, 0])
  assert.equal(lab.blues.homePc, 0)
})

test('diatonic triads stack in scale thirds', () => {
  const lab = labForKey('C')
  const pcs = lab.major.pcs.slice(0, 7)
  assert.equal(triadByDegree(pcs, 1).label, 'C')
  assert.deepEqual(triadByDegree(pcs, 1).notes, ['C', 'E', 'G'])
  assert.equal(triadByDegree(pcs, 2).label, 'Dm')
  assert.equal(triadByDegree(pcs, 7).label, 'B°')
  const minor = labForKey('C').parallel.pcs.slice(0, 7)
  assert.equal(triadByDegree(minor, 3).label, 'Eb')
})

test('sevenths stack in scale thirds and name their quality', () => {
  const pcs = labForKey('C').major.pcs.slice(0, 7)
  assert.equal(seventhByDegreeForScale(pcs, 1).label, 'Cmaj7')
  assert.equal(seventhByDegreeForScale(pcs, 2).label, 'Dm7')
  assert.equal(seventhByDegreeForScale(pcs, 5).label, 'G7')
  assert.equal(seventhByDegreeForScale(pcs, 7).label, 'Bø7')
  assert.deepEqual(seventhByDegreeForScale(pcs, 1).pcs, [0, 4, 7, 11])
  const minor = labForKey('C').parallel.pcs.slice(0, 7)
  assert.equal(seventhByDegreeForScale(minor, 3).label, 'Ebmaj7')
})
