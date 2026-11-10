import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveXp, xpBreakdown, ARCADE_XP, arcadeXp } from '../../lib/xp.js'

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

// ---- v3 module vectors ------------------------------------------------------
const mod = (id, tier, attempts, passed) => ({
  id,
  tier,
  title: id.toUpperCase(),
  attempts,
  misses: attempts - (passed ? 1 : 0),
  passed,
})

test('v3 three tier-1 modules first try scores 60', () => {
  const stages = [mod('scale', 1, 1, true), mod('triads', 1, 1, true), mod('ear', 1, 1, true)]
  assert.equal(deriveXp(stages, 'done'), 60)
})

test('v3 mixed tiers first try scores 75', () => {
  const stages = [mod('scale', 1, 1, true), mod('maj7', 2, 1, true), mod('ii_v_i', 3, 1, true)]
  assert.equal(deriveXp(stages, 'done'), 75)
})

test('v3 retries lose the first-try bonus but keep the base', () => {
  const stages = [mod('scale', 1, 2, true), mod('maj7', 2, 3, true), mod('ii_v_i', 3, 2, true)]
  assert.equal(deriveXp(stages, 'done'), 60)
})

test('v3 abandoned still pays passed modules, no completion bonus', () => {
  const stages = [mod('scale', 1, 1, true), mod('maj7', 2, 1, true), mod('ii_v_i', 3, 2, false)]
  assert.equal(deriveXp(stages, 'abandoned'), 35)
})

test('v3 breakdown names each module', () => {
  const stages = [mod('scale', 1, 1, true), mod('ear', 1, 2, false)]
  const xp = xpBreakdown(stages, 'abandoned')
  assert.deepEqual(xp.modules.map((row) => row.xp), [15, 0])
  assert.equal(xp.complete, 0)
})

test('v3 completion bonus is session scope only', () => {
  const stages = [mod('scale', 1, 1, true), mod('maj7', 2, 1, true), mod('ii_v_i', 3, 1, true)]
  assert.equal(deriveXp(stages, 'done', 'graded', 'session'), 75)
  assert.equal(deriveXp(stages, 'done', 'graded', 'lesson'), 60)
  assert.equal(deriveXp(stages, 'done', 'graded', 'open'), 60)
  assert.equal(deriveXp(stages, 'abandoned', 'graded', 'session'), 60)
})

// ---- SEVENTH HOUSE ---------------------------------------------------------
test('a completed house pays 35, an abandoned one pays nothing', () => {
  assert.equal(deriveXp([], 'done', 'arcade', 'session'), 35)
  assert.equal(deriveXp([], 'abandoned', 'arcade', 'session'), 0)
  assert.equal(arcadeXp('done'), ARCADE_XP)
  assert.equal(arcadeXp('abandoned'), 0)
})

test('empty-stages graded done still pays the 15 completion bonus', () => {
  assert.equal(deriveXp([], 'done', 'graded', 'session'), 15)
  assert.equal(deriveXp([], 'abandoned', 'graded', 'session'), 0)
})
