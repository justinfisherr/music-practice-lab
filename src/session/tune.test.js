import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTuneMessages, parseTune, QUALITY_INTERVALS } from '../../lib/tune.js'

const chart = (overrides = {}) =>
  JSON.stringify({
    known: true,
    key: 'Bb',
    mode: 'major',
    tempo: 132,
    chords: [
      { root: 'Bb', quality: 'maj7' },
      { root: 'G', quality: 'min7' },
      { root: 'C', quality: 'min7' },
      { root: 'F', quality: 'dom7' },
    ],
    ...overrides,
  })

test('parses a clean chart', () => {
  const tune = parseTune(chart())
  assert.equal(tune.known, true)
  assert.deepEqual(tune.key, { pc: 10, mode: 'major' })
  assert.equal(tune.tempo, 132)
  assert.equal(tune.chords.length, 4)
  assert.deepEqual(tune.chords[0], { pc: 10, quality: 'maj7', pcs: [2, 5, 9, 10] })
})

test('strips fences and surrounding prose', () => {
  const tune = parseTune(`Sure:\n\`\`\`json\n${chart()}\n\`\`\``)
  assert.equal(tune.chords.length, 4)
})

test('rejects a chord with no quality', () => {
  const text = chart({
    chords: [
      { root: 'Bb', quality: 'maj7' },
      { root: 'G' },
      { root: 'C', quality: 'min7' },
      { root: 'F', quality: 'dom7' },
    ],
  })
  assert.equal(parseTune(text), null)
})

test('rejects an unknown quality', () => {
  const text = chart({
    chords: [
      { root: 'Bb', quality: 'maj7' },
      { root: 'G', quality: '7alt' },
      { root: 'C', quality: 'min7' },
      { root: 'F', quality: 'dom7' },
    ],
  })
  assert.equal(parseTune(text), null)
})

test('rejects too few chords', () => {
  const text = chart({
    chords: [
      { root: 'Bb', quality: 'maj7' },
      { root: 'G', quality: 'min7' },
      { root: 'F', quality: 'dom7' },
    ],
  })
  assert.equal(parseTune(text), null)
})

test('rejects too many chords', () => {
  const text = chart({
    chords: Array.from({ length: 17 }, () => ({ root: 'Bb', quality: 'maj7' })),
  })
  assert.equal(parseTune(text), null)
})

test('rejects a root outside the note names', () => {
  const text = chart({
    chords: [
      { root: 'H', quality: 'maj7' },
      { root: 'G', quality: 'min7' },
      { root: 'C', quality: 'min7' },
      { root: 'F', quality: 'dom7' },
    ],
  })
  assert.equal(parseTune(text), null)
})

test('a non-numeric tempo costs the tempo, not the chart', () => {
  const tune = parseTune(chart({ tempo: 'fast' }))
  assert.equal(tune.tempo, null)
  assert.equal(tune.chords.length, 4)
})

test('an out-of-range tempo is dropped', () => {
  assert.equal(parseTune(chart({ tempo: 9999 })).tempo, null)
  assert.equal(parseTune(chart({ tempo: 12 })).tempo, null)
  assert.equal(parseTune(chart({ tempo: 132.6 })).tempo, 133)
})

test('known is required', () => {
  const text = chart()
  const parsed = JSON.parse(text)
  delete parsed.known
  assert.equal(parseTune(JSON.stringify(parsed)), null)
})

test('rejects truncated JSON', () => {
  assert.equal(parseTune(chart().slice(0, -18)), null)
})

test('accepts a minor key and a flat spelling with a unicode sign', () => {
  const tune = parseTune(chart({ key: 'B♭', mode: 'minor' }))
  assert.deepEqual(tune.key, { pc: 10, mode: 'minor' })
  assert.equal(parseTune(chart({ key: 'nope' })).key, null)
})

test('computes the pitch classes of all eight qualities', () => {
  const qualities = Object.keys(QUALITY_INTERVALS)
  assert.equal(qualities.length, 8)
  const text = JSON.stringify({
    known: true,
    chords: qualities.map((quality) => ({ root: 'C', quality })),
  })
  const tune = parseTune(chart({ chords: JSON.parse(text).chords }))
  assert.equal(tune.chords.length, 8)
  assert.deepEqual(
    tune.chords.map((chord) => chord.pcs),
    [
      [0, 4, 7, 11],
      [0, 3, 7, 10],
      [0, 4, 7, 10],
      [0, 3, 6, 10],
      [0, 3, 6, 9],
      [0, 4, 7],
      [0, 3, 7],
      [0, 3, 6],
    ],
  )
})

test('sanitises the strings it sends to the model', () => {
  const [, user] = buildTuneMessages({
    title: `Song\u0007\n${'x'.repeat(300)}`,
    artist: 'Artist',
    album: 'Album',
    keyHint: 'Bb',
    tempoHint: 132,
  })
  const payload = JSON.parse(user.content)
  assert.ok(payload.title.length <= 120)
  assert.ok(!payload.title.includes('\u0007'))
  assert.equal(payload.key, 'Bb')
  assert.equal(payload.tempo, 132)
})
