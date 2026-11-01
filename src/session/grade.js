import { pitchClassesEqual } from '../data/diminishedChords.js'

// Index-by-index grading for melodic phrases. Extra notes are counted, not
// silently ignored: six right notes plus a seventh wrong note is not a pass.
export function gradeSequence(targetPcs, playedPcs) {
  const rows = targetPcs.map((targetPc, index) => {
    const playedPc = index < playedPcs.length ? playedPcs[index] : null
    return {
      index,
      targetPc,
      playedPc,
      status: playedPc == null ? 'missing' : playedPc === targetPc ? 'match' : 'off',
    }
  })
  const extraCount = Math.max(0, playedPcs.length - targetPcs.length)
  const passed = extraCount === 0 && rows.every((row) => row.status === 'match')
  return { rows, extraCount, passed }
}

// Chord / pitch-class-set grading. Order and octave do not matter.
export function gradeSet(targetPcs, playedPcs) {
  const rows = targetPcs.map((targetPc, index) => ({
    index,
    targetPc,
    playedPc: playedPcs[index] ?? null,
    status: playedPcs.includes(targetPc) ? 'match' : playedPcs[index] == null ? 'missing' : 'off',
  }))
  const extraCount = Math.max(0, playedPcs.length - targetPcs.length)
  return { rows, extraCount, passed: pitchClassesEqual(targetPcs, playedPcs) }
}
