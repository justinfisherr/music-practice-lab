import test from 'node:test'
import assert from 'node:assert/strict'
import { MAJOR_KEYS, diatonicChords, keyDisplay } from '../data/scales.js'
import { diatonicPcs } from './phrases.js'
import { composeModules, resolveModule, resolvePlan, resolveTargets } from '../data/modules.js'
import {
  MODULE_SPECS,
  MODULE_TYPES,
  validatePlan,
  validatePlanConstraints,
  validatePlanShape,
} from '../../lib/modules.js'
import { angleForKey, bonusForKey, keyAngle, nextKey, normalizeRotation, rotationTo } from './wheel.js'
import { composeSession } from './compose.js'

const keyOf = (type, keyId = 'C') => resolveModule({ type, keyId, seed: 7 })

test('every module resolves in all 12 keys with steps', () => {
  for (const key of MAJOR_KEYS) {
    for (const type of MODULE_TYPES) {
      const module = resolveModule({ type, keyId: key.id, seed: 11 })
      assert.ok(module, `${type} in ${key.id}`)
      assert.ok(module.steps.length > 0, `${type} in ${key.id} steps`)
      assert.equal(module.tier, MODULE_SPECS[type].tier)
      assert.equal(module.grading, MODULE_SPECS[type].grading)
      for (const step of module.steps) {
        assert.ok(['set', 'sequence'].includes(step.kind), `${type} step kind`)
        assert.ok(step.targetPcs.length > 0, `${type} step pcs`)
        assert.equal(step.targetPcs.length, step.targetNotes.length, `${type} notes`)
      }
    }
  }
})

test('non-passing-dim modules stay diatonic to the key', () => {
  for (const key of MAJOR_KEYS) {
    const keySet = new Set(diatonicPcs(key.id))
    for (const type of MODULE_TYPES.filter((value) => value !== 'PASSING_DIM')) {
      const module = resolveModule({ type, keyId: key.id, seed: 3 })
      for (const step of module.steps) {
        assert.ok(step.targetPcs.every((pc) => keySet.has(pc)), `${type} in ${key.id}`)
      }
    }
  }
})

test('passing dim is the one non-diatonic module', () => {
  for (const key of MAJOR_KEYS) {
    const keySet = new Set(diatonicPcs(key.id))
    const module = resolveModule({ type: 'PASSING_DIM', keyId: key.id, seed: 3 })
    assert.ok(module.steps[0].targetPcs.some((pc) => !keySet.has(pc)), key.id)
  }
})

