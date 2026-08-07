import { noteName } from '../data/diminishedChords.js'

// Shared MIDI connection panel: connect button, status dot, input picker, and a
// live readout of held notes. Reads the shared MIDI context via props so any
// screen can drop it in.
export default function MidiConnection({ midi }) {
  if (!midi.supported) {
    return (
      <div className="panel panel--warn">
        <p className="panel__title">NO WEB MIDI</p>
        <p className="panel__body">
          Web MIDI is not supported in this browser. Use Chrome or Edge on desktop to connect a
          keyboard.
        </p>
      </div>
    )
  }

  const statusText = {
    idle: 'NOT CONNECTED',
    requesting: 'REQUESTING ACCESS…',
    ready: midi.connected ? 'CONNECTED' : 'READY (NO INPUT)',
    denied: 'ACCESS DENIED',
    unsupported: 'UNSUPPORTED',
  }[midi.status]

  return (
    <div className="panel">
      <div className="panel__row">
        <button
          type="button"
          className="btn"
          onClick={midi.connect}
          disabled={midi.status === 'requesting'}
        >
          CONNECT MIDI KEYBOARD
        </button>
        <span className={`dot ${midi.connected ? 'dot--on' : 'dot--off'}`} aria-hidden="true" />
        <span className="panel__status">{statusText}</span>
      </div>

      {midi.status === 'denied' && (
        <p className="panel__body">Permission was refused. Reload the page and allow MIDI access.</p>
      )}

      {midi.status === 'ready' && (
        <div className="panel__row">
          <label className="panel__label" htmlFor="midi-input">
            INPUT
          </label>
          <select
            id="midi-input"
            className="select"
            value={midi.selectedInputId || ''}
            onChange={(e) => midi.selectInput(e.target.value)}
          >
            {midi.inputs.length === 0 && <option value="">— none detected —</option>}
            {midi.inputs.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {midi.connected && (
        <div className="panel__row panel__row--live">
          <span className="panel__label">LIVE</span>
          <span className="livenotes">
            {midi.activeNotes.length === 0 ? '—' : midi.activeNotes.map((n) => noteName(n)).join(' ')}
          </span>
        </div>
      )}
    </div>
  )
}
