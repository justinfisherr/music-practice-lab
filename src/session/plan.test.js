import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePlan } from '../../lib/plan.js'

test('parses a clean plan object', () => {
  const plan = parsePlan(
    JSON.stringify({
      rationale: 'a stepwise line that leans on the third',
      earDegrees: [1, 3, 5, 6],
      hookDegrees: [1, 2, 3, 5, 4, 3],
    }),
  )
  assert.deepEqual(plan, {
    rationale: 'a stepwise line that leans on the third',
    earDegrees: [1, 3, 5, 6],
    hookDegrees: [1, 2, 3, 5, 4, 3],
  })
})

test('strips fences and surrounding prose', () => {
  const plan = parsePlan(
    'Sure, here it is:\n```json\n{"rationale":"ok","earDegrees":[1,2,3,4],"hookDegrees":[1,2,3,4,5,6]}\n```',
  )
  assert.equal(plan.rationale, 'ok')
})

test('rejects out-of-range degrees', () => {
  assert.equal(
    parsePlan('{"rationale":"x","earDegrees":[0,2,3,4],"hookDegrees":[1,2,3,4,5,6]}'),
    null,
  )
})

test('rejects adjacent equal degrees', () => {
  assert.equal(
    parsePlan('{"rationale":"x","earDegrees":[1,1,3,4],"hookDegrees":[1,2,3,4,5,6]}'),
    null,
  )
})

test('rejects wrong phrase lengths', () => {
  assert.equal(
    parsePlan('{"rationale":"x","earDegrees":[1,2,3],"hookDegrees":[1,2,3,4,5,6]}'),
    null,
  )
})

test('strips control chars and truncates rationale', () => {
  const long = 'a'.repeat(300) + '\n'
  const plan = parsePlan(
    JSON.stringify({
      rationale: long,
      earDegrees: [1, 2, 3, 4],
      hookDegrees: [1, 2, 3, 4, 5, 6],
    }),
  )
  assert.equal(plan.rationale.length, 200)
  assert.ok(!plan.rationale.includes('\n'))
})

test('returns null for non-JSON', () => {
  assert.equal(parsePlan('not json'), null)
  assert.equal(parsePlan(null), null)
})
