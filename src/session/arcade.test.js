import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CAP_CUES,
  GOAL,
  NOTE_GAP,
  buildQueue,
  createRun,
  gradeTiming,
  hashSeed,
  intervalFor,
  nextCue,
  resolveStation,
  runAccuracy,
  stationChord,
  toArcadeRow,
} from './arcade.js'
import { diatonicSevenths, keyById } from '../data/scales.js'
import { validate } from '../../api/sessions.js'

const SEEDS = [1, 7, 99, 12345]
const KEYS = ['C', 'Gb', 'A', 'Eb']

const keyPcs = (keyId) => {
  const key = keyById(keyId)
  return [0, 2, 4, 5, 7, 9, 11].map((step) => (key.tonic + step) % 12)
}

// nextCue hands out one event at a time; `answer` decides every station.
function play({ keyId = 'C', seed = 1, answer = () => true } = {}) {
  const run = createRun({ keyId, seed })
  const stations = []
  const kinds = []
  for (let guard = 0; guard < 1000; guard++) {
    const cue = nextCue(run)
    if (!cue) break
    kinds.push(cue.kind)
    if (cue.kind === 'station') {
      const correct = answer(run, cue.degree, stations.length)
      stations.push({ degree: cue.degree, correct })
      resolveStation(run, cue.degree, correct)
    }
  }
  return { run, stations, kinds }
}

test('a perfect run consumes exactly fourteen stations and ends there', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const { run, stations, kinds } = play({ keyId, seed })
      assert.equal(stations.length, GOAL, 'fourteen stations, no more')
      assert.equal(run.cleared, GOAL)
      assert.equal(run.complete, true)
      assert.equal(run.ended, true)
      assert.equal(run.queue.length, 0, 'every owed slot was consumed')
      for (const row of run.degrees) {
        assert.equal(row.correct, 2, 'each degree cleared twice')
        assert.equal(row.missed, 0)
      }
      assert.equal(kinds.filter((kind) => kind === 'station').length, GOAL)
    }
  }
})

test('the run never ends before fourteen cleared chords', () => {
  const run = createRun({ keyId: 'C', seed: 3 })
  for (let stations = 0; ; ) {
    const cue = nextCue(run)
    if (!cue) break
    if (cue.kind !== 'station') continue
    stations += 1
    if (stations < GOAL) {
      resolveStation(run, cue.degree, true)
      assert.equal(run.ended, false, `ended at ${run.cleared} clears`)
    } else {
      resolveStation(run, cue.degree, true)
      assert.equal(run.cleared, GOAL)
      assert.equal(run.ended, true)
    }
  }
})

test('a missed station returns at least four station slots later', () => {
  const run = createRun({ keyId: 'A', seed: 11 })
  const seen = []
  let missedDegree = null
  for (;;) {
    const cue = nextCue(run)
    if (!cue) break
    if (cue.kind !== 'station') continue
    const wrong = missedDegree == null
    if (wrong) missedDegree = cue.degree
    seen.push(cue.degree)
    resolveStation(run, cue.degree, !wrong)
    if (!wrong && seen.indexOf(missedDegree) !== seen.lastIndexOf(missedDegree)) break
  }
  const first = seen.indexOf(missedDegree)
  const again = seen.indexOf(missedDegree, first + 1)
  assert.ok(again > first, 'the missed type came back')
  assert.ok(again - first > NOTE_GAP, `${again - first} stations later, expected more than 4`)
})

test('no two stations are adjacent: four single notes sit between', () => {
  for (const seed of SEEDS) {
    const { kinds } = play({ keyId: 'C', seed })
    for (let i = 1; i < kinds.length; i++) {
      assert.ok(
        !(kinds[i] === 'station' && kinds[i - 1] === 'station'),
        `stations ${i - 1} and ${i} are adjacent`,
      )
    }
    const firstStation = kinds.indexOf('station')
    assert.equal(firstStation, 0, 'the run opens on a station')
    const stations = kinds.filter((kind) => kind === 'station').length
    const notes = kinds.filter((kind) => kind !== 'station').length
    assert.equal(notes, (stations - 1) * NOTE_GAP, 'exactly four notes between stations')
  }
})

