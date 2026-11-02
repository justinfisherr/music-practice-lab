import test from 'node:test'
import assert from 'node:assert/strict'
import { daysSinceEpoch, laDate, seedFor, tonightKey } from './tonight.js'
import { diatonicPcs, earPhrase, hookPhrase, mulberry32 } from './phrases.js'
import { gradeSequence, gradeSet } from './grade.js'
import { composeSession } from './compose.js'

test('LA date rolls over at local midnight, not UTC midnight', () => {
  assert.equal(laDate(new Date('2026-11-01T06:59:00Z')), '2026-10-31')
  assert.equal(laDate(new Date('2026-11-01T07:00:00Z')), '2026-11-01')
})

test('tonight key rotates once per LA day', () => {
  assert.equal(daysSinceEpoch('2026-11-01') + 1, daysSinceEpoch('2026-11-02'))
  assert.notEqual(tonightKey('2026-11-01'), tonightKey('2026-11-02'))
  assert.equal(tonightKey('2026-11-01'), tonightKey('2026-11-01'))
})

test('seed is stable for a date and key', () => {
  assert.equal(seedFor('2026-11-01', 'C'), seedFor('2026-11-01', 'C'))
  assert.notEqual(seedFor('2026-11-01', 'C'), seedFor('2026-11-02', 'C'))
})

test('gradeSequence matches exact phrases', () => {
  const result = gradeSequence([0, 2, 4], [0, 2, 4])
  assert.equal(result.passed, true)
  assert.equal(result.extraCount, 0)
  assert.deepEqual(result.rows.map((r) => r.status), ['match', 'match', 'match'])
})

test('gradeSequence marks short phrases missing', () => {
  const result = gradeSequence([0, 2, 4], [0, 2])
  assert.equal(result.passed, false)
  assert.deepEqual(result.rows.map((r) => r.status), ['match', 'match', 'missing'])
})

test('gradeSequence counts extra notes', () => {
  const result = gradeSequence([0, 2, 4], [0, 2, 4, 7])
  assert.equal(result.passed, false)
  assert.equal(result.extraCount, 1)
})

test('gradeSequence catches wrong order', () => {
  const result = gradeSequence([0, 2, 4], [0, 4, 2])
  assert.equal(result.passed, false)
  assert.deepEqual(result.rows.map((r) => r.status), ['match', 'off', 'off'])
})

test('gradeSet is order agnostic and rejects extras', () => {
  assert.equal(gradeSet([0, 4, 7], [7, 0, 4]).passed, true)
  assert.equal(gradeSet([0, 4, 7], [0, 4]).passed, false)
  assert.equal(gradeSet([0, 4, 7], [0, 4, 7, 11]).passed, false)
})

test('mulberry32 is deterministic and in range', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  for (let i = 0; i < 20; i++) {
    const value = a()
    assert.equal(value, b())
    assert.ok(value >= 0 && value < 1)
  }
})

test('ear phrases are deterministic, four notes, and in key', () => {
  const first = earPhrase(1234, 'D')
  const second = earPhrase(1234, 'D')
  assert.deepEqual(first, second)
  assert.equal(first.length, 4)
  const key = new Set(diatonicPcs('D'))
  assert.ok(first.every((pc) => key.has(pc)))
})

test('hook phrases are deterministic, six notes, and in key', () => {
  const first = hookPhrase(9876, 'Bb')
  const second = hookPhrase(9876, 'Bb')
  assert.deepEqual(first, second)
  assert.equal(first.length, 6)
  const key = new Set(diatonicPcs('Bb'))
  assert.ok(first.every((pc) => key.has(pc)))
})

test('composeSession returns 3-5 v3 modules, easiest first, no repeats', () => {
  const composed = composeSession({ date: '2026-11-01', keyId: 'C', seed: 7 })
  assert.equal(composed.version, 3)
  assert.ok(composed.modules.length >= 3 && composed.modules.length <= 5)
  assert.equal(new Set(composed.modules.map((module) => module.type)).size, composed.modules.length)
  for (let i = 1; i < composed.modules.length; i++) {
    assert.ok(composed.modules[i].tier >= composed.modules[i - 1].tier)
  }
  assert.ok(composed.modules.every((module) => module.targets.length > 0))
})

test('composeSession is deterministic for a date, key and variant', () => {
  const first = composeSession({ date: '2026-11-01', keyId: 'C', seed: 7, variant: 'tonight' })
  const second = composeSession({ date: '2026-11-01', keyId: 'C', seed: 7, variant: 'tonight' })
  assert.deepEqual(first.modules, second.modules)
  const bonus = composeSession({ date: '2026-11-01', keyId: 'C', seed: 7, variant: 'bonus' })
  assert.equal(bonus.variant, 'bonus')
  assert.ok(bonus.modules.every((module) => module.tier > 1))
})
