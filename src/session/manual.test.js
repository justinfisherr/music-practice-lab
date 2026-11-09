import test from 'node:test'
import assert from 'node:assert/strict'
import { makeManualSession, makeSession, reduce, toPayload } from './useSession.js'

const START = Date.UTC(2026, 10, 2, 20, 0, 0)

test('manual session carries kind, focus, and no stages', () => {
  const session = makeManualSession(START, 'LISTENING')
  assert.equal(session.kind, 'manual')
  assert.equal(session.status, 'active')
  assert.equal(session.stages.length, 0)
  const payload = toPayload(session)
  assert.equal(payload.kind, 'manual')
  assert.equal(payload.focus, 'LISTENING')
})

test('manual duration falls back to wall clock time', () => {
  const session = makeManualSession(START, 'FREE PLAY')
  const final = reduce(session, { type: 'finish', now: START + 5 * 60 * 1000, status: 'done' })
  assert.equal(final.durationMs, 5 * 60 * 1000)
  assert.equal(final.status, 'done')
})

test('manual duration excludes paused time', () => {
  const paused = reduce(makeManualSession(START, 'LESSONS'), { type: 'pause', now: START + 60_000 })
  const resumed = reduce(paused, { type: 'resume', now: START + 120_000 })
  const final = reduce(resumed, { type: 'finish', now: START + 300_000, status: 'done' })
  assert.equal(final.durationMs, 240_000)
})

test('manual pause survives an automatic resume', () => {
  const paused = reduce(makeManualSession(START, 'FREE PLAY'), {
    type: 'pause',
    now: START + 60_000,
    reason: 'manual',
  })
  const afterAuto = reduce(paused, { type: 'resume', now: START + 120_000, reason: 'auto' })
  assert.equal(afterAuto.pausedAt, paused.pausedAt)
  const resumed = reduce(afterAuto, { type: 'resume', now: START + 180_000 })
  assert.equal(resumed.pausedAt, null)
})

test('an automatic pause is lifted by an automatic resume', () => {
  const paused = reduce(makeManualSession(START, 'FREE PLAY'), {
    type: 'pause',
    now: START + 60_000,
    reason: 'auto',
  })
  const resumed = reduce(paused, { type: 'resume', now: START + 120_000, reason: 'auto' })
  assert.equal(resumed.pausedAt, null)
  assert.equal(resumed.pausedMs, 60_000)
})

test('graded sessions still report kind graded', () => {
  assert.equal(toPayload(makeSession(START)).kind, 'graded')
})
