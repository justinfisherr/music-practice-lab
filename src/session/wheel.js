import { MAJOR_KEYS } from '../data/scales.js'
import { safeRead, safeWrite } from './store.js'

// The wheel follows the circle of fifths. MAJOR_KEYS is already in fifth order,
// so key i lands at theta = -30i mod 360. Rotating by that theta brings sector i
// under the fixed pointer at 12 o'clock.
export const KEY_IDS = MAJOR_KEYS.map((key) => key.id)

export function keyIndex(keyId) {
  const index = KEY_IDS.indexOf(keyId)
  return index < 0 ? 0 : index
}

export function keyAngle(index) {
  return (((-30 * index) % 360) + 360) % 360
}

export function angleForKey(keyId) {
  return keyAngle(keyIndex(keyId))
}

export function normalizeRotation(value) {
  return ((value % 360) + 360) % 360
}

// Cumulative rotation: never unwinds backwards between spins. `turns` adds
// whole revolutions so a spin reads as a spin, not a nudge.
export function rotationTo(current, keyId, turns = 1) {
  const normalized = normalizeRotation(current)
  const delta = (angleForKey(keyId) - normalized + 360) % 360
  return current + delta + 360 * turns
}

export function nextKey(keyId, step = 1) {
  return MAJOR_KEYS[(keyIndex(keyId) + step + 12) % 12].id
}

function bonusStorage(date) {
  return `mpl.bonus.${date}`
}

function spunStorage(date) {
  return `mpl.wheel.spun.${date}`
}

export function loadBonus(date) {
  const value = safeRead(bonusStorage(date), null)
  return KEY_IDS.includes(value) ? value : null
}

export function saveBonus(date, keyId) {
  if (KEY_IDS.includes(keyId)) safeWrite(bonusStorage(date), keyId)
}

export function loadSpun(date) {
  return safeRead(spunStorage(date), false) === true
}

export function markSpun(date) {
  safeWrite(spunStorage(date), true)
}

// The bonus key is never tonight's key. A re-spin moves one fifth on from the
// previous bonus; the first spin starts at the stored bonus or one fifth up.
export function bonusForKey(date, tonightKeyId, previous = null) {
  if (previous && previous !== tonightKeyId) {
    const candidate = nextKey(previous) === tonightKeyId ? nextKey(previous, 2) : nextKey(previous)
    saveBonus(date, candidate)
    return candidate
  }
  const stored = loadBonus(date)
  if (stored && stored !== tonightKeyId) return stored
  const candidate = nextKey(tonightKeyId)
  saveBonus(date, candidate)
  return candidate
}
