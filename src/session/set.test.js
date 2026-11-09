import test from 'node:test'
import assert from 'node:assert/strict'
import { diatonicPcs } from './phrases.js'
import {
  allDegreesFilled,
  BLUES_DEGREES,
  bluesChord,
  boogiePcs,
  buildJamDegrees,
  bumpConfidence,
  chordTonePc,
  emptyConfidence,
  fifthPc,
  fiveNoteRangePcs,
  JAM_DEGREES,
  phrasePcs,
  pickRapidDegree,
  PLAY_CHANGES,
  rapidChordStep,
  rapidPrompts,
  scoreChord,
  RAPID_COUNT,
  INVERSION_BONUS,
  CHORD_MISS_POINTS,
  rootFirstPhrase,
  scoreComp,
  scoreJamNote,
  scoreLandTheThird,
  scoreSolo,
  seventhByDegree,
  thirdPc,
  TURNAROUND_DEGREES,
} from './set.js'
import { composeSet } from './compose.js'
import { deriveXp } from '../../lib/xp.js'

test('seventh chords by degree follow the major-key qualities', () => {
  assert.deepEqual(seventhByDegree('C', 1), [0, 4, 7, 11])
  assert.deepEqual(seventhByDegree('C', 2), [0, 2, 5, 9])
  assert.deepEqual(seventhByDegree('C', 4), [0, 4, 5, 9])
  assert.deepEqual(seventhByDegree('C', 5), [2, 5, 7, 11])
  assert.deepEqual(seventhByDegree('C', 7), [2, 5, 9, 11])
  assert.deepEqual(seventhByDegree('D', 1), [2, 6, 9, 1].sort((a, b) => a - b))
})

test('the third of each seventh chord uses the chord quality', () => {
  assert.equal(thirdPc('C', 1), 4)
  assert.equal(thirdPc('C', 2), 5)
  assert.equal(thirdPc('C', 5), 11)
  assert.equal(thirdPc('C', 7), 2)
})

test('chord tones follow the requested 3rd, 5th, or 7th', () => {
  assert.equal(chordTonePc('C', 1, 3), 4)
  assert.equal(chordTonePc('C', 1, 5), 7)
  assert.equal(chordTonePc('C', 1, 7), 11)
  assert.equal(chordTonePc('C', 2, 3), 5)
  assert.equal(chordTonePc('C', 2, 7), 0)
  assert.equal(chordTonePc('C', 5, 3), 11)
  assert.equal(fifthPc('C'), 7)
  assert.deepEqual(fiveNoteRangePcs('C'), [4, 5, 7, 9, 11])
})

test('blues I/IV/V are dominant sevenths, labelled with a plain 7', () => {
  assert.deepEqual(bluesChord('C', 1), { pcs: [0, 4, 7, 10], label: 'C7' })
  assert.deepEqual(bluesChord('C', 4), { pcs: [5, 9, 0, 3], label: 'F7' })
  assert.deepEqual(bluesChord('C', 5), { pcs: [7, 11, 2, 5], label: 'G7' })
  assert.deepEqual(BLUES_DEGREES, [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5])
})

test('the boogie figure is root 3 5 6 b7 6 5 3 in order', () => {
  assert.deepEqual(boogiePcs('C', 1), [0, 4, 7, 9, 10, 9, 7, 4])
  assert.deepEqual(boogiePcs('C', 4), [5, 9, 0, 2, 3, 2, 0, 9])
  assert.equal(boogiePcs('C', 1).length, 8)
  assert.equal(boogiePcs('C', 1)[3], boogiePcs('C', 1)[5])
  assert.equal(boogiePcs('C', 1)[1], boogiePcs('C', 1)[7])
})

test('rapid prompts are forty deterministic degrees with no back-to-back repeat', () => {
  const prompts = rapidPrompts(7, 'C', 40)
  assert.equal(prompts.length, 40)
  assert.deepEqual(prompts, rapidPrompts(7, 'C', 40))
  assert.ok(prompts.every((degree) => degree >= 1 && degree <= 7))
  assert.ok(prompts.every((degree, index) => index === 0 || degree !== prompts[index - 1]))
})

