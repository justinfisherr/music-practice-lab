import { playChord } from '../session/audio.js'

// The tune's bar grid: one button per chord, in playing order. A cell sounds the
// chord it already carries — the key reading happened in buildTuneView, so there
// is no theory here. Outside cells say OUT in words, never in colour alone.
export default function TuneGrid({ cells = [], skeleton = 0 }) {
  if (skeleton) {
    return (
      <div className="tunegrid" aria-hidden="true">
        {Array.from({ length: skeleton }, (_, index) => (
          <span className="tunegrid__cell is-skeleton" key={index} />
        ))}
      </div>
    )
  }

  return (
    <div className="tunegrid" role="group" aria-label="Tune changes">
      {cells.map((cell) => (
        <button
          key={cell.id}
          type="button"
          className={`tunegrid__cell${cell.outside ? ' is-out' : ''}`}
          aria-label={`${cell.name}${cell.numeral ? `, ${cell.numeral}` : ''}${
            cell.outside ? ', outside the key' : ''
          }`}
          onClick={() => playChord(cell.pcs)}
        >
          <span className="tunegrid__numeral">{cell.outside ? 'OUT' : cell.numeral}</span>
          <span className="tunegrid__name">{cell.name}</span>
        </button>
      ))}
    </div>
  )
}
