import { keyById } from '../data/scales.js'

// Falling-note prototype: pure timing/geometry logic, no DOM. The page renders
// from these events; nothing here knows what a phone is.

export const RUN_NOTES = 60
export const RUN_MS = 60000
export const FALL_MS = 900
export const HIT_MS = 140 // early/late window around the hit line
export const CHORD_STEP_MS = 90 // each extra chord note widens the window
export const PERFECT_MS = 70
export const GOOD_MS = 160
export const BEST_KEY = 'mpl.arcade.falling.best'

const BASE_MS = 850
const FLOOR_MS = 420
const RAMP_MS = 30000
const CHORD_ODDS = 1 / 7
const MAX_CHORDS = 3
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

// 850ms between notes at the start, 420ms once the run is 30s old, then flat.
export function intervalFor(elapsedMs) {
  if (!(elapsedMs > 0)) return BASE_MS
  if (elapsedMs >= RAMP_MS) return FLOOR_MS
  return Math.round(BASE_MS + (FLOOR_MS - BASE_MS) * (elapsedMs / RAMP_MS))
}

export function multiplierFor(streak) {
  if (streak >= 10) return 4
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}

export function windowFor(event) {
  const extra = event.kind === 'chord' ? CHORD_STEP_MS * (event.pcs.length - 1) : 0
  return [event.t - HIT_MS, event.t + HIT_MS + extra]
}

// A tap at `at` (ms from run start). done() marks events already resolved.
export function grade(events, pc, at, done = () => false) {
  let best = null
  for (const event of events) {
    if (done(event) || !event.pcs.includes(pc)) continue
    const [start, end] = windowFor(event)
    if (at < start || at > end) continue
    if (!best || event.t < best.t) best = event
  }
  if (!best) return { event: null, result: 'stray' }
  return { event: best, result: best.kind === 'bomb' ? 'bomb' : 'hit' }
}

// Graded to the middle of the window, so a chord's extra span does not count
// against the one tap that clears it.
export function deltaFor(event, at) {
  const extra = event.kind === 'chord' ? CHORD_STEP_MS * (event.pcs.length - 1) : 0
  return at - (event.t + extra / 2)
}

export function gradeTiming(delta) {
  const off = Math.abs(delta)
  if (off <= PERFECT_MS) return 'perfect'
  if (off <= GOOD_MS) return 'good'
  return 'miss'
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

export function buildRun({ keyId = 'C', seed = 1, notes = RUN_NOTES } = {}) {
  const rand = mulberry32(seed)
  const key = keyById(keyId)
  const inKey = MAJOR_STEPS.map((step) => (key.tonic + step) % 12)
  const offKey = Array.from({ length: 12 }, (_, pc) => pc).filter((pc) => !inKey.includes(pc))
  const pick = (pool) => Math.floor(rand() * pool.length)

  const events = []
  let t = intervalFor(0) * 2 // a beat to read the field before the first note
  let lastPc = -1
  let colA = -1 // two back
  let colB = -1 // one back
  let chords = 0
  let nextBomb = 3 // the 4th note is the first possible bomb

  for (let i = 0; events.length < notes; i++) {
    if (t > RUN_MS) break
    const interval = intervalFor(t)
    const avoidCol = colA === colB ? colB : -1
    const canSpecial = i >= 3
    let event

    if (canSpecial && chords < MAX_CHORDS && rand() < CHORD_ODDS) {
      // A real diatonic triad (or seventh while the field is still slow).
      const four = interval > 400 && rand() < 0.25
      const degrees = four ? [0, 2, 4, 6] : [0, 2, 4]
      let root = pick(MAJOR_STEPS)
      for (let spin = 0; spin < 7; spin++) {
        const anchor = inKey[root]
        if (anchor !== lastPc && (avoidCol < 0 || anchor % 4 !== avoidCol)) break
        root = (root + 1) % 7
      }
      const pcs = degrees.map((d) => inKey[(root + d) % 7])
      event = { t: Math.round(t), pcs, kind: 'chord', column: pcs[0] % 4 }
      chords += 1
    } else {
      let wantBomb = false
      if (canSpecial && i >= nextBomb) {
        wantBomb = true
        nextBomb = i + 4 + Math.floor(rand() * 3) // roughly every fifth note
      }
      const pool = (wantBomb ? offKey : inKey).filter(
        (pc) => pc !== lastPc && (avoidCol < 0 || pc % 4 !== avoidCol),
      )
      const pc = pool[pick(pool)] ?? (inKey.find((p) => p !== lastPc) ?? 0)
      event = { t: Math.round(t), pcs: [pc], kind: wantBomb ? 'bomb' : 'note', column: pc % 4 }
    }

    events.push(event)
    lastPc = event.pcs[0]
    colA = colB
    colB = event.column
    t += interval + (event.kind === 'chord' ? CHORD_STEP_MS * (event.pcs.length - 1) : 0)
  }

  return events
}
