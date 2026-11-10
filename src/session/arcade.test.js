import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BREAK_MS,
  GRACE_MS,
  PERFECT_MS,
  RUN_CUES,
  breakSweep,
  buildRun,
  gradeTiming,
  holdFor,
  intervalFor,
  multiplierFor,
  pointsFor,
  startBreak,
  windowFor,
} from './arcade.js'
import { diatonicSevenths, keyById } from '../data/scales.js'

const keyPcs = (keyId) => {
  const key = keyById(keyId)
  return [0, 2, 4, 5, 7, 9, 11].map((step) => (key.tonic + step) % 12)
}

const SEEDS = [1, 7, 99, 12345]
const KEYS = ['C', 'Gb', 'A', 'Eb']

test('same seed builds the same run, a new seed does not', () => {
  assert.deepEqual(buildRun({ keyId: 'C', seed: 42 }), buildRun({ keyId: 'C', seed: 42 }))
  assert.notDeepEqual(buildRun({ keyId: 'C', seed: 42 }), buildRun({ keyId: 'C', seed: 43 }))
})

test('a run is a fixed number of cues', () => {
  for (const seed of SEEDS) assert.equal(buildRun({ keyId: 'C', seed }).length, RUN_CUES)
})

test('bombs are always off-key, notes and chords are always in-key', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const pcs = keyPcs(keyId)
      for (const cue of buildRun({ keyId, seed })) {
        if (cue.kind === 'bomb') {
          assert.equal(cue.pcs.length, 1, 'a bomb lights one key')
          assert.ok(!pcs.includes(cue.pcs[0]), 'bomb must be off-scale')
        } else {
          for (const pc of cue.pcs) assert.ok(pcs.includes(pc), 'cue must be in-scale')
        }
        if (cue.kind === 'chord') {
          assert.equal(cue.pcs.length, 4, 'a chord cue is a seventh chord')
          assert.equal(new Set(cue.pcs).size, 4, 'chord keys are distinct')
        }
      }
    }
  }
})

test('every chord cue is a seventh chord of the key, with an honest inversion', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const pcs = keyPcs(keyId)
      const sevenths = diatonicSevenths(keyId)
      const cues = buildRun({ keyId, seed })
      const chords = cues.filter((cue) => cue.kind === 'chord')
      assert.ok(chords.length > 0, 'a run has at least one chord')
      assert.ok(chords.length <= 3, 'chords stay rare')

      for (const cue of chords) {
        const chord = sevenths.find(
          (candidate) =>
            candidate.pitchClasses.length === cue.pcs.length &&
            candidate.pitchClasses.every((pc) => cue.pcs.includes(pc)),
        )
        assert.ok(chord, `${cue.label} is not a diatonic seventh`)
        for (const pc of cue.pcs) assert.ok(pcs.includes(pc), 'chord note leaves the key')
        assert.equal(cue.numeral, chord.numeral)

        // The label names the bass, and the sweep starts on that same key.
        const spelled = cue.notesText.split(' ')
        assert.deepEqual(spelled, chord.notes)
        assert.equal(cue.label, `${chord.name}/${spelled[cue.inversion]}`)
        assert.equal(cue.sweep[0], cue.pcs[cue.inversion])
        assert.deepEqual([...cue.sweep].sort((a, b) => a - b), [...cue.pcs].sort((a, b) => a - b))
      }

      // Never two chords back to back.
      for (let i = 1; i < cues.length; i++) {
        assert.ok(!(cues[i].kind === 'chord' && cues[i - 1].kind === 'chord'))
      }
    }
  }
})

test('the first seven cues are plain notes, and bombs stay around one in five', () => {
  for (const seed of SEEDS) {
    const cues = buildRun({ keyId: 'C', seed })
    cues.slice(0, 7).forEach((cue) => assert.equal(cue.kind, 'note'))
    const bombs = cues.filter((cue) => cue.kind === 'bomb').length
    assert.ok(bombs >= 6 && bombs <= 18, `${bombs} bombs in ${cues.length} cues`)
  }
})

test('no key three cues running', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const first = buildRun({ keyId, seed }).map((cue) => cue.pcs[0])
      for (let i = 2; i < first.length; i++) {
        assert.ok(
          !(first[i] === first[i - 1] && first[i] === first[i - 2]),
          `key ${first[i]} lit three cues running`,
        )
      }
    }
  }
})

test('a lit window ends exactly where the next cue starts', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const cues = buildRun({ keyId, seed })
      for (let i = 1; i < cues.length; i++) {
        const before = windowFor(cues[i - 1])
        const after = windowFor(cues[i])
        assert.equal(before[1], after[0], `cue ${i} leaves a gap or overlaps`)
        assert.ok(before[1] > before[0], 'a window has length')
      }
    }
  }
})

