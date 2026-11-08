import test from 'node:test'
import assert from 'node:assert/strict'
import { FOUNDATIONS, foundationById } from './foundations.js'
import { CARD_FOUNDATION } from '../../lib/cards.js'

test('ten foundations, each with three checks', () => {
  assert.equal(FOUNDATIONS.length, 10)
  for (const lesson of FOUNDATIONS) {
    assert.ok(lesson.id)
    assert.ok(lesson.title)
    assert.equal(lesson.checks.length, 3)
    for (const check of lesson.checks) {
      assert.ok(Array.isArray(check.options) && check.options.length >= 2)
      assert.ok(Number.isInteger(check.answer))
      assert.ok(check.answer >= 0 && check.answer < check.options.length)
    }
    assert.ok(foundationById(lesson.id))
  }
})

test('every card foundation points at a real lesson', () => {
  assert.deepEqual(Object.keys(CARD_FOUNDATION).sort(), [
    'COMP_THE_CHANGES',
    'GUIDE_TONES',
    'LAND_THE_3RD',
    'LAND_THE_5TH',
    'LAND_THE_7TH',
    'NO_ROOTS',
    'ONE_NOTE_SOLO',
    'SMALL_RANGE',
  ])
  for (const id of Object.values(CARD_FOUNDATION)) {
    assert.ok(foundationById(id), `missing foundation ${id}`)
  }
})
