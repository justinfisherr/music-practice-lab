import test from 'node:test'
import assert from 'node:assert/strict'
import { MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import { diatonicPcs } from './phrases.js'
import { composeModules, resolveModule, resolveTargets } from '../data/modules.js'
import {
  MODULE_SPECS,
  MODULE_TYPES,
  validatePlan,
  validatePlanConstraints,
  validatePlanShape,
} from '../../lib/modules.js'
import { angleForKey, keyAngle, nextKey } from './wheel.js'

const keyOf = (type, keyId = 'C') => resolveModule({ type, keyId, seed: 7 })

test('every module resolves in all 12 keys with targets', () => {
  for (const key of MAJOR_KEYS) {
    for (const type of MODULE_TYPES) {
      const module = resolveModule({ type, keyId: key.id, seed: 11 })
      assert.ok(module, `${type} in ${key.id}`)
      assert.ok(module.targets.length > 0, `${type} in ${key.id} targets`)
      assert.equal(module.tier, MODULE_SPECS[type].tier)
      assert.equal(module.grading, MODULE_SPECS[type].grading)
    }
  }
})

test('non-passing-dim modules stay diatonic to the key', () => {
  for (const key of MAJOR_KEYS) {
    const keySet = new Set(diatonicPcs(key.id))
    for (const type of MODULE_TYPES.filter((value) => value !== 'PASSING_DIM')) {
      const module = resolveModule({ type, keyId: key.id, seed: 3 })
      for (const target of module.targets) {
        assert.ok(target.pcs.every((pc) => keySet.has(pc)), `${type} in ${key.id}`)
      }
    }
  }
})

test('guide tones in C walk third, seventh, seventh, third', () => {
  const target = resolveTargets('GUIDE_TONES', 'C', 0)[0]
  assert.deepEqual(target.pcs, [5, 0, 5, 4])
  assert.equal(new Set(target.pcs).size < target.pcs.length, true)
})

test('passing dim in C is #Idim7', () => {
  const target = resolveTargets('PASSING_DIM', 'C', 0)[0]
  assert.deepEqual(target.pcs, [1, 4, 7, 10])
})

test('resolver is deterministic', () => {
  assert.deepEqual(keyOf('TRIADS'), keyOf('TRIADS'))
  assert.deepEqual(
    resolveModule({ type: 'EAR', keyId: 'D', seed: 123 }),
    resolveModule({ type: 'EAR', keyId: 'D', seed: 123 }),
  )
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
})

test('plan validation enforces the rationale voice', () => {
  const base = { modules: ['SCALE', 'EAR', 'II_V_I'] }
  assert.equal(validatePlan({ ...base, rationale: 'a clean, lower-case plan' }).ok, true)
  assert.equal(validatePlan({ ...base, rationale: 'A Clean Plan' }).ok, false)
  assert.equal(validatePlan({ ...base, rationale: 'a plan!' }).ok, false)
  assert.equal(validatePlan({ ...base, rationale: 'x'.repeat(201) }).ok, false)
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

test('wheel math lands on the circle of fifths positions', () => {
  assert.equal(keyAngle(0), 0)
  assert.equal(keyAngle(1), 30)
  assert.equal(keyAngle(2), 60)
  assert.equal(keyAngle(11), 330)
  assert.equal(keyAngle(12), 0)
  assert.equal(angleForKey('C'), 0)
  assert.equal(angleForKey('G'), 30)
  assert.equal(angleForKey('Gb'), 180)
  assert.equal(nextKey('C'), 'G')
  assert.equal(nextKey('F'), 'C')
})

test('Gb displays as F# without changing the key id', () => {
  assert.equal(keyDisplay('Gb'), 'F#')
  assert.equal(keyDisplay('C'), 'C')
  assert.equal(keyOf('SCALE', 'Gb').keyId, 'Gb')
})
