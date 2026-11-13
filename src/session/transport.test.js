import test from 'node:test'
import assert from 'node:assert/strict'
import { createTransport } from './transport.js'
import { seventhByDegree } from './set.js'

const pcsOf = (root, intervals) =>
  [...new Set(intervals.map((step) => (root + step) % 12))].sort((a, b) => a - b)
const dom7 = (root) => pcsOf(root, [0, 4, 7, 10])
const min7 = (root) => pcsOf(root, [0, 3, 7, 10])

const spec = (root, quality, pcs, label) => ({ root, quality, pcs, label })

test('a 12-bar blues plays the dominant sevenths the chart names', () => {
  // I7 / IV7 are dominant sevenths, which no major key's diatonic seventh is.
  const bar = (root, label) => spec(root, 'dom7', dom7(root), label)
  const chords = [
    bar(10, 'Bb7'),
    bar(10, 'Bb7'),
    bar(10, 'Bb7'),
    bar(10, 'Bb7'),
    bar(3, 'Eb7'),
    bar(3, 'Eb7'),
    bar(10, 'Bb7'),
    bar(10, 'Bb7'),
    bar(5, 'F7'),
    bar(3, 'Eb7'),
    bar(10, 'Bb7'),
    bar(5, 'F7'),
  ]
  const transport = createTransport({ keyId: 'Bb', chords })
  const first = transport.current()
  assert.deepEqual(first.pcs, [2, 5, 8, 10])
  assert.deepEqual(first.pcs, dom7(10))
  // Not the diatonic maj7 the degree path would have played.
  assert.notDeepEqual(first.pcs, seventhByDegree('Bb', 1))
  assert.equal(first.label, 'Bb7')
  assert.equal(first.degree, null)
  assert.equal(first.chordIndex, 0)
  // Twelve bars, not the four-bar turnaround.
  assert.equal(transport.totalMs(), transport.barMs() * 12)
})

test('a minor tune with a V7 plays the V7 pitch set', () => {
  const chords = [
    spec(4, 'dom7', dom7(4), 'E7'), // the harmonic-minor V of A minor
    spec(9, 'min7', min7(9), 'Am7'),
    spec(2, 'min7', min7(2), 'Dm7'),
    spec(9, 'min7', min7(9), 'Am7'),
  ]
  const transport = createTransport({ keyId: 'C', chords })
  assert.deepEqual(transport.current().pcs, [2, 4, 8, 11])
  assert.equal(transport.current().label, 'E7')
})

test('the degree path is unchanged when no chord spec is supplied', () => {
  const transport = createTransport({ keyId: 'C' })
  const first = transport.current()
  assert.equal(first.degree, 1)
  assert.deepEqual(first.pcs, seventhByDegree('C', 1))
  assert.deepEqual(first.pcs, [0, 4, 7, 11])
  assert.equal(first.label, null)
  assert.equal(transport.totalMs(), transport.barMs() * 4)

  const named = createTransport({ keyId: 'C', degrees: [2, 5, 1] })
  assert.deepEqual(named.current().pcs, seventhByDegree('C', 2))
  assert.equal(named.current().degree, 2)
  assert.equal(named.totalMs(), named.barMs() * 3)
})