test('a clean chord pays the base and a slip costs points', () => {
  const clean = scoreChord({ clean: true, combo: 0 })
  const sloppy = scoreChord({ clean: false, combo: 4 })
  assert.equal(clean.points, 100)
  assert.equal(clean.combo, 1)
  assert.equal(sloppy.points, CHORD_MISS_POINTS)
  assert.equal(sloppy.combo, 0)
  const inverted = scoreChord({ clean: true, combo: 0, inversion: true })
  assert.equal(inverted.points, clean.points + INVERSION_BONUS)
  assert.ok(scoreChord({ clean: true, combo: 6 }).points > clean.points)
})

test('confidence fills and empties by a quarter, and only full means filled', () => {
  let confidence = emptyConfidence()
  assert.equal(allDegreesFilled(confidence), false)
  for (let hit = 0; hit < 4; hit++) confidence = bumpConfidence(confidence, 3, true)
  assert.equal(confidence[2], 1)
  assert.equal(allDegreesFilled(confidence), false)
  confidence = bumpConfidence(confidence, 3, false)
  assert.equal(confidence[2], 0.75)
  for (let degree = 1; degree <= 7; degree++) {
    for (let hit = 0; hit < 4; hit++) confidence = bumpConfidence(confidence, degree, true)
  }
  assert.equal(allDegreesFilled(confidence), true)
})

test('the next chord is drawn toward the least confident degree', () => {
  let seed = 1234567
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const confidence = emptyConfidence().map((_, index) => (index === 6 ? 0 : 1))
  const counts = Array(7).fill(0)
  for (let draw = 0; draw < 700; draw++) counts[pickRapidDegree(rng, confidence) - 1] += 1
  // The unfilled degree dominates, but the filled ones still come up.
  assert.ok(counts[6] > 300)
  assert.ok(counts.slice(0, 6).every((count) => count > 10))
  // Once every degree is full the draw is flat across all seven.
  const flat = Array(7).fill(0)
  for (let draw = 0; draw < 700; draw++) flat[pickRapidDegree(rng, Array(7).fill(1)) - 1] += 1
  assert.ok(flat.every((count) => count > 60))
})

test('rapid chord: tones accumulate, the last one solves, and solving does not advance', () => {
  const target = seventhByDegree('C', 1)
  let step = rapidChordStep({ target, played: [], pc: 0 })
  assert.deepEqual([step.kind, step.solved, step.played], ['next', false, [0]])
  step = rapidChordStep({ target, played: step.played, pc: 4 })
  assert.deepEqual([step.kind, step.played], ['next', [0, 4]])
  step = rapidChordStep({ target, played: step.played, pc: 7 })
  assert.deepEqual([step.kind, step.solved], ['next', false])
  step = rapidChordStep({ target, played: step.played, pc: 11 })
  assert.deepEqual([step.kind, step.solved, step.played], ['next', true, [0, 4, 7, 11]])
  // A repeat of a tone already held leaves `played` alone.
  const repeat = rapidChordStep({ target, played: [0, 4], pc: 4 })
  assert.equal(repeat.kind, 'next')
  assert.deepEqual(repeat.played, [0, 4])
})

test('rapid chord: a solved prompt ignores every note and only the bar advances it', () => {
  const target = seventhByDegree('C', 1)
  const solved = [0, 4, 7, 11]
  assert.equal(rapidChordStep({ target, played: solved, pc: 4 }).kind, 'ignore')
  assert.equal(rapidChordStep({ target, played: solved, pc: 2 }).kind, 'ignore')
  assert.equal(rapidChordStep({ target, played: solved, pc: null }).kind, 'advance')
  // Unsolved: a stray note is a miss, and so is an empty bar.
  assert.equal(rapidChordStep({ target, played: [0, 4], pc: 2 }).kind, 'miss')
  assert.equal(rapidChordStep({ target, played: [], pc: null }).kind, 'miss')
})

test('a no-penalty miss scores nothing and still breaks the combo', () => {
  assert.deepEqual(scoreChord({ clean: false, combo: 5, penalty: false }), { points: 0, combo: 0 })
  assert.equal(scoreChord({ clean: false, combo: 5, penalty: true }).points, CHORD_MISS_POINTS)
})

test('the turnaround is I–vi–ii–V', () => {
  assert.deepEqual(TURNAROUND_DEGREES, [1, 6, 2, 5])
})

