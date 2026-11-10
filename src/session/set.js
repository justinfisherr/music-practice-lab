import { keyById } from '../data/scales.js'
import { noteName } from '../data/diminishedChords.js'
import { fnv1a } from './tonight.js'
import { mulberry32 } from './phrases.js'
import { gradeSet } from './grade.js'

// Pure v4 grading and generation. No audio, no MIDI, no DOM: the UI feeds it
// pitch classes and clock readings, so the same vectors are testable.
const QUALITY = ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'halfDim']
const INTERVALS = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  halfDim: [0, 3, 6, 10],
}
const STEPS = [0, 2, 4, 5, 7, 9, 11]
const THIRD = { maj7: 4, min7: 3, dom7: 4, halfDim: 3 }

export const TURNAROUND_DEGREES = [1, 6, 2, 5]
export const PROGRESSION_DEGREES = TURNAROUND_DEGREES
export const RAPID_DEGREES = [1, 2, 3, 4, 5, 6]
export const JAM_DEGREES = [1, 6, 2, 5, 2, 5, 1, 6, 1, 6, 2, 5, 2, 5, 1, 6]

// Classic 12-bar form: four I, two IV, two I, V–IV–I–V.
export const BLUES_DEGREES = [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5]

// Playable progressions for the end-of-set jam. Degrees are scale degrees of
// the major key; barsPerChord repeats each one.
export const PLAY_CHANGES = [
  { id: 'i-iv-v', name: '1-4-5', degrees: [1, 4, 5] },
  { id: 'i-v-vi-iv', name: '1-5-6-4', degrees: [1, 5, 6, 4] },
  { id: 'i-vi-iv-v', name: '1-6-4-5', degrees: [1, 6, 4, 5] },
  { id: 'i-v-vi-iii-iv', name: '1-5-6-3-4', degrees: [1, 5, 6, 3, 4] },
  { id: 'ii-v-i', name: '2-5-1', degrees: [2, 5, 1] },
  { id: 'iii-vi-ii-v-i', name: '3-6-2-5-1', degrees: [3, 6, 2, 5, 1] },
  { id: 'vii-iii-vi', name: '7-3-6', degrees: [7, 3, 6] },
  { id: 'blues-12', name: '12-bar blues', degrees: BLUES_DEGREES },
  { id: 'turnaround', name: 'turnaround', degrees: [1, 6, 2, 5] },
]

export function buildJamDegrees(id, barsPerChord = 1) {
  const changes = PLAY_CHANGES.find((entry) => entry.id === id) || PLAY_CHANGES.at(-1)
  const repeats = [1, 2, 4].includes(barsPerChord) ? barsPerChord : 1
  return changes.degrees.flatMap((degree) => Array(repeats).fill(degree))
}
export const LAND_WINDOW_MS = 180

export function degreeRootPc(keyId, degree) {
  return (keyById(keyId).tonic + STEPS[degree - 1] + 12) % 12
}

export function seventhByDegree(keyId, degree) {
  const quality = QUALITY[degree - 1]
  const root = degreeRootPc(keyId, degree)
  return [...new Set(INTERVALS[quality].map((iv) => (root + iv) % 12))].sort((a, b) => a - b)
}

export function seventhQuality(degree) {
  return QUALITY[degree - 1]
}

const CHORD_SUFFIX = { maj7: 'maj7', min7: 'm7', dom7: '7', halfDim: 'm7b5' }

export function chordLabel(keyId, degree) {
  return `${noteName(degreeRootPc(keyId, degree))}${CHORD_SUFFIX[QUALITY[degree - 1]]}`
}

// Blues I/IV/V are dominant sevenths, not the diatonic maj7 on I, so this
// cannot reuse chordLabel's QUALITY table.
export function bluesChord(keyId, degree) {
  const root = degreeRootPc(keyId, degree)
  const pcs = INTERVALS.dom7.map((interval) => (root + interval) % 12)
  return { pcs, label: `${noteName(root)}7` }
}

