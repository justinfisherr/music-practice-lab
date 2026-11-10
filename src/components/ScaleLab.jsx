import { useMemo, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { gradeSequence, gradeSet } from '../session/grade.js'
import { playPhrase, unlockAudio } from '../session/audio.js'
import { labForKey, seventhByDegreeForScale } from '../data/scaleLab.js'
import PianoExample from './PianoExample.jsx'
import Wheel from './Wheel.jsx'

const HOME_ORDER = ['major', 'relative', 'blues']
const HOME_HINT = {
  major: 'UP THE SCALE AND BACK TO THE HOME NOTE.',
  relative: 'THE SAME KEYS, STARTED FROM THE MINOR HOME.',
  blues: 'ROOT, ♭3, 4, ♭5, 5, ♭7 — AND BACK.',
}
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const CALL_DEGREES = [1, 5, 3, 6, 4, 7]

// The first warm-up phase: three homes on one page, then a quick degree
// call-and-response in the major. One keyboard reads notes; the armed home is
// the only one that takes them.
export default function ScaleLab({ keyId, disabled, recordAttempt, onContinue }) {
  const lab = useMemo(() => labForKey(keyId), [keyId])
  const homes = useMemo(
    () => ({ major: lab.major, relative: lab.relative, blues: lab.blues }),
    [lab],
  )
  const [cleared, setCleared] = useState({})
  const [mode, setMode] = useState(null)
  const [message, setMessage] = useState('')
  const [callIndex, setCallIndex] = useState(0)
  const [callCorrect, setCallCorrect] = useState(0)
  const [callRun, setCallRun] = useState(false)
  const midi = useMidiContext()

  const notesRef = useRef([])
  const modeRef = useRef(null)
  const guardRef = useRef(false)
  const callArmedRef = useRef(true)
  const callNotesRef = useRef([])
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const passedHomes = HOME_ORDER.filter((id) => cleared[id])
  const labPassed = passedHomes.length === HOME_ORDER.length
  const callDegree = CALL_DEGREES[Math.min(callIndex, CALL_DEGREES.length - 1)]
  const callChord = seventhByDegreeForScale(homes.major.pcs.slice(0, 7), callDegree)

  function arm(next) {
    modeRef.current = next
    setMode(next)
  }

  function hearScale(id) {
    unlockAudio()
    playPhrase(homes[id].pcs, { gap: 0.3 })
    setMessage(`HEAR ${homes[id].name}.`)
  }

  function playScale(id) {
    unlockAudio()
    notesRef.current = []
    arm({ home: id, kind: 'scale' })
    setMessage('PLAY THE SCALE UP AND BACK TO THE HOME NOTE.')
  }

  function gradeScale(notes) {
    if (guardRef.current) return
    guardRef.current = true
    const id = modeRef.current?.home || 'major'
    const home = homes[id]
    const diff = gradeSequence(home.pcs, notes)
    recordAttempt?.('warmup', !diff.passed)
    if (diff.passed) {
      setCleared((value) => ({ ...value, [id]: true }))
      setMessage(`${home.name} CLEAR.`)
    } else {
      setMessage('NOT QUITE. PLAY THE SEVEN NOTES IN ORDER.')
    }
    notesRef.current = []
    arm(null)
    guardRef.current = false
  }

  function startCalls() {
    unlockAudio()
    setCallRun(true)
    setCallIndex(0)
    setCallCorrect(0)
    setMessage('PLAY THE CHORD. NO TIMER.')
    callNotesRef.current = []
    arm({ home: 'major', kind: 'call' })
  }

  function gradeCall(notes) {
    if (guardRef.current) return
    guardRef.current = true
    const chord = seventhByDegreeForScale(homes.major.pcs.slice(0, 7), callDegree)
    const diff = gradeSet(chord.pcs, notes)
    recordAttempt?.('warmup', !diff.passed)
    if (diff.passed) {
      const nextCorrect = callCorrect + 1
      setCallCorrect(nextCorrect)
      if (callIndex >= CALL_DEGREES.length - 1) {
        setCallRun(false)
        setMessage(`CALLS CLEAR. ${nextCorrect} OF ${CALL_DEGREES.length}.`)
        arm(null)
      } else {
        setCallIndex((value) => value + 1)
        setMessage('CLEAN.')
        callArmedRef.current = false
        setTimeout(() => {
          callArmedRef.current = true
        }, 300)
      }
    } else {
      setMessage(`THE ${ROMAN[callDegree - 1]} IS ${chord.label}: ${chord.notes.join(' ')}.`)
    }
    callNotesRef.current = []
    guardRef.current = false
  }

  function handleCall(pc) {
    if (!callArmedRef.current || guardRef.current) return
    const next = [...callNotesRef.current, pc]
    callNotesRef.current = next
    if (next.length >= 4) gradeCall(next)
  }

  function handleNote(pc) {
    if (disabledRef.current || !modeRef.current) return
    if (modeRef.current.kind === 'call') {
      handleCall(pc)
      return
    }
    const next = [...notesRef.current, pc]
    notesRef.current = next
    if (next.length >= homes[modeRef.current.home].pcs.length) gradeScale(next)
  }

  function handleSilence() {
    if (!modeRef.current) return
    if (modeRef.current.kind === 'scale' && notesRef.current.length) gradeScale(notesRef.current)
    if (modeRef.current.kind === 'call' && callNotesRef.current.length) {
      gradeCall(callNotesRef.current)
    }
  }

  useNoteSequence({
    active: Boolean(mode) && !disabled,
    onNote: handleNote,
    onSilence: handleSilence,
  })

  function continueToEar() {
    onContinue?.({
      passed: true,
      homesPlayed: passedHomes,
      callsCorrect: callCorrect,
      callsTotal: CALL_DEGREES.length,
    })
  }

  return (
    <div className="scalelab">
      <div className="scalelab__wheel">
        <Wheel
          tonightKey={keyId}
          activeKey={keyId}
          activeNotes={midi.activeNotes}
          disabled={disabled}
          spinnable={false}
        />
      </div>
      <div className="homelab">
        {HOME_ORDER.map((id) => {
          const home = homes[id]
          const playing = mode?.home === id && mode.kind === 'scale'
          const status = cleared[id] ? 'CLEAR' : playing ? 'PLAYING' : 'OPEN'
          return (
            <div className="homelab__home" key={id}>
              <div className="homelab__top">
                <span className="pianoexample__label">{home.name}</span>
                <span
                  className={`homelab__stamp${cleared[id] ? ' is-clear' : playing ? ' is-live' : ''}`}
                >
                  {status}
                </span>
              </div>
              <span className="homelab__notes">{home.notes.join(' ')}</span>
              <PianoExample
                pcs={home.pcs}
                accentPc={home.homePc}
                label={`${home.name} scale keyboard`}
              />
              <div className="stagefoot">
                <button
                  type="button"
                  className={`btn${playing ? ' btn--signal' : ''}`}
                  onClick={() => playScale(id)}
                  disabled={disabled}
                >
                  PLAY THE SCALE
                </button>
                <button type="button" className="linkbtn" onClick={() => hearScale(id)}>
                  HEAR IT
                </button>
              </div>
              <p className="hintline">
                {playing ? message || HOME_HINT[id] : HOME_HINT[id]}
              </p>
            </div>
          )
        })}
      </div>

      <div className="homelab__calls">
        <span className="pianoexample__label">CALLS · MAJOR</span>
        {!callRun && !callCorrect ? (
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={startCalls} disabled={disabled}>
              START THE CALLS
            </button>
          </div>
        ) : (
          <>
            <div className="rapidprompt">
              <span className="rapidprompt__play">
                {callRun ? `${callCorrect} OF ${CALL_DEGREES.length} · PLAY` : 'CALLS'}
              </span>
              <span className="rapidprompt__chord">{callChord.label}</span>
              <span className="rapidprompt__sub">{ROMAN[callDegree - 1]} · 7TH CHORD · NO TIMER</span>
            </div>
            <div className="stagefoot">
              <button type="button" className="btn" onClick={startCalls} disabled={disabled}>
                {callRun ? 'RESTART CALLS' : 'CALLS AGAIN'}
              </button>
            </div>
          </>
        )}
        <p className="hintline">
          {mode?.kind === 'call' ? message : 'THREE HOMES FIRST, THEN CALL THE SEVENTH CHORDS.'}
        </p>
      </div>

      {labPassed ? (
        <div className="stagefoot">
          <button type="button" className="btn btn--signal" onClick={continueToEar}>
            NEXT · EAR
          </button>
        </div>
      ) : null}
    </div>
  )
}