const bars = [
  { startMs: 0, targetPc: 4 },
  { startMs: 2000, targetPc: 9 },
  { startMs: 4000, targetPc: 11 },
  { startMs: 6000, targetPc: 2 },
]

test('land the 3rd: four clean downbeats pass with full timing', () => {
  const result = scoreLandTheThird(bars, [
    { pc: 4, at: 0 },
    { pc: 9, at: 2000 },
    { pc: 11, at: 4000 },
    { pc: 2, at: 6000 },
  ])
  assert.equal(result.hits, 4)
  assert.equal(result.combo, 4)
  assert.equal(result.passed, true)
  assert.ok(result.rows.every((row) => row.timingBonus === 100))
})

test('land the 3rd: no notes misses every bar', () => {
  const result = scoreLandTheThird(bars, [])
  assert.equal(result.hits, 0)
  assert.equal(result.passed, false)
})

test('land the 3rd: a wrong note resets the run', () => {
  const result = scoreLandTheThird(bars, [
    { pc: 4, at: 0 },
    { pc: 5, at: 2000 },
    { pc: 11, at: 4000 },
  ])
  assert.equal(result.hits, 2)
  assert.equal(result.combo, 1)
  assert.equal(result.rows[1].hit, false)
})

test('land the 3rd: late notes and held notes do not count', () => {
  const late = scoreLandTheThird(bars, [
    { pc: 4, at: 190 },
    { pc: 9, at: 2000 },
  ])
  assert.equal(late.rows[0].hit, false)
  assert.equal(late.hits, 1)
  const held = scoreLandTheThird(bars, [{ pc: 4, at: 0 }, { pc: 4, at: 2100 }])
  assert.equal(held.rows[1].hit, false)
  assert.equal(held.hits, 1)
})

test('land the 3rd: extra notes after the first note do not hurt', () => {
  const result = scoreLandTheThird(bars, [
    { pc: 4, at: 0 },
    { pc: 0, at: 100 },
    { pc: 9, at: 2000 },
    { pc: 5, at: 2050 },
    { pc: 11, at: 4000 },
    { pc: 2, at: 6000 },
  ])
  assert.equal(result.hits, 4)
  assert.equal(result.passed, true)
})

test('land the 3rd: the window is plus or minus 180ms', () => {
  const edge = scoreLandTheThird(bars, [{ pc: 4, at: 180 }])
  assert.equal(edge.rows[0].hit, true)
  assert.equal(edge.rows[0].timingBonus, 0)
  const outside = scoreLandTheThird(bars, [{ pc: 4, at: 181 }])
  assert.equal(outside.rows[0].hit, false)
})

test('comp: a clean four-chord bar run passes', () => {
  const compBars = [
    { startMs: 0, barMs: 2000, targetPcs: [0, 4, 7, 11] },
    { startMs: 2000, barMs: 2000, targetPcs: [0, 3, 7, 10] },
    { startMs: 4000, barMs: 2000, targetPcs: [0, 2, 5, 9] },
    { startMs: 6000, barMs: 2000, targetPcs: [0, 4, 7, 10] },
  ]
  const clean = scoreComp(compBars, [
    { pc: 0, at: 0 },
    { pc: 4, at: 100 },
    { pc: 7, at: 200 },
    { pc: 11, at: 300 },
    { pc: 0, at: 2100 },
    { pc: 3, at: 2200 },
    { pc: 7, at: 2300 },
    { pc: 10, at: 2400 },
    { pc: 0, at: 4100 },
    { pc: 2, at: 4200 },
    { pc: 5, at: 4300 },
    { pc: 9, at: 4400 },
    { pc: 0, at: 6100 },
    { pc: 4, at: 6200 },
    { pc: 7, at: 6300 },
    { pc: 10, at: 6400 },
  ])
  assert.equal(clean.hits, 4)
  assert.equal(clean.passed, true)
  const partial = scoreComp(compBars, [{ pc: 0, at: 0 }, { pc: 4, at: 100 }])
  assert.equal(partial.hits, 0)
  assert.equal(partial.passed, false)
})

