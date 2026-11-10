import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RUN_CUES,
  buildRun,
  gradeTiming,
  holdFor,
  intervalFor,
  multiplierFor,
  windowFor,
} from './arcade.js'
import { keyById } from '../data/scales.js'

const keyPcs = (keyId) => {
  const key = keyById(keyId)
  return [0, 2, 4, 5, 7, 9, 11].map((step) => (key.tonic + step) % 12)
}

const SEEDS = [1, 7, 99, 12345]
const KEYS = ['C', 'Gb', 'A', 'Eb']

test('same seed builds the same run, a new seed does not', () => {
  assert.deepEqual(buildRun({ keyId: 'C', seed: 42 }), buildRun({ keyId: 'C', seed: 42 }))
  assert.notDeepEqual(buildRun({ keyId: 'C', seed: 42 }), buildRun({ keyId: 'C', seed: 43 }))
})

test('a run is a fixed number of cues', () => {
  for (const seed of SEEDS) assert.equal(buildRun({ keyId: 'C', seed }).length, RUN_CUES)
})

test('bombs are always off-key, notes and chords are always in-key', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const pcs = keyPcs(keyId)
      for (const cue of buildRun({ keyId, seed })) {
        if (cue.kind === 'bomb') {
          assert.equal(cue.pcs.length, 1, 'a bomb lights one key')
          assert.ok(!pcs.includes(cue.pcs[0]), 'bomb must be off-scale')
        } else {
          for (const pc of cue.pcs) assert.ok(pcs.includes(pc), 'cue must be in-scale')
        }
        if (cue.kind === 'chord') {
          assert.ok(cue.pcs.length >= 2 && cue.pcs.length <= 4, 'chord lights 2 to 4 keys')
          assert.equal(new Set(cue.pcs).size, cue.pcs.length, 'chord keys are distinct')
        }
      }
    }
  }
})

test('no bomb before the fourth cue, and bombs stay around one in five', () => {
  for (const seed of SEEDS) {
    const cues = buildRun({ keyId: 'C', seed })
    cues.slice(0, 3).forEach((cue) => assert.equal(cue.kind, 'note'))
    const bombs = cues.filter((cue) => cue.kind === 'bomb').length
    assert.ok(bombs >= 8 && bombs <= 22, `${bombs} bombs in ${cues.length} cues`)
  }
})

test('no key three cues running', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const first = buildRun({ keyId, seed }).map((cue) => cue.pcs[0])
      for (let i = 2; i < first.length; i++) {
        assert.ok(
          !(first[i] === first[i - 1] && first[i] === first[i - 2]),
          `key ${first[i]} lit three cues running`,
        )
      }
    }
  }
})

test('a lit window never runs into the next cue', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const cues = buildRun({ keyId, seed })
      for (let i = 1; i < cues.length; i++) {
        const before = windowFor(cues[i - 1])
        const after = windowFor(cues[i])
        assert.ok(before[1] < after[0], `window ${i - 1} runs into cue ${i}`)
        assert.ok(before[1] > before[0], 'a window has length')
      }
    }
  }
})

test('the cue interval ramps 900 to 500 over 30s and the hold floors at 420', () => {
  assert.equal(intervalFor(0), 900)
  assert.equal(intervalFor(15000), 700)
  assert.equal(intervalFor(30000), 500)
  assert.equal(intervalFor(60000), 500)
  assert.equal(holdFor(900), 765)
  assert.equal(holdFor(500), 425)
  assert.equal(holdFor(400), 420)
  assert.equal(multiplierFor(0), 1)
  assert.equal(multiplierFor(12), 4)
})

test('the first 200ms is PERFECT, anything later in the window is GOOD', () => {
  assert.equal(gradeTiming(0), 'perfect')
  assert.equal(gradeTiming(200), 'perfect')
  assert.equal(gradeTiming(201), 'good')
  assert.equal(gradeTiming(500), 'good')
})
