import { useEffect, useMemo, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence, gradeSet } from '../session/grade.js'
import { playPhrase, unlockAudio } from '../session/audio.js'
import { labForKey, seventhByDegreeForScale } from '../data/scaleLab.js'
import { noteName } from '../data/diminishedChords.js'
import PianoExample from './PianoExample.jsx'

const HOME_ORDER = ['major', 'relative', 'blues']
const HOME_LABEL = {
  major: 'MAJOR',
  relative: 'RELATIVE MINOR',
  blues: 'BLUES',
}
const ROMAN = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'],
}
const CALL_DEGREES = [1, 5, 3, 6, 4, 7]

// The first warm-up phase: three homes on one keyboard, the 12-bar form, and a
// quick degree call-and-response. The boogie drill lives in CHANGES.
export default function ScaleLab({ keyId, disabled, recordAttempt, onContinue }) {
  const lab = useMemo(() => labForKey(keyId), [keyId])
  const homes = { major: lab.major, relative: lab.relative, blues: lab.blues }
  const [home, setHome] = useState('major')
  const [playedHomes, setPlayedHomes] = useState({
    major: false,
    relative: false,
    blues: false,
  })
  const [mode, setMode] = useState(null)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [callIndex, setCallIndex] = useState(0)
  const [callCorrect, setCallCorrect] = useState(0)
  const [callRun, setCallRun] = useState(false)

  const playedRef = useRef([])
  const guardRef = useRef(false)
  const callArmedRef = useRef(true)
  const callNotesRef = useRef([])
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const current = homes[home]
  const passedHomes = HOME_ORDER.filter((id) => playedHomes[id])
  const labPassed = passedHomes.length === HOME_ORDER.length
  const callDegree = CALL_DEGREES[Math.min(callIndex, CALL_DEGREES.length - 1)]
  const romans = home === 'major' ? ROMAN.major : ROMAN.minor
  const callChord = seventhByDegreeForScale(current.pcs.slice(0, 7), callDegree)

  useEffect(() => {
    setMode(null)
    playedRef.current = []
    setResult(null)
    setMessage('')
    setCallRun(false)
    setCallIndex(0)
    setCallCorrect(0)
    callNotesRef.current = []
  }, [home, keyId])

  function setNotes(next) {
    playedRef.current = next
  }

  function hearScale() {
    unlockAudio()
    playPhrase(current.pcs, { gap: 0.3 })
    setMessage(`HEAR THE ${current.name} SCALE.`)
  }

  function startScale() {
    unlockAudio()
    setMode('scale')
    setResult(null)
    setMessage('PLAY THE SCALE UP AND BACK TO THE HOME NOTE.')
    setNotes([])
  }

  function gradeScale(notes) {
    if (guardRef.current) return
    guardRef.current = true
    const diff = gradeSequence(current.pcs, notes)
    recordAttempt?.('warmup', !diff.passed)
    setMode(null)
    setResult({ kind: 'scale', passed: diff.passed })
    if (diff.passed) {
      setPlayedHomes((value) => ({ ...value, [home]: true }))
      setMessage(`${current.name} CLEAR.`)
    } else {
      setMessage('NOT QUITE. PLAY THE SEVEN NOTES IN ORDER.')
    }
    guardRef.current = false
  }

  function startCalls() {
    unlockAudio()
    setCallRun(true)
    setCallIndex(0)
    setCallCorrect(0)
    setMode('call')
    setResult(null)
    setMessage('PLAY THE CHORD. NO TIMER.')
    callNotesRef.current = []
    setNotes([])
  }

  function gradeCall(notes) {
    if (guardRef.current) return
    guardRef.current = true
    const chord = seventhByDegreeForScale(current.pcs.slice(0, 7), callDegree)
    const diff = gradeSet(chord.pcs, notes)
    recordAttempt?.('warmup', !diff.passed)
    if (diff.passed) {
      const nextCorrect = callCorrect + 1
      setCallCorrect(nextCorrect)
      if (callIndex >= CALL_DEGREES.length - 1) {
        setCallRun(false)
        setMode(null)
        setMessage(`CALLS CLEAR. ${nextCorrect} OF ${CALL_DEGREES.length}.`)
      } else {
        setCallIndex((value) => value + 1)
        setMessage('CLEAN.')
        callArmedRef.current = false
        setTimeout(() => {
          callArmedRef.current = true
        }, 300)
      }
    } else {
      setMessage(`THE ${romans[callDegree - 1]} IS ${chord.label}: ${chord.notes.join(' ')}.`)
    }
    callNotesRef.current = []
    setNotes([])
    guardRef.current = false
  }

  function handleCall(pc) {
    if (!callArmedRef.current || guardRef.current) return
    const next = [...callNotesRef.current, pc]
    callNotesRef.current = next
    if (next.length >= 4) gradeCall(next)
  }

  function handleNote(pc) {
    if (disabledRef.current || !mode) return
    if (mode === 'call') {
      handleCall(pc)
      return
    }
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (mode === 'scale' && next.length >= current.pcs.length) gradeScale(next)
  }

  function handleSilence() {
    if (!mode) return
    if (mode === 'scale' && playedRef.current.length) gradeScale(playedRef.current)
    if (mode === 'call' && callNotesRef.current.length) gradeCall(callNotesRef.current)
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
      <div className="jamchips" role="group" aria-label="Scale home">
        {HOME_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`jamchip${home === id ? ' is-on' : ''}`}
            aria-pressed={home === id}
            onClick={() => setHome(id)}
            disabled={disabled}
          >
            {HOME_LABEL[id]}
            {playedHomes[id] ? ' · CLEAR' : ''}
          </button>
        ))}
      </div>

      <div className="scalelab__home">
        <span className="pianoexample__label">{current.name} · HOME {noteName(current.homePc)}</span>
        <span className="hintline">
          {passedHomes.length} OF {HOME_ORDER.length} HOMES PLAYED
        </span>
      </div>

      <PianoExample
        pcs={current.pcs}
        accentPc={current.homePc}
        label={`${current.name} scale keyboard`}
      />

      <div className="stagefoot">
        <button type="button" className="btn" onClick={hearScale} disabled={disabled}>
          HEAR THE SCALE
        </button>
        <button
          type="button"
          className={`btn${mode === 'scale' ? ' btn--signal' : ''}`}
          onClick={startScale}
          disabled={disabled}
        >
          PLAY THE SCALE
        </button>
      </div>

      {home !== 'blues' ? (
        <div className="scalelab__block">
          <span className="pianoexample__label">CALLS · {current.name}</span>
          {!callRun && !callCorrect ? (
            <div className="stagefoot">
              <button
                type="button"
                className="btn btn--signal"
                onClick={startCalls}
                disabled={disabled}
              >
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
                <span className="rapidprompt__sub">
                  {romans[callDegree - 1]} · 7TH CHORD · NO TIMER
                </span>
              </div>
              <div className="stagefoot">
                <button type="button" className="btn" onClick={startCalls} disabled={disabled}>
                  {callRun ? 'RESTART CALLS' : 'CALLS AGAIN'}
                </button>
              </div>
            </>
          )}
          <p className="hintline">{message || 'PICK A HOME, PLAY THE SCALE, THEN CALL THE SEVENTH CHORDS.'}</p>
        </div>
      ) : null}

      {result ? (
        <p className={`verdictline ${result.passed ? 'verdictline--ok' : 'verdictline--bad'}`}>
          {result.passed ? 'CLEAR.' : 'NOT QUITE — TRY IT AGAIN.'}
        </p>
      ) : null}

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
