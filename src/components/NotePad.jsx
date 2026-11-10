import { useEffect, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { NOTE_NAMES, noteName } from '../data/diminishedChords.js'
import { isMuted, playPhrase } from '../session/audio.js'

// Visible text is noteName's spelling; the label spells the accidental out.
const ARIA = ['C', 'C sharp', 'D', 'E flat', 'E', 'F', 'G flat', 'G', 'A flat', 'A', 'B flat', 'B']
const IDLE = 'TAP NOTES · ONE AT A TIME'

// One octave of pitch classes, tapped one at a time. A tap is injected into the
// MIDI context, so every drill grades it exactly like the hardware.
export default function NotePad({ keyId, disabled, hint }) {
  const midi = useMidiContext()
  const [held, setHeld] = useState(null)
  const [entered, setEntered] = useState([])
  const heldRef = useRef(null)
  const timerRef = useRef(null)

  // A new key starts a new entry strip.
  useEffect(() => {
    setEntered([])
  }, [keyId])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function tap(pc) {
    if (disabled) return
    heldRef.current = pc
    setHeld(pc)
    setEntered((prev) => [...prev, pc])
    // Matches the graders' silence window, so the strip clears with the grade.
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setEntered([]), 1500)
    if (!isMuted()) playPhrase([pc], { gap: 0 })
    navigator.vibrate?.(8)
    midi.press(60 + pc)
  }

  function release() {
    if (heldRef.current == null) return
    midi.release(60 + heldRef.current)
    heldRef.current = null
    setHeld(null)
  }

  const shown = entered.slice(-4)
  const extra = entered.length - shown.length
  const strip = entered.length
    ? `IN · ${shown.map(noteName).join(' ')}${extra > 0 ? ` +${extra}` : ''}`
    : IDLE

  return (
    <div className="notepad" role="group" aria-label="Note pad, one octave">
      <div className="notepad__head">
        <span className="notepad__label">TOUCH PAD</span>
        <span className="notepad__strip" aria-live="polite">
          {strip}
        </span>
      </div>
      <div className="notepad__grid">
        {NOTE_NAMES.map((name, pc) => (
          <button
            key={name}
            type="button"
            className={`notepad__key${held === pc ? ' is-held' : ''}${
              hint && hint.pcs.includes(pc) ? (hint.bar ? ' is-hint-bar' : ' is-hint') : ''
            }`}
            aria-label={ARIA[pc]}
            aria-disabled={disabled || undefined}
            onPointerDown={(event) => {
              event.preventDefault()
              tap(pc)
            }}
            onClick={(event) => {
              // Enter / Space fire a click with no pointer detail. A tap already
              // fired on pointerdown, so detail > 0 is a duplicate.
              if (event.detail !== 0) return
              tap(pc)
              release()
            }}
            onPointerUp={release}
            onPointerCancel={release}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
