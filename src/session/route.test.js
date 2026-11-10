import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHash } from './route.js'

test('lessons deep link keeps the module type', () => {
  assert.deepEqual(parseHash('#lessons?type=GUIDE_TONES'), {
    view: 'lessons',
    type: 'GUIDE_TONES',
    foundation: null,
  })
  assert.deepEqual(parseHash('#lessons?foundation=chord-tones'), {
    view: 'lessons',
    type: null,
    foundation: 'chord-tones',
  })
  assert.deepEqual(parseHash('#lessons'), { view: 'lessons', type: null, foundation: null })
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

test('the hidden arcade test route parses', () => {
  assert.deepEqual(parseHash('#test/falling'), { view: 'test', sub: 'falling' })
})

test('seventh house is a session sub and takes its key from the query', () => {
  assert.deepEqual(parseHash('#session/game'), { view: 'session', sub: 'game', key: null })
  assert.deepEqual(parseHash('#session/game?key=Eb'), {
    view: 'session',
    sub: 'game',
    key: 'Eb',
  })
  assert.deepEqual(parseHash('#session/run'), { view: 'session', sub: 'run', key: null })
})

test('crate deep links keep the record id', () => {
  assert.deepEqual(parseHash('#crate'), { view: 'crate', id: null })
  assert.deepEqual(parseHash('#crate/abbey-lincoln--abbey-sings-abbey'), {
    view: 'crate',
    id: 'abbey-lincoln--abbey-sings-abbey',
  })
})
