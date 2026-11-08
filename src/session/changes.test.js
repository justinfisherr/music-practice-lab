import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bestFor,
  CHANGE_WINDOW_MS,
  changesStats,
  loadRounds,
  saveRound,
  scoreChangeChord,
  targetForDegree,
  voiceMovement,
} from './changes.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

test('targets include the seventh chord and its triad', () => {
  const target = targetForDegree('C', 1)
  assert.equal(target.name, 'Cmaj7')
  assert.deepEqual(target.pcs, [0, 4, 7, 11])
  assert.deepEqual(target.triadPcs, [0, 4, 7])
})

test('a seventh or triad at the change is a hit; a wrong chord is not', () => {
  const seventh = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    triadPcs: [0, 4, 7],
    playedMidi: [60, 64, 67, 71],
  })
  assert.equal(seventh.hit, true)
  assert.equal(seventh.base, 100)
  assert.equal(seventh.timing, 50)
  assert.equal(seventh.combo, 1)
  assert.equal(seventh.points, 150)

  const triad = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    triadPcs: [0, 4, 7],
    playedMidi: [60, 64, 67],
  })
  assert.equal(triad.hit, true)

  const wrong = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    triadPcs: [0, 4, 7],
    playedMidi: [60, 65, 67, 71],
  })
  assert.equal(wrong.hit, false)
  assert.equal(wrong.score, undefined)
  assert.equal(wrong.points, 0)
  assert.equal(wrong.combo, 0)
})

test('timing pays near the change and fades to zero at the window edge', () => {
  const atChange = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    playedMidi: [60, 64, 67, 71],
    timingMs: 0,
    windowMs: 180,
  })
  const inside = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    playedMidi: [60, 64, 67, 71],
    timingMs: 90,
    windowMs: 180,
  })
  const edge = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    playedMidi: [60, 64, 67, 71],
    timingMs: CHANGE_WINDOW_MS,
    windowMs: 180,
  })
  assert.equal(atChange.timing, 50)
  assert.equal(inside.timing, 25)
  assert.equal(edge.timing, 0)
})

test('close voice leading pays SMOOTH and a large jump loses the bonus', () => {
  const close = scoreChangeChord({
    targetPcs: [9, 0, 4, 7],
    triadPcs: [9, 0, 4],
    playedMidi: [64, 67, 69, 72],
    previousMidi: [60, 64, 67, 71],
    timingMs: 0,
  })
  assert.equal(close.hit, true)
  assert.equal(close.voiceLead, 40)
  assert.equal(close.smooth, true)
  assert.equal(close.averageMove, 2.5)
  assert.equal(close.points, 190)

  const jump = scoreChangeChord({
    targetPcs: [9, 0, 4, 7],
    triadPcs: [9, 0, 4],
    playedMidi: [81, 84, 88, 91],
    previousMidi: [60, 64, 67, 71],
    timingMs: 0,
  })
  assert.equal(jump.voiceLead, 0)
  assert.equal(jump.smooth, false)
  assert.equal(jump.points, 150)
  assert.ok(voiceMovement([60, 64, 67, 71], [81, 84, 88, 91]) > 9)
})

test('the combo multiplier rewards a streak', () => {
  const fifth = scoreChangeChord({
    targetPcs: [0, 4, 7, 11],
    playedMidi: [60, 64, 67, 71],
    combo: 5,
  })
  assert.equal(fifth.combo, 6)
  assert.equal(fifth.points, 225)
})

test('rounds record to localStorage, cap at 50, and merge session and free play', () => {
  globalThis.window = { localStorage: memoryStorage() }
  for (let i = 0; i < 55; i++) {
    saveRound({
      at: i,
      keyId: 'C',
      changesId: i % 2 ? 'turnaround' : 'ii-v-i',
      barsPerChord: 1,
      score: i * 10,
      accuracy: 50,
      voiceLead: i,
      notes: i,
    })
  }
  const rounds = loadRounds()
  assert.equal(rounds.length, 50)
  assert.equal(rounds[0].score, 50)
  assert.equal(rounds.at(-1).score, 540)
  assert.equal(bestFor(rounds, 'C', 'ii-v-i', 1), 540)
  assert.equal(bestFor(rounds, 'C', 'turnaround', 1), 530)
  assert.equal(bestFor(rounds, 'G', 'turnaround', 1), 0)

  const stats = changesStats(rounds)
  assert.equal(stats.best, 540)
  assert.equal(stats.rounds, 50)
  assert.equal(stats.average, Math.round(rounds.reduce((sum, round) => sum + round.score, 0) / 50))
  assert.equal(stats.perProgression.length, 2)
  assert.equal(stats.last.length, 8)
  assert.equal(stats.last[0].score, 540)
})
