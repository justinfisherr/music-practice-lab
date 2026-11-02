import test from 'node:test'
import assert from 'node:assert/strict'
import { describe, levelFor, titleFor } from './rank.js'

test('level boundary at 120 is level 2', () => {
  assert.equal(levelFor(119), 1)
  assert.equal(levelFor(120), 2)
})

test('level boundary at 4000 is level 10', () => {
  assert.equal(levelFor(3999), 9)
  assert.equal(levelFor(4000), 10)
  assert.equal(levelFor(9999), 10)
})

test('titles map ranges', () => {
  assert.equal(titleFor(1), 'OPENING ACT')
  assert.equal(titleFor(4), 'SIDE PLAYER')
  assert.equal(titleFor(6), 'SESSION PLAYER')
  assert.equal(titleFor(8), 'HEADLINER')
  assert.equal(titleFor(10), 'BANDLEADER')
})

test('describe gives floor, next, toNext, and pct', () => {
  const info = describe(150)
  assert.equal(info.level, 2)
  assert.equal(info.floor, 120)
  assert.equal(info.next, 300)
  assert.equal(info.toNext, 150)
  assert.equal(info.pct, 17)
  assert.equal(info.title, 'OPENING ACT')
})

test('max level has no next', () => {
  const info = describe(5000)
  assert.equal(info.level, 10)
  assert.equal(info.next, null)
  assert.equal(info.toNext, 0)
  assert.equal(info.pct, 100)
})
