import { dim7Drill } from './dim7.js'

// Registry of MIDI drills. Add new challenge types here — the trainer UI builds
// its drill picker from this list automatically.
export const DRILLS = [dim7Drill]

export function getDrill(id) {
  return DRILLS.find((d) => d.id === id) ?? DRILLS[0]
}

// Session modes are orthogonal to drills: any drill can be played in any mode.
export const MODES = [
  { id: 'NORMAL', label: 'NORMAL', blurb: 'Endless. No timer, no lives.' },
  { id: 'LIGHTNING', label: 'LIGHTNING', blurb: '60 seconds. As many as you can.' },
  { id: 'SURVIVAL', label: 'SURVIVAL', blurb: '3 lives. One wrong = one gone.' },
]

export const LIGHTNING_SECONDS = 60
export const SURVIVAL_LIVES = 3
