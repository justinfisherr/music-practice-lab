import test from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../../api/sessions.js'

const TODAY = new Date()

function arcadeBody(overrides = {}) {
  const payload = {
    version: 5,
    scope: 'session',
    source: 'arcade',
    mode: 'seventh-house',
    generator: 'house-1',
    keyId: 'C',
    seed: 42,
    goal: 14,
    cleared: 14,
    complete: true,
    accuracy: 91,
    cues: { notes: 52, hits: 47, misses: 3, late: 2, bombs: 8, bombsHit: 1, total: 66 },
    chords: {
      1: { correct: 2, missed: 0 },
      2: { correct: 2, missed: 0 },
      3: { correct: 2, missed: 0 },
      4: { correct: 2, missed: 0 },
      5: { correct: 2, missed: 0 },
      6: { correct: 2, missed: 0 },
      7: { correct: 2, missed: 0 },
    },
    ...overrides.payload,
  }
  return {
    id: 'house-validate-01',
    date: TODAY.toISOString().slice(0, 10),
    kind: 'arcade',
    keyId: 'C',
    seed: 42,
    status: 'done',
    startedAt: new Date(TODAY.getTime() - 120_000).toISOString(),
    endedAt: TODAY.toISOString(),
    durationMs: 120_000,
    attempts: 14,
    misses: 0,
    passedStages: 0,
    moduleCount: 0,
    stages: [],
    payload,
    ...overrides.body,
  }
}

test('a valid arcade body passes with no modules and session scope', () => {
  const row = validate(arcadeBody())
  assert.equal(row.kind, 'arcade')
  assert.equal(row.moduleCount, 0)
  assert.equal(row.passedStages, 0)
  assert.equal(row.scope, 'session')
  assert.equal(row.attempts, 14)
  assert.equal(row.durationMs, 120_000)
})

test('a graded body with a bad stage id still fails', () => {
  const graded = {
    id: 'graded-validate-01',
    date: TODAY.toISOString().slice(0, 10),
    kind: 'graded',
    keyId: 'C',
    seed: 7,
    status: 'done',
    startedAt: new Date(TODAY.getTime() - 60_000).toISOString(),
    endedAt: TODAY.toISOString(),
    stages: [{ id: 'not_a_stage', position: 0, attempts: 1, misses: 0, passed: true }],
    payload: { version: 3, scope: 'session' },
  }
  assert.throws(() => validate(graded), /invalid_body/)
})

test('malformed arcade bodies fail', () => {
  const bad = [
    { payload: { version: 4 } },
    { payload: { source: 'graded' } },
    { payload: { mode: 'falling' } },
    { payload: { goal: 12 } },
    { payload: { cleared: 15, complete: false } },
    { payload: { cleared: 13, complete: true } },
    { payload: { accuracy: 101 } },
    { payload: { accuracy: 88.5 } },
    { payload: { cues: { hits: 1.5 } } },
    { payload: { cues: [] } },
    { payload: { chords: { ...arcadeBody().payload.chords, 8: { correct: 0, missed: 0 } } } },
    { body: { keyId: 'H' } },
  ]
  for (const overrides of bad) {
    assert.throws(() => validate(arcadeBody(overrides)), /invalid_body|too_large/, JSON.stringify(overrides))
  }

  const missing = arcadeBody()
  delete missing.payload.chords[7]
  assert.throws(() => validate(missing), /invalid_body/)

  const tooMany = arcadeBody()
  tooMany.payload.chords[1].correct = 3
  assert.throws(() => validate(tooMany), /invalid_body/)

  const mismatch = arcadeBody({ body: { seed: 43 } })
  assert.throws(() => validate(mismatch), /invalid_body/)
})
