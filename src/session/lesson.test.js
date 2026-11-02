import test from 'node:test'
import assert from 'node:assert/strict'
import { LESSONS, TIER_FILTERS, TIER_NAMES } from '../data/lessons.js'
import { MODULE_SPECS } from '../../lib/modules.js'
import { composeLesson } from './compose.js'
import { makeLessonSession, toPayload } from './useSession.js'
import { lastSevenRuns } from './tonight.js'
import { deriveXp, xpBreakdown } from '../../lib/xp.js'

test('lessons library is the catalog, ordered tier 1 to 3', () => {
  assert.equal(LESSONS.length, 10)
  assert.equal(new Set(LESSONS.map((lesson) => lesson.type)).size, 10)
  for (let i = 1; i < LESSONS.length; i++) {
    assert.ok(LESSONS[i].tier >= LESSONS[i - 1].tier)
  }
  for (const lesson of LESSONS) {
    assert.equal(lesson.title, MODULE_SPECS[lesson.type].title)
    assert.equal(lesson.lesson, MODULE_SPECS[lesson.type].teach)
    assert.equal(lesson.tier, MODULE_SPECS[lesson.type].tier)
    assert.match(lesson.meta, /^(SET|ORDERED) · \d+ NOTES$/)
  }
  assert.deepEqual(
    TIER_FILTERS.map((filter) => filter.label),
    ['ALL', 'TIER 1 · SHAPE', 'TIER 2 · FUNCTION', 'TIER 3 · VOICE LEADING'],
  )
  assert.deepEqual(TIER_NAMES, { 1: 'SHAPE', 2: 'FUNCTION', 3: 'VOICE LEADING' })
})

test('a lesson composes exactly one catalog module in the given key', () => {
  const composition = composeLesson({ date: '2026-11-02', keyId: 'D', seed: 7, type: 'GUIDE_TONES' })
  assert.equal(composition.version, 3)
  assert.equal(composition.variant, 'lesson')
  assert.equal(composition.modules.length, 1)
  assert.equal(composition.modules[0].type, 'GUIDE_TONES')
  assert.equal(composition.modules[0].tier, 3)
  assert.ok(composition.modules[0].steps.length > 0)
})

test('an unknown lesson type composes nothing', () => {
  assert.equal(composeLesson({ date: '2026-11-02', keyId: 'C', seed: 1, type: 'NOPE' }), null)
})

test('lesson scope pays module XP and first-try, never a completion bonus', () => {
  const stages = [{ id: 'scale', tier: 1, attempts: 1, passed: true }]
  const lesson = xpBreakdown(stages, 'done', 'lesson')
  assert.equal(lesson.complete, 0)
  assert.equal(lesson.total, 15)
  const session = xpBreakdown(stages, 'done', 'session')
  assert.equal(session.total, 30)
})

test('a lesson run posts one lesson-scoped stage', () => {
  const session = makeLessonSession(Date.now(), 'GUIDE_TONES', 'C')
  const payload = toPayload(session)
  assert.equal(payload.scope, 'lesson')
  assert.equal(payload.payload.scope, 'lesson')
  assert.equal(payload.moduleCount, 1)
  assert.equal(payload.stages.length, 1)
  assert.equal(payload.stages[0].tier, 3)
  const xp = deriveXp(
    [{ ...payload.stages[0], attempts: 1, passed: true }],
    'done',
    'graded',
    'lesson',
  )
  assert.equal(xp, 25)
})

test('last seven nights ignores older runs and bad dates', () => {
  const runs = [
    { date: '2026-11-02' },
    { date: '2026-10-27' },
    { date: '2026-10-26' },
    { date: 'not-a-date' },
  ]
  assert.deepEqual(
    lastSevenRuns(runs, '2026-11-02').map((run) => run.date),
    ['2026-11-02', '2026-10-27'],
  )
})