test('solo rules pass only with four notes and no violations', () => {
  const noRoots = { roots: [0, 9, 2, 7] }
  assert.equal(scoreSolo('noRoots', [{ pc: 4 }, { pc: 5 }, { pc: 11 }, { pc: 1 }], noRoots).passed, true)
  assert.equal(scoreSolo('noRoots', [{ pc: 4 }, { pc: 5 }, { pc: 0 }, { pc: 1 }], noRoots).passed, false)
  assert.equal(scoreSolo('noRoots', [{ pc: 4 }, { pc: 5 }, { pc: 11 }], noRoots).passed, false)

  const range = { range: [4, 5, 7, 9, 11] }
  assert.equal(scoreSolo('range', [{ pc: 4 }, { pc: 5 }, { pc: 7 }, { pc: 9 }], range).passed, true)
  assert.equal(scoreSolo('range', [{ pc: 4 }, { pc: 5 }, { pc: 7 }, { pc: 0 }], range).passed, false)

  const oneNote = { targetPc: 7 }
  assert.equal(scoreSolo('oneNote', [{ pc: 7 }, { pc: 7 }, { pc: 7 }, { pc: 7 }], oneNote).passed, true)
  assert.equal(scoreSolo('oneNote', [{ pc: 7 }, { pc: 7 }, { pc: 7 }, { pc: 4 }], oneNote).passed, false)
})

test('phrasePcs maps degrees into the key and keeps the root first', () => {
  assert.deepEqual(phrasePcs('C', [1, 3, 5, 6]), [0, 4, 7, 9])
  assert.deepEqual(phrasePcs('D', [1, 3, 5, 6])[0], 2)
})

test('composeSet composes exactly a Scale Lab warm-up and a 30-second changes round', () => {
  const set = composeSet({ date: '2026-11-02', keyId: 'C', seed: 7 })
  assert.equal(set.version, 4)
  assert.equal(set.variant, 'set')
  assert.deepEqual(
    set.stages.map((stage) => stage.id),
    ['warmup', 'jam'],
  )
  assert.equal(set.stages.length, 2)
  const jam = set.stages.find((stage) => stage.id === 'jam')
  assert.equal(jam.detail.kind, 'jam')
  assert.equal(jam.detail.title, 'CHANGES')
  assert.equal(jam.detail.changesId, 'turnaround')
  assert.equal(jam.detail.barsPerChord, 1)
  assert.equal(jam.detail.bpm, 84)
  assert.equal(jam.detail.roundSeconds, 30)
  assert.deepEqual(set.stages[0].detail.scale.pcs, [...diatonicPcs('C'), 0])
  assert.equal(set.stages[0].detail.rapid.prompts.length, RAPID_COUNT)
  assert.deepEqual(set.stages[0].detail.rapid.prompts, rapidPrompts(7, 'C', RAPID_COUNT))
  assert.equal(set.stages[0].detail.progression, undefined)
})

test('composeSet ignores supplied cards instead of adding card stages', () => {
  const set = composeSet({
    date: '2026-11-02',
    keyId: 'C',
    seed: 7,
    cards: [{ concept: 'LAND_THE_3RD', params: { degrees: [1, 6, 2, 5] } }],
  })
  assert.deepEqual(
    set.stages.map((stage) => stage.id),
    ['warmup', 'jam'],
  )
  assert.equal(set.cards, undefined)
})

test('the new set pays 50 XP first try: warm-up 15 + changes 20 + complete 15', () => {
  const stages = [
    { id: 'warmup', tier: 2, attempts: 1, passed: true },
    { id: 'jam', tier: 3, attempts: 1, passed: true },
  ]
  assert.equal(deriveXp(stages, 'done'), 50)
  assert.equal(deriveXp(stages, 'done', 'graded', 'lesson'), 35)
  const retry = stages.map((stage) => ({ ...stage, attempts: 2 }))
  assert.equal(deriveXp(retry, 'done'), 40)
})

test('legacy card sets still pay the old awards so old runs read the same', () => {
  const stages = [
    { id: 'warmup', tier: 2, attempts: 1, passed: true },
    { id: 'land_the_3rd', tier: 3, attempts: 1, passed: true },
    { id: 'comp_changes', tier: 3, attempts: 1, passed: true },
    { id: 'jam', tier: 3, attempts: 1, passed: true },
  ]
  assert.equal(deriveXp(stages, 'done'), 90)
})

