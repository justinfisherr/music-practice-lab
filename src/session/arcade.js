import { diatonicSevenths, keyById } from '../data/scales.js'

// SEVENTH HOUSE, pure logic: the owed-clear queue, the note stream, the row.
// No DOM, no clock. The phone session ends at fourteen cleared chords, so the
// queue only ever shrinks on a correct answer and a miss pushes the type back.

export const VERSION = 5
export const GOAL = 14
export const NOTE_GAP = 2 // single-note cues between two chord stations
export const REQUEUE_GAP = 4 // a missed station returns at least this many slots later
export const CAP_CUES = 240 // hard stop: the run can never grow forever
export const CAP_MS = 6 * 60 * 1000
export const PERFECT_MS = 350 // tap this soon after the light = PERFECT
export const GRACE_MS = 450 // the last stretch of the light is late, half credit

const BASE_MS = 1600
const FLOOR_MS = 900
const RAMP_MS = 45000
const BOMB_ODDS = 0.2
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

// 1600ms between cues at the start, 900ms once the stream is 45s old, flat after.
export function intervalFor(elapsedMs) {
  if (!(elapsedMs > 0)) return BASE_MS
  if (elapsedMs >= RAMP_MS) return FLOOR_MS
  return Math.round(BASE_MS + (FLOOR_MS - BASE_MS) * (elapsedMs / RAMP_MS))
}

// A cue stays lit until it goes dark, so the hold is the whole grade window.
export function holdFor(interval) {
  return interval
}

export function windowFor(cue) {
  return [cue.litAt, cue.litAt + cue.hold]
}

// ms from the light. The first 350ms is PERFECT, then GOOD, then the last 450ms
// of the light is a late tap that still counts, at half credit.
export function gradeTiming(delta, hold) {
  if (delta < 0) return 'miss'
  if (delta <= PERFECT_MS) return 'perfect'
  if (delta <= hold - GRACE_MS) return 'good'
  if (delta <= hold) return 'late'
  return 'miss'
}

// Kept for the graders that still share this module; the house run has no score.
export function pointsFor(timing) {
  if (timing === 'perfect' || timing === 'good') return 100
  return timing === 'late' ? 50 : 0
}

export function multiplierFor(streak) {
  if (streak >= 10) return 4
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}

