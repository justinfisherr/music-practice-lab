import { keyById } from '../data/scales.js'
import { fnv1a } from './tonight.js'

const STEPS = [0, 2, 4, 5, 7, 9, 11]

// Six notes laid across two 4/4 bars: three attacks per bar, then a rest.
export const HOOK_BEATS = [0, 1, 2, 4, 5, 6]
export const EAR_GAP = 60 / 96 // 96 bpm

export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function diatonicPcs(keyId) {
  const tonic = keyById(keyId).tonic
  return STEPS.map((step) => (tonic + step) % 12)
}

function randomWalk(rng, degrees, count) {
  const pcs = []
  let degree = Math.floor(rng() * degrees.length)
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const step = [-2, -1, 1, 2][Math.floor(rng() * 4)]
      degree = (degree + step + degrees.length) % degrees.length
    }
    pcs.push(degrees[degree])
  }
  return pcs
}

// A four-note ear phrase in the key. No immediate octave/PC repeat, so the
// listener hears four distinct events.
export function earPhrase(seed, keyId) {
  const rng = mulberry32((seed ^ fnv1a('ear')) >>> 0)
  const degrees = diatonicPcs(keyId)
  const pcs = []
  for (let i = 0; i < 4; i++) {
    let pc = degrees[Math.floor(rng() * degrees.length)]
    if (pcs.length && pc === pcs[pcs.length - 1]) {
      const offset = 1 + Math.floor(rng() * (degrees.length - 1))
      pc = degrees[(degrees.indexOf(pc) + offset) % degrees.length]
    }
    pcs.push(pc)
  }
  return pcs
}

// A six-note hook, also diatonic, generated as a deterministic walk.
export function hookPhrase(seed, keyId) {
  const rng = mulberry32((seed ^ fnv1a('hook')) >>> 0)
  const degrees = diatonicPcs(keyId)
  const pcs = randomWalk(rng, degrees, 6)
  for (let i = 1; i < pcs.length; i++) {
    while (pcs[i] === pcs[i - 1]) {
      const idx = degrees.indexOf(pcs[i])
      pcs[i] = degrees[(idx + 1) % degrees.length]
    }
  }
  return pcs
}
