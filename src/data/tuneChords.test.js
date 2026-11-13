import test from 'node:test'
import assert from 'node:assert/strict'
import { MAJOR_KEYS, diatonicSevenths, keyDisplay } from './scales.js'
import { seventhByDegree } from '../session/set.js'
import { buildTuneView, keyLabel, pickTuneKey } from './tuneChords.js'

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

test('a diatonic chart is scored lower outside-count under its own key', () => {
  const chords = seventhChart('C')
  const inC = buildTuneView({ keyPc: 0, mode: 'major', chords })
  const inA = buildTuneView({ keyPc: 9, mode: 'major', chords })
  assert.equal(inC.outsideCount, 0)
  assert.equal(inA.outsideCount, chords.length)
  assert.ok(inA.outsideCount > inC.outsideCount)
})

test('a measured key that leaves most of the chart outside loses to the model key', () => {
  const chords = seventhChart('C')
  const audioKey = { pc: 9, mode: 'major' } // A major: every C-major chord is out
  const modelKey = { pc: 0, mode: 'major' } // C major: none are
  assert.equal(pickTuneKey({ audioKey, modelKey, chords }), modelKey)
})

test('the audio key stays when the model key is no better', () => {
  const chords = seventhChart('C')
  const audioKey = { pc: 7, mode: 'major' } // G major: half the chart is out
  const modelKey = { pc: 2, mode: 'major' } // D major: more of it is out
  assert.equal(pickTuneKey({ audioKey, modelKey, chords }), audioKey)
})

test('the audio key stays on a tie', () => {
  // A diminished seventh is outside every major key, so both keys are as bad.
  const chords = [11, 2, 5, 8].map((pc) => ({ pc, quality: 'dim7' }))
  const audioKey = { pc: 9, mode: 'major' }
  const modelKey = { pc: 10, mode: 'major' }
  const audioView = buildTuneView({ keyPc: 9, mode: 'major', chords })
  const modelView = buildTuneView({ keyPc: 10, mode: 'major', chords })
  assert.equal(audioView.outsideCount, modelView.outsideCount)
  assert.ok(audioView.outsideCount * 2 > chords.length)
  assert.equal(pickTuneKey({ audioKey, modelKey, chords }), audioKey)
})

test('with no audio key the model key is used, and with neither there is none', () => {
  const chords = seventhChart('C')
  const modelKey = { pc: 0, mode: 'major' }
  assert.equal(pickTuneKey({ audioKey: null, modelKey, chords }), modelKey)
  assert.equal(pickTuneKey({ audioKey: null, modelKey: null, chords }), null)
})

// The panel labels a key with no chart at all, so the label is its own function.
test('keyLabel names all twelve majors with no chart', () => {
  for (const key of MAJOR_KEYS) {
    const label = keyLabel({ pc: key.tonic, mode: 'major' })
    assert.equal(label.keyId, key.id)
    assert.equal(label.label, `${keyDisplay(key.id)} MAJOR`)
    assert.equal(label.relativeOf, null)
    assert.equal(label.mode, 'major')
  }
})

test('keyLabel names a minor tune and its relative major', () => {
  const label = keyLabel({ pc: 9, mode: 'minor' })
  assert.equal(label.keyId, 'C')
  assert.equal(label.label, 'A MINOR')
  assert.equal(label.relativeOf, 'RELATIVE OF C')
})

test('keyLabel accepts the tune shape it is handed', () => {
  // A tune's key arrives as {pc, mode, source}; the extras are ignored.
  assert.deepEqual(keyLabel({ pc: 3, mode: 'major', source: 'audio' }), keyLabel({ pc: 3 }))
  assert.equal(keyLabel({ pc: 3, source: 'audio' }).label, 'Eb MAJOR')
})

test('buildTuneView labels through keyLabel', () => {
  for (const mode of ['major', 'minor']) {
    for (const key of MAJOR_KEYS) {
      const view = buildTuneView({ keyPc: key.tonic, mode, chords: seventhChart(key.id) })
      const label = keyLabel({ pc: key.tonic, mode })
      assert.equal(view.label, label.label)
      assert.equal(view.keyId, label.keyId)
      assert.equal(view.relativeOf, label.relativeOf)
    }
  }
})
