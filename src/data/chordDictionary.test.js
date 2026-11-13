import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeNotes } from './chordDictionary.js'

test('a complete chord is untouched by the partial-voicing fallback', () => {
  assert.equal(analyzeNotes([60, 64, 67, 69]).name, 'C6') // C E G A
  assert.equal(analyzeNotes([60, 64, 67]).name, 'C') // plain triad
  assert.equal(analyzeNotes([60, 64, 67, 70]).name, 'C7') // exact match stays exact
})

test('an inversion keeps its slash name when no partial reading fits', () => {
  assert.equal(analyzeNotes([64, 67, 72]).name, 'C/E') // E G C
})

test('a one-note-short voicing is named by the absent degree', () => {
  assert.equal(analyzeNotes([60, 64, 69]).name, 'C6 (NO 5TH)') // C E A
  assert.equal(analyzeNotes([60, 62, 64, 69]).name, 'C6/9 (NO 5TH)') // C D E A
})

test('two root-position readings stay unknown rather than guessing', () => {
  // C E Bb: could be C7 or C7#5, both missing one note.
  assert.equal(analyzeNotes([60, 64, 70]).kind, 'unknown')
})

test('single notes and intervals are unaffected', () => {
  assert.deepEqual(analyzeNotes([60]), { kind: 'note', name: 'C', pcs: [0] })
  assert.equal(analyzeNotes([60, 65]).kind, 'interval')
})