test('PLAY_CHANGES exposes the playable progressions', () => {
  assert.deepEqual(
    PLAY_CHANGES.map((entry) => entry.id),
    [
      'i-iv-v',
      'i-v-vi-iv',
      'i-vi-iv-v',
      'i-v-vi-iii-iv',
      'ii-v-i',
      'iii-vi-ii-v-i',
      'vii-iii-vi',
      'blues-12',
      'turnaround',
    ],
  )
})

test('buildJamDegrees repeats each chord 1, 2, or 4 bars', () => {
  assert.deepEqual(buildJamDegrees('turnaround', 1), [1, 6, 2, 5])
  assert.deepEqual(buildJamDegrees('turnaround', 2), [1, 1, 6, 6, 2, 2, 5, 5])
  assert.deepEqual(buildJamDegrees('turnaround', 4), [
    1, 1, 1, 1, 6, 6, 6, 6, 2, 2, 2, 2, 5, 5, 5, 5,
  ])
  assert.equal(buildJamDegrees('i-v-vi-iv', 4).length, 16)
})

test('buildJamDegrees handles the 12-bar blues and unknown ids', () => {
  const blues = buildJamDegrees('blues-12', 1)
  assert.equal(blues.length, 12)
  assert.deepEqual(blues, [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5])
  assert.deepEqual(buildJamDegrees('nope', 1), [1, 6, 2, 5])
})

test('the jam progression is a 16-bar A-B-A-B turnaround', () => {
  assert.equal(JAM_DEGREES.length, 16)
  assert.deepEqual(JAM_DEGREES.slice(0, 4), [1, 6, 2, 5])
  assert.deepEqual(JAM_DEGREES.slice(4, 8), [2, 5, 1, 6])
  assert.deepEqual(JAM_DEGREES.slice(8, 12), [1, 6, 2, 5])
  assert.deepEqual(JAM_DEGREES.slice(12, 16), [2, 5, 1, 6])
})

test('jam notes score in key, chord tones, and strong-beat chord tones', () => {
  const keyPcs = [0, 2, 4, 5, 7, 9, 11]
  const chordPcs = [0, 4, 7, 11]
  const out = scoreJamNote({ pc: 1, chordPcs, keyPcs, beatInBar: 0, combo: 5 })
  assert.deepEqual(out, { inKey: false, chordTone: false, strong: false, points: 0, combo: 0 })
  const inKey = scoreJamNote({ pc: 2, chordPcs, keyPcs, beatInBar: 1, combo: 0 })
  assert.equal(inKey.points, 1)
  assert.equal(inKey.combo, 1)
  assert.equal(inKey.inKey, true)
  const tone = scoreJamNote({ pc: 4, chordPcs, keyPcs, beatInBar: 1, combo: 0 })
  assert.equal(tone.chordTone, true)
  assert.equal(tone.strong, false)
  assert.equal(tone.points, 3)
  const strong = scoreJamNote({ pc: 4, chordPcs, keyPcs, beatInBar: 0, combo: 0 })
  assert.equal(strong.strong, true)
  assert.equal(strong.points, 5)
  const offbeat = scoreJamNote({ pc: 4, chordPcs, keyPcs, beatInBar: 1, combo: 0 })
  assert.equal(offbeat.strong, false)
})

test('jam notes pay the combo multiplier and cap it at ten', () => {
  const args = { pc: 2, chordPcs: [0, 4, 7, 11], keyPcs: [0, 2, 4, 5, 7, 9, 11], beatInBar: 1 }
  assert.equal(scoreJamNote({ ...args, combo: 10 }).points, 2)
  assert.equal(scoreJamNote({ ...args, combo: 40 }).points, 2)
  assert.equal(
    scoreJamNote({ ...args, pc: 4, beatInBar: 0, combo: 5 }).points,
    8,
  )
  assert.equal(scoreJamNote({ ...args, combo: 0 }).combo, 1)
  assert.equal(scoreJamNote({ ...args, combo: 10 }).combo, 11)
})

test('v4 warm-up ear phrase always starts on the root and is deterministic', () => {
  const phrase = rootFirstPhrase(1166647244, 'Bb')
  assert.equal(phrase.length, 4)
  assert.equal(phrase[0], 10) // Bb tonic
  assert.deepEqual(rootFirstPhrase(1166647244, 'Bb'), phrase)
  assert.notDeepEqual(rootFirstPhrase(1166647244, 'C'), phrase)
})
