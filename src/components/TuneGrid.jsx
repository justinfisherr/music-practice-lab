import { useEffect, useRef, useState } from 'react'
import { playChord } from '../session/audio.js'

// Matches --t-stamp: long enough to see, short enough to fire on a fast run.
const FLIP_MS = 90

function noFlip() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// The tune's bar grid: one button per chord, in playing order. A cell sounds the
// chord it already carries — the key reading happened in buildTuneView, so there
// is no theory here. Outside cells say OUT in words, never in colour alone, and
// with no key at all there is no OUT and no numeral: a numeral would be a claim
// about a key we don't have.
export default function TuneGrid({ cells = [], skeleton = 0, keyed = true }) {
  const [sounding, setSounding] = useState(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  if (skeleton) {
    return (
      <div className="tunegrid" aria-hidden="true">
        {Array.from({ length: skeleton }, (_, index) => (
          <span className="tunegrid__cell is-skeleton" key={index} />
        ))}
      </div>
    )
  }

  function sound(cell) {
    playChord(cell.pcs)
    if (noFlip()) return
    clearTimeout(timer.current)
    setSounding(cell.id)
    timer.current = setTimeout(() => setSounding(null), FLIP_MS)
  }

  return (
    <div className="tunegrid" role="group" aria-label="Tune changes">
      {cells.map((cell) => {
        const outside = keyed && cell.outside
        const numeral = keyed ? (cell.outside ? 'OUT' : cell.numeral) : ''
        const label = `${cell.name}${keyed && cell.numeral ? `, ${cell.numeral}` : ''}${
          outside ? ', outside the key' : ''
        }`
        return (
          <button
            key={cell.id}
            type="button"
            className={`tunegrid__cell${outside ? ' is-out' : ''}${
              sounding === cell.id ? ' is-sounding' : ''
            }`}
            aria-label={label}
            onClick={() => sound(cell)}
          >
            {numeral ? <span className="tunegrid__numeral">{numeral}</span> : null}
            <span className="tunegrid__name">{cell.name}</span>
          </button>
        )
      })}
    </div>
  )
}