// One bar of eight boogie eighths: root, 3, 5, 6, b7, 6, 5, 3.
export function boogiePcs(keyId, degree) {
  const [root, third, fifth, flatSeven] = bluesChord(keyId, degree).pcs
  const sixth = (root + 9) % 12
  return [root, third, fifth, sixth, flatSeven, sixth, fifth, third]
}

export function thirdPc(keyId, degree) {
  return (degreeRootPc(keyId, degree) + THIRD[QUALITY[degree - 1]]) % 12
}

// Target pitch class for a land card: the chord's 3rd, 5th, or 7th.
export function chordTonePc(keyId, degree, tone) {
  const intervals = INTERVALS[QUALITY[degree - 1]]
  const index = tone === 3 ? 1 : tone === 5 ? 2 : tone === 7 ? 3 : 1
  return (degreeRootPc(keyId, degree) + intervals[index]) % 12
}

// The key's 5th, used by the one-note solo.
export function fifthPc(keyId) {
  return (keyById(keyId).tonic + 7) % 12
}

// Scale degrees 3-7: the five-note solo range.
export function fiveNoteRangePcs(keyId) {
  return [3, 4, 5, 6, 7].map((degree) => degreeRootPc(keyId, degree))
}

// Warm-up progressions that actually occur in tunes. The warm-up draws one
// per night; it is not locked to ii-V-I.
export const PROGRESSIONS = [
  { id: 'ii-v-i', name: 'II–V–I', degrees: [2, 5, 1] },
  { id: 'turnaround', name: 'TURNAROUND', degrees: [1, 6, 2, 5] },
  { id: 'iii-vi-ii-v', name: 'III–VI–II–V', degrees: [3, 6, 2, 5] },
  { id: 'i-iv-ii-v', name: 'I–IV–II–V', degrees: [1, 4, 2, 5] },
  { id: 'ii-v-i-vi', name: 'II–V–I–VI', degrees: [2, 5, 1, 6] },
  { id: 'blues-turn', name: 'BLUES TURN', degrees: [1, 4, 1, 5] },
  { id: 'i-vi-iv-v', name: 'I–VI–IV–V', degrees: [1, 6, 4, 5] },
]

export function chooseProgression(seed, keyId) {
  const rng = mulberry32((seed ^ fnv1a(`prog|${keyId}`)) >>> 0)
  return PROGRESSIONS[Math.floor(rng() * PROGRESSIONS.length)]
}

export function phrasePcs(keyId, degrees) {
  return (Array.isArray(degrees) ? degrees : []).map((degree) => degreeRootPc(keyId, degree))
}

// The v4 warm-up ear phrase always starts on the root, so the player has an
// anchor. Later ear drills can drop the anchor; this one is a warm-up.
export function rootFirstPhrase(seed, keyId, count = 4) {
  const rng = mulberry32((seed ^ fnv1a(`root|${keyId}`)) >>> 0)
  const degrees = [1]
  let previous = 1
  while (degrees.length < count) {
    let degree = 1 + Math.floor(rng() * 7)
    if (degree === previous) degree = (degree % 7) + 1
    degrees.push(degree)
    previous = degree
  }
  return degrees.map((degree) => degreeRootPc(keyId, degree))
}

// Forty rapid-fire degrees, deterministic per key and seed, never the same
// twice in a row. Scoring is speed plus combo; the target is a floor, not a cap.
export function rapidPrompts(seed = 0, keyId = 'C', count = 40) {
  const rng = mulberry32((seed ^ fnv1a(`rapid|${keyId}`)) >>> 0)
  const prompts = []
  let previous = 0
  for (let i = 0; i < count; i++) {
    let degree = 1 + Math.floor(rng() * 7)
    if (degree === previous) degree = (degree % 7) + 1
    prompts.push(degree)
    previous = degree
  }
  return prompts
}

