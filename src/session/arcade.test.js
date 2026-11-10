import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRun, windowFor, intervalFor, multiplierFor } from './arcade.js'
import { keyById } from '../data/scales.js'

const keyPcs = (keyId) => {
  const key = keyById(keyId)
  return [0, 2, 4, 5, 7, 9, 11].map((step) => (key.tonic + step) % 12)
}

const SEEDS = [1, 7, 99, 12345]

test('same seed builds the same run, a new seed does not', () => {
  assert.deepEqual(buildRun({ keyId: 'C', seed: 42 }), buildRun({ keyId: 'C', seed: 42 }))
  assert.notDeepEqual(buildRun({ keyId: 'C', seed: 42 }), buildRun({ keyId: 'C', seed: 43 }))
})

test('bombs are always off-key, chords are always in-key', () => {
  for (const seed of SEEDS) {
    for (const keyId of ['C', 'Gb', 'A']) {
      const pcs = keyPcs(keyId)
      for (const event of buildRun({ keyId, seed })) {
        if (event.kind === 'bomb') {
          assert.ok(!pcs.includes(event.pcs[0]), 'bomb must be off-scale')
        }
        if (event.kind === 'chord') {
          for (const pc of event.pcs) assert.ok(pcs.includes(pc), 'chord must be in-scale')
        }
      }
    }
  }
})

test('no bomb or chord before the fourth note, at most three chords', () => {
  for (const seed of SEEDS) {
    const events = buildRun({ keyId: 'C', seed })
    events.forEach((event, index) => {
      if (index < 3) assert.equal(event.kind, 'note')
    })
    assert.ok(events.filter((event) => event.kind === 'chord').length <= 3)
    assert.ok(events.length > 20, 'a run is long enough to play')
  }
})

test('no column three times running', () => {
  for (const seed of SEEDS) {
    const columns = buildRun({ keyId: 'D', seed }).map((event) => event.column)
    for (let i = 2; i < columns.length; i++) {
      assert.ok(
        !(columns[i] === columns[i - 1] && columns[i] === columns[i - 2]),
        `columns ${columns[i - 2]} ${columns[i - 1]} ${columns[i]} repeat`,
      )
    }
  }
})

test('grade windows never overlap', () => {
  for (const seed of SEEDS) {
    const events = buildRun({ keyId: 'F', seed })
    for (let i = 1; i < events.length; i++) {
      const before = windowFor(events[i - 1])
      const after = windowFor(events[i])
      assert.ok(before[1] < after[0], `window ${i - 1} runs into ${i}`)
    }
  }
})

test('the ramp floors at 330ms and the multiplier climbs', () => {
  assert.equal(intervalFor(0), 600)
  assert.equal(intervalFor(20000), 330)
  assert.equal(intervalFor(60000), 330)
  assert.equal(multiplierFor(0), 1)
  assert.equal(multiplierFor(12), 4)
})