test('diatonic seventh qualities land on the right degrees', () => {
  const setOf = (root, intervals) =>
    [...new Set(intervals.map((iv) => (root + iv) % 12))].sort((a, b) => a - b).join(',')
  const compare = (type, degrees, intervals) => {
    for (const key of MAJOR_KEYS) {
      const chords = diatonicChords(key.id)
      const expected = degrees.map((degree) => setOf(chords[degree - 1].rootPc, intervals))
      const actual = resolveModule({ type, keyId: key.id, seed: 5 }).steps.map((step) =>
        [...step.targetPcs].sort((a, b) => a - b).join(','),
      )
      assert.deepEqual(actual, expected, `${type} in ${key.id}`)
    }
  }
  compare('MAJ7', [1, 4], [0, 4, 7, 11])
  compare('MIN7', [2, 3, 6], [0, 3, 7, 10])
  compare('DOM7', [5], [0, 4, 7, 10])
  compare('HALF_DIM', [7], [0, 3, 6, 10])
  const triads = diatonicChords('C')
  assert.deepEqual(triads.map((chord) => chord.quality), ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'])
  assert.deepEqual(resolveTargets('MIN7', 'C', 0).map((chord) => chord.numeral), ['ii', 'iii', 'vi'])
  assert.deepEqual(resolveTargets('MAJ7', 'C', 0).map((chord) => chord.numeral), ['I', 'IV'])
})

test('guide tones in C walk third, seventh, third', () => {
  const target = resolveTargets('GUIDE_TONES', 'C', 0)[0]
  assert.deepEqual(target.pcs, [5, 5, 4])
  assert.equal(new Set(target.pcs).size < target.pcs.length, true)
  assert.equal(resolveModule({ type: 'GUIDE_TONES', keyId: 'C', seed: 0 }).steps[0].kind, 'sequence')
})

test('passing dim in C is #Idim7', () => {
  const target = resolveTargets('PASSING_DIM', 'C', 0)[0]
  assert.deepEqual(target.pcs, [1, 4, 7, 10])
  const steps = resolveModule({ type: 'PASSING_DIM', keyId: 'C', seed: 0 }).steps
  assert.equal(steps[0].kind, 'sequence')
  assert.equal(steps[1].kind, 'set')
  assert.deepEqual(steps[1].targetPcs, [0, 2, 5, 9])
})

test('resolver is deterministic and honors EAR params', () => {
  assert.deepEqual(keyOf('TRIADS'), keyOf('TRIADS'))
  assert.deepEqual(
    resolveModule({ type: 'EAR', keyId: 'D', seed: 123 }),
    resolveModule({ type: 'EAR', keyId: 'D', seed: 123 }),
  )
  const degrees = [1, 3, 5, 7]
  const withParams = resolveModule({ type: 'EAR', params: { degrees }, keyId: 'C', seed: 1 })
  assert.deepEqual(withParams.steps[0].targetPcs, degrees.map((degree) => [0, 2, 4, 5, 7, 9, 11][degree - 1]))
  assert.equal(
    resolveModule({ type: 'EAR', params: { degrees: [1, 3] }, keyId: 'C', seed: 1 }),
    null,
  )
  assert.equal(resolveModule({ type: 'SCALE', params: { degrees: [1] }, keyId: 'C', seed: 1 }), null)
})

test('bonus composition only draws harder modules', () => {
  const modules = composeModules({ seed: 42, keyId: 'C', variant: 'bonus' })
  assert.ok(modules.length >= 3)
  assert.ok(modules.every((module) => module.tier > 1))
})

test('plan shape accepts 3-5 unique modules and rejects junk', () => {
  assert.equal(validatePlanShape(['SCALE', 'EAR', 'II_V_I']).ok, true)
  assert.equal(validatePlanShape(['SCALE', 'SCALE', 'EAR']).ok, false)
  assert.equal(validatePlanShape(['SCALE', 'EAR']).ok, false)
  assert.equal(validatePlanShape(['SCALE', 'EAR', 'II_V_I', 'MAJ7', 'MIN7', 'DOM7']).ok, false)
  assert.equal(validatePlanShape(['SCALE', 'EAR', 'NOPE']).ok, false)
  assert.equal(
    validatePlanShape([{ type: 'SCALE' }, { type: 'EAR', params: { degrees: [1, 2, 3, 4] } }, { type: 'II_V_I' }]).ok,
    true,
  )
  assert.equal(
    validatePlanShape([{ type: 'SCALE' }, { type: 'EAR', params: { degrees: [1, 2] } }, { type: 'II_V_I' }]).ok,
    false,
  )
  assert.equal(
    validatePlanShape([{ type: 'SCALE', params: { degrees: [1] } }, 'EAR', 'II_V_I']).ok,
    false,
  )
})

test('plan validation enforces rationale and 20-180 seconds', () => {
  const base = { modules: ['SCALE', 'EAR', 'II_V_I'] }
  assert.equal(validatePlan({ ...base, rationale: 'a clean plan' }).ok, true)
  assert.equal(validatePlan({ ...base, rationale: 'x'.repeat(201) }).ok, false)
  assert.ok(validatePlan({ ...base, rationale: '' }).value.estSec >= 20)
  assert.ok(validatePlan({ ...base, rationale: '' }).value.estSec <= 180)
})

test('plan constraints match the API rules', () => {
  assert.equal(validatePlanConstraints(['II_V_I', 'GUIDE_TONES', 'PASSING_DIM']).error, 'too_many_tier3')
  assert.equal(validatePlanConstraints(['MAJ7', 'MIN7', 'DOM7']).error, 'needs_tier1')
  assert.equal(validatePlanConstraints(['SCALE', 'TRIADS', 'MAJ7']).error, 'needs_ear_or_guide_tones')
  assert.equal(
    validatePlanConstraints(['SCALE', 'EAR', 'II_V_I', 'GUIDE_TONES']).error,
    'too_many_hard_modules',
  )
  assert.equal(
    validatePlanConstraints(['SCALE', 'EAR', 'TRIADS'], [
      ['SCALE', 'TRIADS'],
      ['SCALE', 'TRIADS'],
    ]).error,
    'stale_module',
  )
})

test('every module why fits the 120 character cap', () => {
  for (const type of MODULE_TYPES) {
    assert.ok(MODULE_SPECS[type].why.length <= 120, type)
  }
})

test('resolvePlan keeps order and rewrites targets locally', () => {
  const plan = {
    rationale: 'a compact plan',
    modules: [{ type: 'SCALE' }, { type: 'EAR', params: { degrees: [1, 5, 3, 2] } }, { type: 'II_V_I' }],
  }
  const resolved = resolvePlan({ plan, keyId: 'C', seed: 9 })
  assert.deepEqual(resolved.modules.map((module) => module.type), ['SCALE', 'EAR', 'II_V_I'])
  assert.deepEqual(resolved.modules[1].steps[0].targetPcs, [0, 7, 4, 2])
})

test('wheel math lands on the circle of fifths positions', () => {
  assert.equal(keyAngle(0), 0)
  assert.equal(keyAngle(1), 330)
  assert.equal(keyAngle(2), 300)
  assert.equal(keyAngle(11), 30)
  assert.equal(keyAngle(12), 0)
  assert.equal(angleForKey('C'), 0)
  assert.equal(angleForKey('G'), 330)
  assert.equal(angleForKey('Gb'), 180)
  assert.equal(nextKey('C'), 'G')
  assert.equal(nextKey('F'), 'C')
  assert.equal(normalizeRotation(-30), 330)
  assert.equal(rotationTo(0, 'G'), 690)
  assert.equal(rotationTo(690, 'D'), 1380)
})

test('Gb displays as F# without changing the key id', () => {
  assert.equal(keyDisplay('Gb'), 'F#')
  assert.equal(keyDisplay('C'), 'C')
  assert.equal(keyOf('SCALE', 'Gb').steps[0].targetPcs.length, 8)
  assert.equal(composeSession({ date: '2026-11-02', keyId: 'Gb', seed: 1 }).keyId, 'Gb')
})

test('bonus key is never tonight', () => {
  const first = bonusForKey('2026-11-02', 'C')
  assert.notEqual(first, 'C')
  const second = bonusForKey('2026-11-02', 'C', first)
  assert.notEqual(second, 'C')
  assert.notEqual(second, first)
})