export const RAPID_COUNT = 40
export const INVERSION_BONUS = 50
// Rapid-fire chord drill. The bar is the only clock: the first note starts it,
// every new chord tone restarts it, and it runs out to move on. Hitting all the
// tones scores the chord but does not advance it.
export const CHORD_BAR_MS = 4000
export const CHORD_CLEAN_POINTS = 100
export const CHORD_HOLD_POINTS = 10
export const CHORD_MISS_POINTS = -25
export const CONFIDENCE_STEP = 0.25
export const CONFIDENCE_FLOOR_WEIGHT = 0.15
// Moving to the next prompt waits for the player's hand to stop: this much
// silence advances it, and the cap keeps a fast comping hand from stalling the
// drill. Waiting beats guessing which notes are the tail.
export const CHORD_TAIL_SILENCE_MS = 600
export const CHORD_TAIL_CAP_MS = 1800

// One step of a rapid-fire prompt. `pc` is the incoming pitch class, or null
// for "the bar ran out". Kinds: 'next' is a chord tone (score it when solved),
// 'ignore' is anything played after the chord is already solved, 'miss' costs
// points and advances, 'advance' moves on without scoring.
export function rapidChordStep({ target = [], played = [], pc = null } = {}) {
  const tones = Array.isArray(target) ? target : []
  const have = Array.isArray(played) ? played : []
  const solved = tones.length > 0 && have.length >= tones.length
  if (pc == null) return { kind: solved ? 'advance' : 'miss', solved, played: have }
  if (solved) return { kind: 'ignore', solved, played: have }
  if (!tones.includes(pc)) return { kind: 'miss', solved, played: have }
  const next = have.includes(pc) ? have : [...have, pc]
  return { kind: 'next', solved: next.length >= tones.length, played: next }
}

export function emptyConfidence() {
  return Array(7).fill(0)
}

export function bumpConfidence(list, degree, clean) {
  return list.map((value, index) => {
    if (index !== degree - 1) return value
    const next = value + (clean ? CONFIDENCE_STEP : -CONFIDENCE_STEP)
    return Math.min(1, Math.max(0, Math.round(next * 100) / 100))
  })
}

export function allDegreesFilled(list) {
  return list.length === 7 && list.every((value) => value >= 1)
}

// Weighted draw toward the degrees that are least filled; uniform once every
// degree is full, so practice keeps flowing until the user moves on.
export function pickRapidDegree(rng, confidence) {
  const values =
    Array.isArray(confidence) && confidence.length === 7 ? confidence : emptyConfidence()
  if (values.every((value) => value >= 1)) return 1 + Math.floor(rng() * 7)
  const weights = values.map((value) => 1 - value + CONFIDENCE_FLOOR_WEIGHT)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let ticket = rng() * total
  for (let index = 0; index < weights.length; index++) {
    ticket -= weights[index]
    if (ticket <= 0) return index + 1
  }
  return 7
}

// A clean chord pays the base times the streak, plus a bonus for a non-root
// bass. A missed chord knocks a little off and resets the streak.
export function scoreChord({ clean, combo = 0, inversion = false, penalty = true } = {}) {
  const current = Number.isFinite(combo) ? Math.max(0, combo) : 0
  if (!clean) return { points: penalty ? CHORD_MISS_POINTS : 0, combo: 0 }
  const base = Math.round(CHORD_CLEAN_POINTS * Math.min(2, 1 + 0.1 * current))
  return { points: base + (inversion ? INVERSION_BONUS : 0), combo: current + 1 }
}

