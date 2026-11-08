import { useEffect, useMemo, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { analyzeNotes } from '../data/chordDictionary.js'
import { analyzeFunction } from '../data/chordFunction.js'
import { MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import MidiConnection from './MidiConnection.jsx'
import FreePlayCircle from './FreePlayCircle.jsx'
import PianoExample from './PianoExample.jsx'
import JamPanel from './JamPanel.jsx'

// FREE PLAY: play anything on the keyboard and it names what you're holding —
// notes, intervals, and chords (inversions/slash chords included) — in a key
// you choose, with its function and a circle of fifths.
export default function FreePlay({ session, onStartManual }) {
  const midi = useMidiContext()
  const held = midi.activeNotes

  const analysis = useMemo(() => analyzeNotes(held), [held])

  // Keep the last recognized chord/interval on screen after you lift your hands.
  const [last, setLast] = useState(null)
  useEffect(() => {
    if (analysis.kind === 'chord' || analysis.kind === 'interval' || analysis.kind === 'note') {
      setLast(analysis)
    }
  }, [analysis])

  const showing = analysis.kind === 'empty' ? last : analysis

  const [keyId, setKeyId] = useState('C')
  const [showCircle, setShowCircle] = useState(false)

  const fn = useMemo(
    () => (showing?.kind === 'chord' ? analyzeFunction(showing, keyId) : null),
    [showing, keyId],
  )

  return (
    <div className="freeplay">
      <MidiConnection midi={midi} />

      {session?.status !== 'active' ? (
        <div className="freeplay__session">
          <div>
            <span className="freeplay__session-label">FREE PLAY SESSION</span>
            <p className="freeplay__session-copy">
              Start the clock and log these minutes to the vault. Play whatever you want.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--signal"
            onClick={() => onStartManual?.('FREE PLAY')}
            disabled={!onStartManual}
          >
            START &amp; LOG MINUTES
          </button>
        </div>
      ) : null}

      <JamPanel keyId={keyId} />

      <div className="freeplay__controls">
        <label className="freeplay__keypick">
          <span>KEY</span>
          <select className="select" value={keyId} onChange={(e) => setKeyId(e.target.value)}>
            {MAJOR_KEYS.map((key) => (
              <option key={key.id} value={key.id}>
                {keyDisplay(key.id)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`btn btn--ghost${showCircle ? ' is-active' : ''}`}
          aria-pressed={showCircle}
          onClick={() => setShowCircle((on) => !on)}
        >
          CIRCLE OF FIFTHS
        </button>
      </div>

      <div className={`freeplay__analysis${showCircle ? ' freeplay__analysis--circle' : ''}`}>
        {showCircle && (
          <FreePlayCircle
            keyId={keyId}
            chord={showing?.kind === 'chord' ? showing : null}
            fn={fn}
          />
        )}

        <div className="stage">
          {midi.supported && !midi.connected ? (
            <p className="stage__msg">CONNECT A MIDI KEYBOARD, THEN PLAY.</p>
          ) : (
            <FreePlayDisplay
              showing={showing}
              rawEmpty={analysis.kind === 'empty'}
              keyId={keyId}
              fn={fn}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FreePlayDisplay({ showing, rawEmpty, keyId, fn }) {
  if (!showing) {
    return <p className="stage__msg">PLAY SOMETHING…</p>
  }

  const showPiano =
    showing.kind === 'chord' || showing.kind === 'interval' || showing.kind === 'note'

  return (
    <div className={`readout${rawEmpty ? ' readout--held' : ''}`}>
      <span className="readout__kind">
        {showing.kind === 'chord'
          ? 'CHORD'
          : showing.kind === 'interval'
            ? 'INTERVAL'
            : showing.kind === 'note'
              ? 'NOTE'
              : 'NOTES'}
        {rawEmpty ? ' · LAST' : ''}
      </span>

      <span className="readout__name">
        {showing.kind === 'unknown' ? showing.notes.join(' · ') : showing.name}
      </span>

      {showing.kind === 'interval' && <span className="readout__detail">{showing.detail}</span>}

      {showing.kind === 'chord' && showing.notes && (
        <div className="readout__chips">
          {showing.notes.map((n) => (
            <span className="notechip" key={n}>
              {n}
            </span>
          ))}
        </div>
      )}

      {showing.kind === 'chord' && showing.equivalents.length > 0 && (
        <span className="readout__detail">= {showing.equivalents.join('  ·  ')}</span>
      )}

      {fn && (
        <div className="fnblock">
          <div className="fnblock__head">
            <span className="fnblock__label">{fn.label}</span>
            <span className={`fnblock__state ${fn.inKey ? 'is-in' : 'is-out'}`}>
              {fn.inKey ? 'IN KEY' : 'OUTSIDE THE KEY'}
            </span>
          </div>
          {fn.target && <span className="fnblock__target">LEADS TO {fn.target}</span>}
          <p className="fnblock__detail">{fn.detail}</p>
          <span className="fnblock__key">IN {keyDisplay(keyId)} MAJOR</span>
          {fn.foundation ? (
            <a className="fnblock__link" href={`#lessons?foundation=${fn.foundation}`}>
              WHAT IS THIS? →
            </a>
          ) : null}
        </div>
      )}

      {showPiano && (
        <PianoExample
          pcs={showing.pcs}
          accentPc={showing.root ?? null}
          label={`Keyboard showing ${showing.name}`}
        />
      )}
    </div>
  )
}
