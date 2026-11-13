import test from 'node:test'
import assert from 'node:assert/strict'
import { MAJOR_KEYS, diatonicSevenths } from './scales.js'
import { seventhByDegree } from '../session/set.js'
import { buildTuneView } from './tuneChords.js'

const CHART_QUALITY = { halfdim7: 'halfDim' }

// Every diatonic seventh of every key, as a tune's chord would arrive.
function seventhChart(keyId) {
  return diatonicSevenths(keyId).map((seventh) => ({
    pc: seventh.rootPc,
    quality: CHART_QUALITY[seventh.quality] || seventh.quality,
  }))
}

test('every diatonic seventh matches the transport pitch classes', () => {
  for (const key of MAJOR_KEYS) {
    const view = buildTuneView({ keyPc: key.tonic, mode: 'major', chords: seventhChart(key.id) })
    assert.equal(view.keyId, key.id)
    assert.equal(view.diatonic, true)
    assert.equal(view.outsideCount, 0)
    view.cells.forEach((cell, index) => {
      const degree = index + 1
      assert.deepEqual(cell.pcs, seventhByDegree(key.id, degree), `${key.id} degree ${degree}`)
      assert.equal(cell.degree, degree, `${key.id} degree ${degree}`)
      assert.equal(cell.outside, false)
    })
  }
})

test('numerals read in the major key', () => {
  const view = buildTuneView({ keyPc: 0, mode: 'major', chords: seventhChart('C') })
  assert.deepEqual(
    view.cells.map((cell) => cell.numeral),
    ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'],
  )
})

test('a minor tune reads in its relative major and its own numerals', () => {
  const view = buildTuneView({
    keyPc: 9,
    mode: 'minor',
    chords: [
      { pc: 9, quality: 'min7' }, // Am7
      { pc: 2, quality: 'min7' }, // Dm7
      { pc: 4, quality: 'min7' }, // Em7, the natural-minor v
      { pc: 5, quality: 'maj7' }, // Fmaj7
    ],
  })
  assert.equal(view.keyId, 'C')
  assert.equal(view.label, 'A MINOR')
  assert.equal(view.relativeOf, 'RELATIVE OF C')
  assert.deepEqual(
    view.cells.map((cell) => cell.numeral),
    ['i', 'iv', 'v', 'VI'],
  )
  // Replayable by the existing transport: the degree maps to the same chord.
  for (const cell of view.cells) {
    assert.deepEqual(cell.pcs, seventhByDegree(view.keyId, cell.degree), cell.name)
  }
})

test('a secondary dominant is outside the key', () => {
  const view = buildTuneView({
    keyPc: 0,
    mode: 'major',
    chords: [
      { pc: 0, quality: 'maj7' },
      { pc: 9, quality: 'dom7' }, // A7 -> D
      { pc: 2, quality: 'min7' },
      { pc: 7, quality: 'dom7' },
    ],
  })
  const dominant = view.cells[1]
  assert.equal(dominant.outside, true)
  assert.equal(dominant.degree, null)
  assert.equal(dominant.numeral, null)
  assert.equal(view.outsideCount, 1)
  assert.equal(view.diatonic, false)
})

// The harmonic-minor dominant is a dom7 on the relative major's iii, which no
// diatonic seventh matches. It reads as outside: the grid plays, JAM does not.
test('a harmonic-minor dominant is outside the key', () => {
  const view = buildTuneView({
    keyPc: 9,
    mode: 'minor',
    chords: [{ pc: 4, quality: 'dom7' }],
  })
  assert.equal(view.cells[0].outside, true)
  assert.equal(view.cells[0].name, 'E7')
})

test('a plain triad is accepted by the triad pass', () => {
  const view = buildTuneView({
    keyPc: 0,
    mode: 'major',
    chords: [{ pc: 5, quality: 'maj' }],
  })
  assert.equal(view.cells[0].degree, 4)
  assert.equal(view.cells[0].numeral, 'IV')
  assert.equal(view.cells[0].name, 'F')
  assert.equal(view.cells[0].outside, false)
})

test('a diminished seventh is always outside a major key', () => {
  const view = buildTuneView({
    keyPc: 0,
    mode: 'major',
    chords: [{ pc: 11, quality: 'dim7' }],
  })
  assert.equal(view.cells[0].outside, true)
  assert.equal(view.cells[0].name, 'B°7')
})

test('the flat sixth key renders as F sharp', () => {
  const view = buildTuneView({ keyPc: 6, mode: 'major', chords: [] })
  assert.equal(view.keyId, 'Gb')
  assert.equal(view.label, 'F# MAJOR')
  assert.equal(view.relativeOf, null)
})
