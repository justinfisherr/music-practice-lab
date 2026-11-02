import { MAJOR_KEYS } from '../data/scales.js'

// The wheel follows the circle of fifths. MAJOR_KEYS is already in fifth order,
// so an index maps straight onto a position. The requested angle is
// (-330 * i) mod 360, which is the same position as 30 * i clockwise.
export const KEY_IDS = MAJOR_KEYS.map((key) => key.id)

export function keyIndex(keyId) {
  const index = KEY_IDS.indexOf(keyId)
  return index < 0 ? 0 : index
}

export function keyAngle(index) {
  return (((-330 * index) % 360) + 360) % 360
}

export function angleForKey(keyId) {
  return keyAngle(keyIndex(keyId))
}

export function nextKey(keyId, step = 1) {
  return MAJOR_KEYS[(keyIndex(keyId) + step + 12) % 12].id
}
