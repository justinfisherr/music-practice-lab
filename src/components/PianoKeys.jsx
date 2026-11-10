import { noteName } from '../data/diminishedChords.js'

// One octave of a real piano, pinned under the run. Lit keys are the whole
// input. DOM order is chromatic so tab and focus run left to right; blacks are
// out of flow and sit on the rule between their two whites.
const KEYS = [
  { pc: 0, type: 'white', label: 'C' },
  { pc: 1, type: 'black', after: 0, label: 'C sharp' },
  { pc: 2, type: 'white', label: 'D' },
  { pc: 3, type: 'black', after: 1, label: 'D sharp' },
  { pc: 4, type: 'white', label: 'E' },
  { pc: 5, type: 'white', label: 'F' },
  { pc: 6, type: 'black', after: 3, label: 'F sharp' },
  { pc: 7, type: 'white', label: 'G' },
  { pc: 8, type: 'black', after: 4, label: 'G sharp' },
  { pc: 9, type: 'white', label: 'A' },
  { pc: 10, type: 'black', after: 5, label: 'A sharp' },
  { pc: 11, type: 'white', label: 'B' },
]

export default function PianoKeys({ lit = {}, onKey, disabled = false, dim = false }) {
  return (
    <div className={`piano${dim ? ' is-dim' : ''}`} role="group" aria-label="Piano, one octave">
      {KEYS.map((key) => {
        const state = lit[key.pc]
        const white = key.type === 'white'
        const cls = `${white ? 'piano__white' : 'piano__black'}${state ? ` is-${state}` : ''}`
        return (
          <button
            key={key.pc}
            type="button"
            className={cls}
            style={white ? undefined : { '--after': key.after }}
            onClick={() => onKey(key.pc)}
            disabled={disabled}
            aria-label={white ? undefined : key.label}
          >
            <span className="piano__name">{white ? key.label : noteName(key.pc)}</span>
          </button>
        )
      })}
    </div>
  )
}
