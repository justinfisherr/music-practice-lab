import test from 'node:test'
import assert from 'node:assert/strict'
import { isPhone } from './device.js'

test('isPhone is false when matchMedia is absent', () => {
  const original = globalThis.window
  try {
    globalThis.window = {}
    assert.equal(isPhone(), false)
    globalThis.window = undefined
    assert.equal(isPhone(), false)
  } finally {
    globalThis.window = original
  }
})

test('isPhone follows the coarse-pointer, no-hover query', () => {
  const original = globalThis.window
  try {
    globalThis.window = { matchMedia: (query) => ({ matches: query === '(pointer: coarse) and (hover: none)' }) }
    assert.equal(isPhone(), true)
    globalThis.window = { matchMedia: () => ({ matches: false }) }
    assert.equal(isPhone(), false)
  } finally {
    globalThis.window = original
  }
})
