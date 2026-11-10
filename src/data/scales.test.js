import test from 'node:test'
import assert from 'node:assert/strict'
import { MAJOR_KEYS, diatonicChords, diatonicSevenths, keyById } from './scales.js'

const NUMERALS = ['Imaj7', 'iim7', 'iiim7', 'IVmaj7', 'V7', 'vim7', 'viiø7']

// Scale pitch classes for a key, spelled by degree.
const keyPcs = (keyId) => {
  const key = keyById(keyId)
  return [0, 2, 4, 5, 7, 9, 11].map((step) => (key.tonic + step) % 12)
}

test('seven sevenths, in order, with the documented numerals', () => {
  for (const key of MAJOR_KEYS) {
    const chords = diatonicSevenths(key.id)
    assert.equal(chords.length, 7)
    assert.deepEqual(
      chords.map((chord) => chord.numeral),
      NUMERALS,
    )
    assert.deepEqual(
      chords.map((chord) => chord.degree),
      [1, 2, 3, 4, 5, 6, 7],
    )
  }
})

test('every seventh is four distinct pitch classes, all in the key', () => {
  for (const key of MAJOR_KEYS) {
    const pcs = keyPcs(key.id)
    for (const chord of diatonicSevenths(key.id)) {
      assert.equal(chord.pitchClasses.length, 4)
      assert.equal(new Set(chord.pitchClasses).size, 4, `${chord.name} repeats a pitch class`)
      for (const pc of chord.pitchClasses) {
        assert.ok(pcs.includes(pc), `${chord.name} has an outside note`)
      }
      assert.equal(chord.pitchClasses[0], chord.rootPc)
      assert.equal(chord.notes.length, 4)
    }
  }
})

test('names follow the key spelling: Cmaj7, Dm7, Bm7b5, F#m7b5', () => {
  const c = diatonicSevenths('C')
  assert.deepEqual(
    c.map((chord) => chord.name),
    ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'],
  )
  assert.deepEqual(c[1].notes, ['D', 'F', 'A', 'C'])
  assert.deepEqual(c[6].notes, ['B', 'D', 'F', 'A'])

  const g = diatonicSevenths('G')
  assert.deepEqual(g[6].notes, ['F#', 'A', 'C', 'E'])
  assert.equal(g[6].name, 'F#m7b5')

  // The app stores Gb but renders F#, so the seventh chord of it is F7.
  const gb = diatonicSevenths('Gb')
  assert.equal(gb[4].name, 'Db7')
  assert.deepEqual(gb[6].notes, ['F', 'Ab', 'Cb', 'Eb'])
})

test('the triads are untouched by the sevenths', () => {
  for (const key of MAJOR_KEYS) {
    const triads = diatonicChords(key.id)
    assert.equal(triads.length, 7)
    for (const chord of triads) assert.equal(chord.pitchClasses.length, 3)
  }
})
