import { diatonicChords } from '../data/scales.js'
import { pitchClassesEqual } from '../data/diminishedChords.js'
import { chordLabel, seventhByDegree } from './set.js'
import { safeRead, safeWrite } from './store.js'

// The 30-second changes round: a target chord per change, a timing window, and
// a voice-leading bonus measured from the last chord actually played.
export const CHANGES_ROUND_KEY = 'mpl.changes.rounds'
export const CHANGES_ROUND_SECONDS = 30
export const CHANGE_WINDOW_MS = 180
export const CHANGES_CAP = 50

export function targetForDegree(keyId, degree) {
  return {
    name: chordLabel(keyId, degree),
    pcs: seventhByDegree(keyId, degree),
    triadPcs: diatonicChords(keyId)[degree - 1].pitchClasses,
  }
}

// Average semitone movement from the previous voicing to the new one. Each new
// note takes the nearest unused previous note, so inversions and close voicings
// read as small movement while octave jumps do not.
export function voiceMovement(previousMidi, currentMidi) {
  const previous = (Array.isArray(previousMidi) ? previousMidi : [])
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const current = (Array.isArray(currentMidi) ? currentMidi : [])
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  if (!previous.length || !current.length) return null
  if (previous.length === current.length) {
    const total = current.reduce((sum, note, index) => sum + Math.abs(note - previous[index]), 0)
    return total / current.length
  }
  const used = new Set()
  let total = 0
  for (const note of current) {
    let best = Infinity
    let bestIndex = -1
    previous.forEach((other, index) => {
      if (used.has(index)) return
      const distance = Math.abs(note - other)
      if (distance < best) {
        best = distance
        bestIndex = index
      }
    })
    if (bestIndex >= 0) {
      used.add(bestIndex)
      total += best
    }
  }
  return total / current.length
}

export function voiceLeadBonus(previousMidi, currentMidi) {
  const average = voiceMovement(previousMidi, currentMidi)
  if (average == null) return { bonus: 0, average: null, smooth: false }
  const bonus = average <= 3 ? 40 : average <= 6 ? 25 : average <= 9 ? 10 : 0
  return { bonus, average, smooth: bonus > 0 }
}

export function scoreChangeChord({
  targetPcs = [],
  triadPcs = [],
  playedMidi = [],
  previousMidi = null,
  timingMs = 0,
  windowMs = CHANGE_WINDOW_MS,
  combo = 0,
} = {}) {
  const current = Number.isFinite(combo) ? Math.max(0, combo) : 0
  const midi = (Array.isArray(playedMidi) ? playedMidi : []).filter(Number.isFinite)
  const playedPcs = [...new Set(midi.map((note) => ((note % 12) + 12) % 12))].sort(
    (a, b) => a - b,
  )
  const hit = pitchClassesEqual(targetPcs, playedPcs) || pitchClassesEqual(triadPcs, playedPcs)
  if (!hit) {
    return {
      hit: false,
      points: 0,
      base: 0,
      timing: 0,
      voiceLead: 0,
      combo: 0,
      playedPcs,
      averageMove: null,
      smooth: false,
    }
  }
  const window = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : CHANGE_WINDOW_MS
  const timing = Math.round(50 * (1 - Math.min(1, Math.abs(timingMs) / window)))
  const lead = voiceLeadBonus(previousMidi, midi)
  const base = 100
  const multiplier = 1 + 0.1 * Math.min(10, current)
  return {
    hit: true,
    points: Math.round((base + timing + lead.bonus) * multiplier),
    base,
    timing,
    voiceLead: lead.bonus,
    combo: current + 1,
    playedPcs,
    averageMove: lead.average,
    smooth: lead.smooth,
  }
}

export function loadRounds() {
  const list = safeRead(CHANGES_ROUND_KEY, [])
  return Array.isArray(list) ? list.filter((round) => round && typeof round === 'object') : []
}

export function saveRound(round) {
  const list = [...loadRounds(), round].slice(-CHANGES_CAP)
  safeWrite(CHANGES_ROUND_KEY, list)
  return list
}

function sameRun(round, keyId, changesId, barsPerChord) {
  return (
    round.keyId === keyId &&
    round.changesId === changesId &&
    Number(round.barsPerChord) === Number(barsPerChord)
  )
}

export function bestFor(rounds, keyId, changesId, barsPerChord) {
  return (Array.isArray(rounds) ? rounds : []).reduce(
    (best, round) =>
      sameRun(round, keyId, changesId, barsPerChord) ? Math.max(best, round.score || 0) : best,
    0,
  )
}

export function changesStats(rounds) {
  const list = Array.isArray(rounds) ? rounds : []
  const best = list.reduce((max, round) => Math.max(max, round.score || 0), 0)
  const average = list.length
    ? Math.round(list.reduce((sum, round) => sum + (round.score || 0), 0) / list.length)
    : 0
  const perProgression = new Map()
  for (const round of list) {
    const key = `${round.keyId}|${round.changesId}|${round.barsPerChord}`
    const current = perProgression.get(key)
    if (!current || (round.score || 0) > (current.score || 0)) {
      perProgression.set(key, round)
    }
  }
  return {
    best,
    rounds: list.length,
    average,
    perProgression: [...perProgression.values()].sort(
      (a, b) => (b.score || 0) - (a.score || 0),
    ),
    last: list.slice(-8).reverse(),
  }
}
