import { useEffect, useMemo, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { analyzeNotes } from '../data/chordDictionary.js'
import MidiConnection from './MidiConnection.jsx'

// FREE PLAY: play anything on the keyboard and it names what you're holding —
// notes, intervals, and chords (inversions/slash chords included).
export default function FreePlay() {
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

  return (
    <div className="freeplay">
      <MidiConnection midi={midi} />

      {midi.supported && (
        <div className="stage">
          {!midi.connected ? (
            <p className="stage__msg">CONNECT A MIDI KEYBOARD, THEN PLAY.</p>
          ) : (
            <FreePlayDisplay showing={showing} rawEmpty={analysis.kind === 'empty'} />
          )}
        </div>
      )}
    </div>
  )
}

function FreePlayDisplay({ showing, rawEmpty }) {
  if (!showing) {
    return <p className="stage__msg">PLAY SOMETHING…</p>
  }

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
    </div>
  )
}
