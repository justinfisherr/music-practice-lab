import { keyById } from '../data/scales.js'

// Lit-key prototype: pure cue logic, no DOM. A cue lights one to four keys on a
// one-octave piano and stays lit for its grade window. Nothing here knows what a
// phone is.

export const RUN_CUES = 60
export const BEST_KEY = 'mpl.arcade.falling.best'
export const PERFECT_MS = 350 // tap this soon after the light = PERFECT
export const GRACE_MS = 450 // the last stretch of the light is late, at half points
export const CUE_WORD_MS = 420 // how long a grade word holds on screen

const BASE_MS = 1600
const FLOOR_MS = 900
const RAMP_MS = 45000
const CHORD_HOLD = 1.25
const CHORD_ODDS = 1 / 7
const MAX_CHORDS = 3
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

// 1600ms between cues at the start, 900ms once the run is 45s old, then flat.
export function intervalFor(elapsedMs) {
  if (!(elapsedMs > 0)) return BASE_MS
  if (elapsedMs >= RAMP_MS) return FLOOR_MS
  return Math.round(BASE_MS + (FLOOR_MS - BASE_MS) * (elapsedMs / RAMP_MS))
}

// A cue stays lit until the next one arrives, so the hold is the time to the
// next cue. A chord has more keys to enter and gets a quarter more.
export function holdFor(interval, kind = 'note') {
  return kind === 'chord' ? Math.round(interval * CHORD_HOLD) : interval
}

export function windowFor(cue) {
  return [cue.t, cue.t + cue.hold]
}

export function multiplierFor(streak) {
  if (streak >= 10) return 4
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}

// ms from the light. The first 350ms is PERFECT, then GOOD, then the last 450ms
// of the light is a late tap that still counts, at half points.
export function gradeTiming(delta, hold) {
  if (delta < 0) return 'miss'
  if (delta <= PERFECT_MS) return 'perfect'
  if (delta <= hold - GRACE_MS) return 'good'
  if (delta <= hold) return 'late'
  return 'miss'
}

// PERFECT and on-time GOOD are worth 100, a late tap 50.
export function pointsFor(timing) {
  if (timing === 'perfect' || timing === 'good') return 100
  return timing === 'late' ? 50 : 0
}

export function bestScore() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0 // private mode: no record, no crash
  }
}

export function saveBest(score) {
  if (!(score > bestScore())) return false
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    return false
  }
  return true
}

// Deterministic 32-bit PRNG, so a reload of the same night is the same run.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Cues on a timeline. `pcs` is what lights. A bomb is one off-key key.
export function buildRun({ keyId = 'C', seed = 1, cues = RUN_CUES } = {}) {
  const rand = mulberry32(seed)
  const key = keyById(keyId)
  const inKey = MAJOR_STEPS.map((step) => (key.tonic + step) % 12)
  const offKey = Array.from({ length: 12 }, (_, pc) => pc).filter((pc) => !inKey.includes(pc))
  const pick = (pool) => Math.floor(rand() * pool.length)

  const events = []
  let t = intervalFor(0) // a beat to read NEXT before the first light
  let firstA = -1
  let firstB = -1
  let chords = 0
  let nextBomb = 7 + Math.floor(rand() * 3) // cue 8 at the earliest
  const repeat = (pc) => pc === firstA && pc === firstB

  for (let i = 0; i < cues; i++) {
    const interval = intervalFor(t)
    const canSpecial = i >= 3
    const bomb = i >= 7 && i >= nextBomb
    let event

    if (canSpecial && !bomb && chords < MAX_CHORDS && rand() < CHORD_ODDS) {
      // A diatonic dyad or triad, rooted somewhere that breaks a run.
      const size = 2 + Math.floor(rand() * 2)
      let root = pick(MAJOR_STEPS)
      for (let spin = 0; spin < 6 && repeat(inKey[root]); spin++) root = (root + 1) % 7
      const pcs = [0, 2, 4].slice(0, size).map((step) => inKey[(root + step) % 7])
      event = { t: Math.round(t), hold: holdFor(interval, 'chord'), pcs, kind: 'chord' }
      chords += 1
    } else {
      if (bomb) nextBomb = i + 4 + Math.floor(rand() * 3)
      const pool = (bomb ? offKey : inKey).filter((pc) => !repeat(pc))
      const pc = pool.length ? pool[pick(pool)] : (bomb ? offKey : inKey)[0]
      event = {
        t: Math.round(t),
        hold: holdFor(interval),
        pcs: [pc],
        kind: bomb ? 'bomb' : 'note',
      }
    }

    events.push(event)
    firstA = firstB
    firstB = event.pcs[0]
    t += event.hold
  }

  return events
}