test('a run is slow enough to read: 1600ms to 900ms, about a minute long', () => {
  for (const seed of SEEDS) {
    const cues = buildRun({ keyId: 'C', seed })
    const last = cues[cues.length - 1]
    assert.ok(last.t + last.hold > 30000, 'a run takes at least 30s')
    assert.ok(last.t + last.hold < 75000, 'a run stays under 75s')
    for (let i = 1; i < cues.length; i++) {
      assert.ok(cues[i].t - cues[i - 1].t >= 900, 'no cue lands closer than 900ms')
    }
  }
})

test('the cue interval ramps 1600 to 900 over 45s and the hold is the interval', () => {  assert.equal(intervalFor(0), 1600)
  assert.equal(intervalFor(15000), 1367)
  assert.equal(intervalFor(30000), 1133)
  assert.equal(intervalFor(45000), 900)
  assert.equal(intervalFor(60000), 900)
  assert.equal(holdFor(1600), 1600)
  assert.equal(holdFor(1600, 'chord'), 2000)
  assert.equal(holdFor(900), 900)
  assert.equal(holdFor(900, 'chord'), 1125)
  assert.equal(multiplierFor(0), 1)
  assert.equal(multiplierFor(12), 4)
})

test('350ms is PERFECT, the last 450ms of the light still counts, at half points', () => {
  const hold = 1600
  assert.equal(PERFECT_MS, 350)
  assert.equal(GRACE_MS, 450)
  assert.equal(gradeTiming(0, hold), 'perfect')
  assert.equal(gradeTiming(350, hold), 'perfect')
  assert.equal(gradeTiming(351, hold), 'good')
  assert.equal(gradeTiming(hold - GRACE_MS, hold), 'good')
  assert.equal(gradeTiming(hold - GRACE_MS + 1, hold), 'late')
  assert.equal(gradeTiming(hold, hold), 'late')
  assert.equal(gradeTiming(hold + 1, hold), 'miss')
  assert.equal(pointsFor('perfect'), 100)
  assert.equal(pointsFor('good'), 100)
  assert.equal(pointsFor('late'), 50)
  assert.equal(pointsFor('miss'), 0)
})

test('the chord break is 1320ms: 420ms of sweep plus 900ms held', () => {
  assert.equal(BREAK_MS, 1320)
})

test('the break sweeps one key at a time, 140ms apart, then holds', () => {
  assert.equal(breakSweep(0, 0), 1)
  assert.equal(breakSweep(0, 139), 1)
  assert.equal(breakSweep(0, 140), 2)
  assert.equal(breakSweep(0, 279), 2)
  assert.equal(breakSweep(0, 280), 3)
  assert.equal(breakSweep(0, 420), 4)
  assert.equal(breakSweep(0, BREAK_MS - 1), 4)
})

test('the break freezes the run: the chord and every later cue wait it out', () => {
  const cues = buildRun({ keyId: 'C', seed: 1 }).map((cue) => ({ ...cue }))
  let t = 5000
  for (const cue of cues) {
    cue.litAt = t
    cue.darkAt = t + cue.hold
    t += cue.hold
  }
  const index = cues.findIndex((cue) => cue.kind === 'chord')
  const chord = cues[index]
  const now = chord.litAt + 4
  const run = { cues, break: null }

  startBreak(run, chord, now)

  assert.equal(run.break.cue, chord)
  assert.equal(chord.litAt, now + BREAK_MS, 'the window opens after the break')
  assert.equal(chord.darkAt, now + BREAK_MS + chord.hold)
  assert.equal(cues[index + 1].litAt, chord.darkAt, 'the next cue still abuts it')
  for (let i = 0; i < index; i++) assert.ok(cues[i].darkAt < now, 'past cues stay put')
})

test('breaks leave the rest of the run joined up, with no holes and no overlaps', () => {
  for (const seed of SEEDS) {
    for (const keyId of KEYS) {
      const cues = buildRun({ keyId, seed }).map((cue) => ({ ...cue }))
      let t = 2000
      for (const cue of cues) {
        cue.litAt = t
        cue.darkAt = t + cue.hold
        t += cue.hold
      }
      const run = { cues, break: null }
      for (const cue of cues) if (cue.kind === 'chord') startBreak(run, cue, cue.litAt)

      for (let i = 1; i < cues.length; i++) {
        const gap = cues[i].litAt - cues[i - 1].darkAt
        assert.ok(gap >= 0, `cue ${i} overlaps the one before it`)
        assert.ok(gap === 0 || gap === BREAK_MS, `cue ${i} leaves a ${gap}ms hole`)
        if (gap > 0) assert.equal(cues[i].kind, 'chord', 'only a break holds a gap')
      }
    }
  }
})