// FNV-1a over the seed and the cue index: every served cue is derived from
// `${seed}|${index}`, so a run is reproducible without carrying an RNG.
export function hashSeed(value) {
  let hash = 0x811c9dc5
  const text = String(value)
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function keyPitchClasses(keyId) {
  const key = keyById(keyId)
  return MAJOR_STEPS.map((step) => (key.tonic + step) % 12)
}

// The fourteen owed clears: two slots per degree, shuffled with the seed.
export function buildQueue(seed) {
  const slots = []
  for (let degree = 0; degree < 7; degree++) slots.push(degree, degree)
  const rand = mulberry32(hashSeed(`${seed}|house`))
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  return slots
}

export function createRun({ keyId = 'C', seed = 1 } = {}) {
  return {
    keyId,
    seed,
    queue: buildQueue(seed),
    cleared: 0,
    complete: false,
    ended: false,
    degrees: Array.from({ length: 7 }, () => ({ correct: 0, missed: 0 })),
    sinceStation: NOTE_GAP, // the run opens on a station
    stationIndex: 0,
    cueIndex: 0,
    streamMs: 0,
    last: [],
    cues: { notes: 0, hits: 0, misses: 0, late: 0, bombs: 0, bombsHit: 0, total: 0 },
  }
}

// One cue at a time. Null means the run is over (14 cleared, or the cap).
export function nextCue(run) {
  if (run.ended) return null
  if (run.cleared >= GOAL) {
    run.ended = true
    run.complete = true
    return null
  }
  if (run.cues.total >= CAP_CUES || run.streamMs >= CAP_MS) {
    run.ended = true
    return null
  }

  if (run.sinceStation >= NOTE_GAP && run.queue.length) {
    const degree = run.queue.shift()
    run.sinceStation = 0
    run.stationIndex += 1
    run.cues.total += 1
    return { kind: 'station', degree }
  }

  const rand = mulberry32(hashSeed(`${run.seed}|cue|${run.cueIndex}`))
  const inKey = keyPitchClasses(run.keyId)
  const offKey = Array.from({ length: 12 }, (_, pc) => pc).filter((pc) => !inKey.includes(pc))
  const bomb = run.cues.notes >= 6 && rand() < BOMB_ODDS
  const base = bomb ? offKey : inKey
  // Never the same key three cues running.
  const pool = base.filter((pc) => !(pc === run.last[0] && pc === run.last[1]))
  const source = pool.length ? pool : base
  const pc = source[Math.floor(rand() * source.length)]
  const hold = holdFor(intervalFor(run.streamMs))

  run.cueIndex += 1
  run.cues.notes += 1
  if (bomb) run.cues.bombs += 1
  run.cues.total += 1
  run.sinceStation += 1
  run.streamMs += hold
  const prev = run.last[run.last.length - 1]
  run.last = prev == null ? [pc] : [prev, pc]

  return { kind: bomb ? 'bomb' : 'note', pc, hold }
}

export function stationChord(run, degree) {
  return diatonicSevenths(run.keyId)[degree] ?? null
}

// A right answer consumes the slot. A miss puts the same degree back four
// station slots later, so the type returns and the goal still terminates.
export function resolveStation(run, degree, correct) {
  if (correct) {
    run.degrees[degree].correct += 1
    run.cleared += 1
  } else {
    run.degrees[degree].missed += 1
    run.queue.splice(Math.min(REQUEUE_GAP, run.queue.length), 0, degree)
  }
  if (run.cleared >= GOAL) {
    run.ended = true
    run.complete = true
  }
  return run
}

export function runAccuracy(run) {
  const graded = run.cues.hits + run.cues.late + run.cues.misses
  if (!graded) return 0
  return Math.round((100 * (run.cues.hits + run.cues.late * 0.5)) / graded)
}

// Real elapsed play time: wall clock from START, minus every paused span.
// Both timestamps are Date.now() ms; performance.now() is a different clock and
// mixing the two made `now - startedAt - paused` negative, which clamped to 0.
export function playDuration(run, now = Date.now()) {
  const paused = (run.pausedMs || 0) + (run.pausedAt ? now - run.pausedAt : 0)
  return Math.max(0, Math.round(now - run.startedAt - paused))
}

// The POST body. Field names follow the session contract; the validator derives
// the row's attempts/misses from `payload.chords`, never from the client.
export function toArcadeRow(run, meta = {}) {
  const chords = {}
  let attempts = 0
  let misses = 0
  for (let degree = 0; degree < 7; degree++) {
    const row = { correct: run.degrees[degree].correct, missed: run.degrees[degree].missed }
    chords[degree + 1] = row
    attempts += row.correct + row.missed
    misses += row.missed
  }
  const complete = run.cleared >= GOAL
  return {
    id: meta.id,
    date: meta.date,
    kind: 'arcade',
    keyId: run.keyId,
    seed: run.seed,
    status: complete ? 'done' : 'abandoned',
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    durationMs: Math.max(0, Math.round(meta.durationMs || 0)),
    attempts,
    misses,
    passedStages: 0,
    moduleCount: 0,
    stages: [],
    payload: {
      version: VERSION,
      scope: 'session',
      source: 'arcade',
      mode: 'seventh-house',
      generator: 'house-1',
      keyId: run.keyId,
      seed: run.seed,
      goal: GOAL,
      cleared: run.cleared,
      complete,
      accuracy: runAccuracy(run),
      cues: { ...run.cues },
      chords,
    },
  }
}
