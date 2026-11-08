import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeNotes } from './chordDictionary.js'
import { analyzeFunction } from './chordFunction.js'
import { MAJOR_KEYS } from './scales.js'
import { diatonicMarks, sliceAngle, sliceForRoot, targetSlice } from './circle.js'

test('a played E7 in C is V7/vi and targets Am on the inner ring', () => {
  const analysis = analyzeNotes([64, 68, 71, 74]) // E G# B D
  assert.equal(analysis.kind, 'chord')
  assert.equal(analysis.name, 'E7')
  assert.equal(analysis.root, 4)

  const fn = analyzeFunction(analysis, 'C')
  assert.equal(fn.label, 'V7/vi')
  assert.equal(fn.target, 'Am')
  assert.deepEqual(targetSlice(fn, 'C'), { index: 0, ring: 'inner' })
})

test('diatonic numerals land on the right slices of C', () => {
  const marks = diatonicMarks('C')
  assert.equal(marks.get(0).outer, 'I') // C
  assert.equal(marks.get(0).inner, 'vi') // Am under C
  assert.equal(marks.get(11).outer, 'IV') // F
  assert.equal(marks.get(11).inner, 'ii') // Dm under F
  assert.equal(marks.get(1).outer, 'V') // G
  assert.equal(marks.get(1).inner, 'iii') // Em under G
  assert.equal(marks.get(5).outer, 'vii°') // B
})

test('minor chords use the relative-minor ring, dominants stay major', () => {
  assert.deepEqual(sliceForRoot(9, 'm'), { index: 0, ring: 'inner' }) // Am under C
  assert.deepEqual(sliceForRoot(4, 'm'), { index: 1, ring: 'inner' }) // Em under G
  assert.deepEqual(sliceForRoot(2, ''), { index: 2, ring: 'outer' }) // D
  assert.deepEqual(sliceForRoot(2, '7'), { index: 2, ring: 'outer' }) // D7
  assert.deepEqual(sliceForRoot(11, '°'), { index: 5, ring: 'outer' }) // B°
})

test('the selected key sits at 12 o’clock', () => {
  const c = MAJOR_KEYS.findIndex((key) => key.id === 'C')
  assert.equal(sliceAngle(c, c), 0)
  assert.equal(sliceAngle((c + 1) % 12, c), 30)
  assert.equal(sliceAngle((c + 11) % 12, c), 330)
})
