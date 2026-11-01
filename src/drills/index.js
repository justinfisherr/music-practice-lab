import { dim7Drill } from './dim7.js'
import { makeChordsDrill } from './diatonicChords.js'
import { makeFunctionDrill } from './functions.js'
import { MAJOR_KEYS } from '../data/scales.js'

// Registry of MIDI drills. Built-in drills: the original dim7 plus key-scoped
// diatonic-chord and function drills (keyed via factories at render time).
// Custom quizzes from localStorage are appended by the trainer. `dim7Drill`
// alone seeds DRILLS so it remains the safe default id.
export const DRILLS = [dim7Drill]

export { dim7Drill, makeChordsDrill, makeFunctionDrill, MAJOR_KEYS }

export function getDrill(id) {
  return DRILLS.find((d) => d.id === id) ?? DRILLS[0]
}

// Session modes are orthogonal to drills: any non-timed drill can be played in
// any mode. Timed drills (the function drill) ignore modes entirely.
export const MODES = [
  { id: 'NORMAL', label: 'NORMAL', blurb: 'Endless. No timer, no lives.' },
  { id: 'LIGHTNING', label: 'LIGHTNING', blurb: '60 seconds. As many as you can.' },
  { id: 'SURVIVAL', label: 'SURVIVAL', blurb: '3 lives. One wrong = one gone.' },
]

export const LIGHTNING_SECONDS = 60
export const SURVIVAL_LIVES = 3