test('every station is four distinct in-key pitch classes', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const sevenths = diatonicSevenths(keyId)
      const pcs = keyPcs(keyId)
      const run = createRun({ keyId, seed })
      for (;;) {
        const cue = nextCue(run)
        if (!cue) break
        if (cue.kind !== 'station') continue
        const chord = stationChord(run, cue.degree)
        assert.ok(chord, 'a station always names a diatonic seventh')
        assert.equal(chord.pitchClasses.length, 4)
        assert.equal(new Set(chord.pitchClasses).size, 4, 'four distinct keys')
        for (const pc of chord.pitchClasses) assert.ok(pcs.includes(pc), 'in the key')
        assert.deepEqual(chord, sevenths[cue.degree])
      }
    }
  }
})

test('the queue is a seeded shuffle of two slots per degree', () => {
  const queue = buildQueue(42)
  assert.equal(queue.length, 14)
  assert.deepEqual([...queue].sort((a, b) => a - b), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])
  assert.deepEqual(buildQueue(42), queue)
  assert.notDeepEqual(buildQueue(43), queue)
  assert.equal(hashSeed('42|house'), hashSeed('42|house'))
})

test('the safety cap ends an unwinnable run instead of hanging', () => {
  const { run, kinds } = play({ keyId: 'C', seed: 5, answer: () => false })
  assert.equal(run.cues.total, CAP_CUES)
  assert.equal(kinds.length, CAP_CUES)
  assert.equal(run.ended, true)
  assert.equal(run.complete, false)
  assert.equal(run.cleared, 0)
})

test('a mixed run still terminates at fourteen clears', () => {
  const { run, stations } = play({
    keyId: 'Bb',
    seed: 2024,
    answer: (_, __, index) => index % 4 !== 3,
  })
  assert.equal(run.cleared, GOAL)
  assert.equal(run.complete, true)
  assert.ok(stations.length > GOAL, 'misses cost extra stations')
  assert.ok(run.cues.total <= CAP_CUES)
  assert.ok(stations.filter((station) => !station.correct).length > 0)
})

test('timing and the note ramp are unchanged', () => {
  assert.equal(intervalFor(0), 1600)
  assert.equal(intervalFor(45000), 900)
  assert.equal(gradeTiming(0, 1600), 'perfect')
  assert.equal(gradeTiming(350, 1600), 'perfect')
  assert.equal(gradeTiming(351, 1600), 'good')
  assert.equal(gradeTiming(1150, 1600), 'good')
  assert.equal(gradeTiming(1151, 1600), 'late')
  assert.equal(gradeTiming(1601, 1600), 'miss')
  const run = createRun({ keyId: 'C', seed: 1 })
  assert.equal(runAccuracy(run), 0)
})

test('toArcadeRow is a body the server accepts', () => {
  const { run } = play({ keyId: 'Eb', seed: 8 })
  const endedAt = new Date()
  const meta = {
    id: 'house-test-0001',
    date: endedAt.toISOString().slice(0, 10),
    startedAt: new Date(endedAt.getTime() - 90_000).toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: 90_000,
  }
  const row = toArcadeRow(run, meta)
  assert.equal(row.kind, 'arcade')
  assert.equal(row.status, 'done')
  assert.equal(row.payload.version, 5)
  assert.equal(row.payload.mode, 'seventh-house')
  assert.equal(row.payload.cleared, GOAL)
  assert.equal(row.payload.complete, true)
  assert.equal(row.attempts, GOAL)
  assert.equal(row.misses, 0)
  assert.equal(row.stages.length, 0)

  const valid = validate(row)
  assert.equal(valid.kind, 'arcade')
  assert.equal(valid.moduleCount, 0)
  assert.equal(valid.passedStages, 0)
  assert.equal(valid.scope, 'session')
  assert.equal(valid.attempts, GOAL)
  assert.equal(valid.misses, 0)
  assert.equal(valid.durationMs, 90_000)
})

test('an abandoned row is abandoned and still valid', () => {
  const run = createRun({ keyId: 'C', seed: 2 })
  for (;;) {
    const cue = nextCue(run)
    if (!cue) break
    if (cue.kind === 'station') {
      resolveStation(run, cue.degree, false)
      break
    }
  }
  const endedAt = new Date()
  const row = toArcadeRow(run, {
    id: 'house-test-0002',
    date: endedAt.toISOString().slice(0, 10),
    startedAt: new Date(endedAt.getTime() - 20_000).toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: 20_000,
  })
  assert.equal(row.status, 'abandoned')
  assert.equal(row.payload.complete, false)
  assert.equal(validate(row).scope, 'session')
})