// Four bars, one chord per bar. A hit is the first note inside the downbeat
// window whose pitch class is the chord's third. Later notes are extra, not
// harmful; a held note from the previous bar has no onset here, so it misses.
export function scoreLandTheThird(bars, notes) {
  const list = Array.isArray(notes) ? notes : []
  const rows = []
  let combo = 0
  let bestCombo = 0
  for (let index = 0; index < (Array.isArray(bars) ? bars.length : 0); index++) {
    const bar = bars[index]
    const start = Number.isFinite(bar.startMs) ? bar.startMs : index * (bar.barMs || 0)
    const window = Number.isFinite(bar.windowMs) ? bar.windowMs : LAND_WINDOW_MS
    const candidates = list
      .filter(
        (note) =>
          note &&
          Number.isFinite(note.at) &&
          Number.isFinite(note.pc) &&
          note.at >= start - window &&
          note.at <= start + window,
      )
      .sort((a, b) => a.at - b.at)
    const first = candidates[0] || null
    const hit = Boolean(first) && first.pc === bar.targetPc
    const timingBonus = hit
      ? Math.round(100 * (1 - Math.min(1, Math.abs(first.at - start) / window)))
      : 0
    if (hit) {
      combo += 1
      bestCombo = Math.max(bestCombo, combo)
    } else {
      combo = 0
    }
    rows.push({
      index,
      targetPc: bar.targetPc,
      playedPc: first ? first.pc : null,
      at: first ? first.at : null,
      hit,
      timingBonus,
    })
  }
  const hits = rows.filter((row) => row.hit).length
  return { rows, hits, combo: bestCombo, passed: hits >= 2 }
}

// One chord per bar: grade the set of notes in each bar against that bar's
// seventh chord. Two complete chords is the pass.
export function scoreComp(bars, notes) {
  const list = Array.isArray(notes) ? notes : []
  const rows = (Array.isArray(bars) ? bars : []).map((bar, index) => {
    const start = Number.isFinite(bar.startMs) ? bar.startMs : index * (bar.barMs || 0)
    const end = start + (Number.isFinite(bar.barMs) ? bar.barMs : 2000)
    const playedPcs = [
      ...new Set(
        list
          .filter((note) => note && Number.isFinite(note.at) && note.at >= start && note.at < end)
          .map((note) => note.pc),
      ),
    ]
    const graded = gradeSet(bar.targetPcs, playedPcs)
    return {
      index,
      targetPcs: bar.targetPcs,
      playedPcs,
      hit: graded.passed,
    }
  })
  const hits = rows.filter((row) => row.hit).length
  return { rows, hits, passed: hits >= 2 }
}

// The 16-bar jam. In-key notes score; chord tones score more, chord tones on
// beats 1 and 3 score most. Out-of-key resets the combo. The multiplier pays
// the streak built before this note.
export function scoreJamNote({ pc, chordPcs = [], keyPcs = [], beatInBar = 0, combo = 0 } = {}) {
  const current = Number.isFinite(combo) ? Math.max(0, combo) : 0
  const inKey = keyPcs.includes(pc)
  if (!inKey) {
    return { inKey: false, chordTone: false, strong: false, points: 0, combo: 0 }
  }
  const chordTone = chordPcs.includes(pc)
  const strong = chordTone && (beatInBar === 0 || beatInBar === 2)
  const base = 1 + (chordTone ? 2 : 0) + (strong ? 2 : 0)
  const multiplier = 1 + 0.1 * Math.min(10, current)
  return {
    inKey: true,
    chordTone,
    strong,
    points: Math.round(base * multiplier),
    combo: current + 1,
  }
}

export function soloViolates(rule, pc, { roots = [], range = [], targetPc = null } = {}) {
  if (rule === 'noRoots') return roots.includes(pc)
  if (rule === 'range') return !range.includes(pc)
  if (rule === 'oneNote') return pc !== targetPc
  return false
}

// Solos are graded over every note in the four bars, not just the first note
// per bar. A pass needs four notes and zero rule violations.
export function scoreSolo(rule, notes, targets = {}) {
  const list = (Array.isArray(notes) ? notes : []).filter(
    (note) => note && Number.isFinite(note.pc),
  )
  const offenders = list.filter((note) => soloViolates(rule, note.pc, targets))
  return {
    rule,
    total: list.length,
    offenders: offenders.map((note) => note.pc),
    rows: list.map((note) => ({
      pc: note.pc,
      at: note.at,
      ok: !soloViolates(rule, note.pc, targets),
    })),
    passed: list.length >= 4 && offenders.length === 0,
  }
}
