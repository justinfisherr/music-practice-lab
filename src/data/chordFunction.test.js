import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeFunction } from './chordFunction.js'

const chord = (root, suffix) => ({ kind: 'chord', root, suffix })

test('diatonic chords get their numeral', () => {
  assert.equal(analyzeFunction(chord(0, 'maj7'), 'C').label, 'I')
  assert.equal(analyzeFunction(chord(2, 'm7'), 'C').label, 'ii')
  assert.equal(analyzeFunction(chord(7, '7'), 'C').label, 'V')
  assert.equal(analyzeFunction(chord(9, 'm'), 'C').label, 'vi')
  assert.equal(analyzeFunction(chord(11, '°'), 'C').label, 'vii°')
})

test('secondary dominants resolve to their target', () => {
  const e7 = analyzeFunction(chord(4, '7'), 'C')
  assert.equal(e7.label, 'V7/vi')
  assert.equal(e7.target, 'Am')
  assert.equal(e7.inKey, false)

  const a7 = analyzeFunction(chord(9, '7'), 'C')
  assert.equal(a7.label, 'V7/ii')
  assert.equal(a7.target, 'Dm')

  const d7 = analyzeFunction(chord(2, '7'), 'C')
  assert.equal(d7.label, 'V7/V')
  assert.equal(d7.target, 'G')

  const c7 = analyzeFunction(chord(0, '7'), 'C')
  assert.equal(c7.label, 'V7/IV')
  assert.equal(c7.target, 'F')

  const e = analyzeFunction(chord(4, ''), 'C')
  assert.equal(e.label, 'V/vi')
})

test('the #9 dominant still counts as a secondary dominant', () => {
  const e = analyzeFunction(chord(4, '7#9'), 'C')
  assert.equal(e.label, 'V7/vi')
  assert.equal(e.target, 'Am')
})

test('leading-tone and borrowed chords', () => {
  const fsharp = analyzeFunction(chord(6, '°'), 'C')
  assert.equal(fsharp.label, 'vii°/V')
  assert.equal(fsharp.target, 'G')

  const fm = analyzeFunction(chord(5, 'm'), 'C')
  assert.equal(fm.label, 'iv')
  assert.equal(fm.inKey, false)

  const ddim = analyzeFunction(chord(2, '°'), 'C')
  assert.equal(ddim.label, 'ii°')
})

test('tritone sub and backdoor dominant', () => {
  const db7 = analyzeFunction(chord(1, '7'), 'C')
  assert.equal(db7.label, 'subV7/I')
  assert.equal(db7.target, 'C')

  const bb7 = analyzeFunction(chord(10, '7'), 'C')
  assert.equal(bb7.label, 'bVII7')
  assert.equal(bb7.target, 'C')
})

test('empty or non-chord input has no function', () => {
  assert.equal(analyzeFunction(null, 'C'), null)
  assert.equal(analyzeFunction({ kind: 'note' }, 'C'), null)
})

test('each function points at the foundation that teaches it', () => {
  assert.equal(analyzeFunction(chord(0, 'maj7'), 'C').foundation, 'function')
  assert.equal(analyzeFunction(chord(4, '7'), 'C').foundation, 'secondary-dominants')
  assert.equal(analyzeFunction(chord(6, '°'), 'C').foundation, 'secondary-dominants')
  assert.equal(analyzeFunction(chord(1, '7'), 'C').foundation, 'secondary-dominants')
  assert.equal(analyzeFunction(chord(10, '7'), 'C').foundation, 'borrowed-chords')
  assert.equal(analyzeFunction(chord(5, 'm'), 'C').foundation, 'borrowed-chords')
  assert.equal(analyzeFunction(chord(1, 'maj7'), 'C').foundation, null)
})
