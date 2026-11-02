import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHash } from './route.js'

test('lessons deep link keeps the module type', () => {
  assert.deepEqual(parseHash('#lessons?type=GUIDE_TONES'), {
    view: 'lessons',
    type: 'GUIDE_TONES',
  })
  assert.deepEqual(parseHash('#lessons'), { view: 'lessons', type: null })
})

test('ledger deep links keep the stats contract', () => {
  assert.deepEqual(parseHash('#stats?wardrobe=open'), {
    view: 'stats',
    id: null,
    key: null,
    wardrobe: true,
  })
  assert.deepEqual(parseHash('#stats/run-123'), {
    view: 'stats',
    id: 'run-123',
    key: null,
    wardrobe: false,
  })
})
