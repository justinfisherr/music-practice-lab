import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveXp, xpBreakdown } from '../../lib/xp.js'

const stage = (id, attempts, passed) => ({ id, attempts, misses: attempts - (passed ? 1 : 0), passed })

test('all stages first-try and done scores 110', () => {
  const stages = [stage('warmup', 1, true), stage('ear', 1, true), stage('hook', 1, true)]
  assert.equal(deriveXp(stages, 'done'), 110)
})

test('all stages passed over multiple attempts scores 80', () => {
  const stages = [stage('warmup', 3, true), stage('ear', 2, true), stage('hook', 4, true)]
  assert.equal(deriveXp(stages, 'done'), 80)
})

test('done with nothing passed scores 15', () => {
  const stages = [stage('warmup', 2, false), stage('ear', 2, false), stage('hook', 2, false)]
  assert.equal(deriveXp(stages, 'done'), 15)
})

test('abandoned with nothing passed scores 0', () => {
  const stages = [stage('warmup', 2, false), stage('ear', 2, false), stage('hook', 2, false)]
  assert.equal(deriveXp(stages, 'abandoned'), 0)
})

test('manual sessions score 0 XP even when marked done', () => {
  assert.equal(deriveXp([], 'done', 'manual'), 0)
  const stages = [stage('warmup', 1, true), stage('ear', 1, true), stage('hook', 1, true)]
  assert.equal(deriveXp(stages, 'done', 'manual'), 0)
})

test('only the first occurrence of a stage id counts', () => {
  const stages = [stage('warmup', 2, true), stage('warmup', 1, true)]
  assert.equal(deriveXp(stages, 'abandoned'), 10)
})

test('xp breakdown names each award', () => {
  const stages = [stage('warmup', 1, true), stage('ear', 1, true), stage('hook', 1, true)]
  assert.deepEqual(xpBreakdown(stages, 'done'), {
    warmup: 15,
    ear: 30,
    hook: 50,
    complete: 15,
    total: 110,
  })
})
