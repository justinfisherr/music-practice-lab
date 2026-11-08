import { useEffect, useState } from 'react'
import { noteName } from '../data/diminishedChords.js'
import { degreeRootPc, seventhQuality } from '../session/set.js'

const SUFFIX = { maj7: 'maj7', min7: 'm7', dom7: '7', halfDim: 'ø7' }

export default function GrooveBar({ transport, keyId, disabled, onStop }) {
  const [tick, setTick] = useState(0)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (!transport) return
    const timer = setInterval(() => setTick((value) => value + 1), 100)
    return () => clearInterval(timer)
  }, [transport])

  if (!transport) return null
  void tick
  const position = transport.current()
  const degree = position.degree
  const chord = `${noteName(degreeRootPc(keyId, degree))}${SUFFIX[seventhQuality(degree)]}`

  return (
    <div className="groovebar" aria-label="Groove transport">
      <span className="groovebar__chord">{chord}</span>
      <span className="groovebar__pos">
        BAR {position.bar + 1}/4 · BEAT {position.beat + 1}
      </span>
      <div className="groovebar__btns">
        <button
          type="button"
          className="groovebar__btn"
          onClick={() => {
            const next = transport.toggleMute()
            setMuted(next)
          }}
        >
          {muted ? 'UNMUTE' : 'MUTE'}
        </button>
        <button type="button" className="groovebar__btn" onClick={onStop} disabled={disabled}>
          STOP
        </button>
      </div>
    </div>
  )
}
