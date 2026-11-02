import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence, gradeSet } from '../session/grade.js'
import { playPhrase, unlockAudio } from '../session/audio.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import { GRADING } from '../../lib/modules.js'

const SET_GAP = 0.12
const SEQ_GAP = 0.5

export default function ModuleStage({
  module,
  position,
  total,
  keyId,
  recordAttempt,
  advanceStage,
  finish,
  onFinished,
  disabled,
}) {
  const setMode = module.grading === GRADING.SET
  const targets = module.targets || []
  const [phase, setPhase] = useState('teach')
  const [targetIndex, setTargetIndex] = useState(0)
  const [played, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const [fails, setFails] = useState(0)
  const [completed, setCompleted] = useState(false)
  const playedRef = useRef([])
  const timersRef = useRef([])
  const gradingRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const stageId = String(module.type).toLowerCase()

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
    },
    [],
  )

  function setNotes(next) {
    playedRef.current = next
    setPlayed(next)
  }

  function clearTimers() {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
  }

  function hearEvents() {
    if (!setMode) return { events: targets[0].pcs, gap: SEQ_GAP }
    const events = []
    targets.forEach((target, index) => {
      if (index > 0) events.push(null)
      events.push(...target.pcs)
    })
    return { events, gap: SET_GAP }
  }

  function hear() {
    clearTimers()
    unlockAudio()
    setNotes([])
    setResult(null)
    setTargetIndex(0)
    setCompleted(false)
    setPhase('hear')
    const { events, gap } = hearEvents()
    playPhrase(events, { gap })
    timersRef.current.push(
      setTimeout(() => {
        setPhase('play')
      }, events.length * gap * 1000 + 450),
    )
  }

  function replayTarget(index) {
    const target = targets[index]
    playPhrase(target.pcs, { gap: setMode ? SET_GAP : SEQ_GAP })
    return target.pcs.length * (setMode ? SET_GAP : SEQ_GAP) * 1000 + 350
  }

  function finishModule(passed) {
    setPhase('grade')
    if (passed) setCompleted(true)
  }

  function moveOn() {
    clearTimers()
    advanceStage(false)
    if (position + 1 >= total) {
      finish()
      onFinished()
    }
  }

  function grade(notes) {
    if (gradingRef.current) return
    const target = targets[targetIndex]
    gradingRef.current = true
    const diff = setMode ? gradeSet(target.pcs, notes) : gradeSequence(target.pcs, notes)
    setResult(diff)
    setPlayed(notes)
    if (diff.passed) {
      if (setMode && targetIndex + 1 < targets.length) {
        // Chord cleared; move to the next chord without leaving PLAY.
        timersRef.current.push(
          setTimeout(() => {
            setTargetIndex((value) => value + 1)
            setNotes([])
            setResult(null)
            setPhase('play')
          }, 750),
        )
        gradingRef.current = false
        return
      }
      recordAttempt(stageId, false)
      finishModule(true)
      gradingRef.current = false
      return
    }
    recordAttempt(stageId, true)
    setFails((value) => value + 1)
    // Miss: replay the target once, then automatically re-arm the same attempt.
    timersRef.current.push(
      setTimeout(() => {
        const wait = replayTarget(targetIndex)
        timersRef.current.push(
          setTimeout(() => {
            setNotes([])
            setResult(null)
            setPhase('play')
          }, wait),
        )
      }, 850),
    )
    gradingRef.current = false
  }

  function handleNote(pc) {
    if (disabled || phase !== 'play' || result) return
    const target = targets[targetIndex]
    if (!target) return
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (next.length >= target.pcs.length) grade(next)
  }

  function handleSilence() {
    if (disabled || phase !== 'play' || result) return
    if (playedRef.current.length) grade(playedRef.current)
  }

  useNoteSequence({
    active: phase === 'play' && !disabled,
    onNote: handleNote,
    onSilence: handleSilence,
    allowRepeats: module.grading === GRADING.SEQUENCE,
  })

  function nextModule() {
    advanceStage(true)
    if (position + 1 >= total) {
      finish()
      onFinished()
    }
  }

  const target = targets[targetIndex]
  const totalNotes = setMode ? targets.reduce((sum, item) => sum + item.pcs.length, 0) : target?.pcs.length || 0

  return (
    <div className="stagecard modulestage">
      <div className="stagehead">
        <span className="stagehead__eyebrow">
          MODULE {position + 1} OF {total} · {keyDisplay(keyId)} MAJOR
        </span>
        <h2 className="stagehead__title">{module.title}</h2>
        <p className="stagehead__copy">{module.teach}</p>
      </div>

      <div className="modulewhy">
        <span className="modulewhy__label">WHY</span>
        <span>{module.why}</span>
        <span className="modulewhy__est">{module.estSec}S</span>
      </div>

      {phase === 'teach' ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={hear} disabled={disabled}>
              HEAR IT
            </button>
          </div>
          <p className="hintline">Any octave. The grader listens for pitch class.</p>
        </>
      ) : null}

      {phase === 'hear' ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn" disabled>
              PLAYING…
            </button>
          </div>
          <p className="hintline">LISTEN. THEN PLAY IT BACK.</p>
        </>
      ) : null}

      {setMode && targets.length ? (
        <ul className="triadlist module-targets" aria-label={`${module.title} targets`}>
          {targets.map((item, index) => {
            const state =
              index < targetIndex ? 'is-passed' : index === targetIndex ? 'is-active' : ''
            return (
              <li className={`triad ${state}`} key={`${item.label}-${index}`}>
                <span className="triad__numeral">{item.numeral || String(index + 1).padStart(2, '0')}</span>
                <span className="triad__name">
                  {item.label} <span className="hintline">{item.pcs.map(noteName).join(' ')}</span>
                </span>
                <span className="triad__status">
                  {index < targetIndex ? 'PLAYED' : index === targetIndex ? 'NOW' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {phase === 'play' ? (
        <>
          {setMode ? (
            <div className="chordprompt">
              <span className="chordprompt__label">PLAY THE CHORD</span>
              <span className="chordprompt__name">{target?.label}</span>
              <span className="chordprompt__sub">
                {target?.pcs.map(noteName).join(' ')} · {targetIndex + 1} OF {targets.length}
              </span>
            </div>
          ) : (
            <div className="chordprompt">
              <span className="chordprompt__label">PLAY THE LINE</span>
              <span className="chordprompt__name">{target?.label}</span>
              <span className="chordprompt__sub">
                {played.length} OF {totalNotes} NOTES HEARD
              </span>
            </div>
          )}

          {result && !result.passed ? (
            <p className="verdictline verdictline--bad">
              NOT QUITE — REPLAYING THE TARGET. MISSES: {fails}
            </p>
          ) : (
            <p className="hintline">
              {setMode ? 'LISTENING FOR THE CHORD…' : 'LISTENING FOR THE LINE…'}
            </p>
          )}

          {fails >= 2 ? (
            <div className="stagefoot">
              <button type="button" className="btn btn--ghost" onClick={moveOn} disabled={disabled}>
                MOVE ON
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {phase === 'grade' ? (
        <>
          <p className={`verdictline ${completed ? 'verdictline--ok' : 'verdictline--bad'}`}>
            {completed
              ? fails
                ? `CLEAR — ${fails} RETRIE${fails === 1 ? 'Y' : 'ES'}.`
                : 'CLEAR. FIRST TRY.'
              : `MOVED ON — ${fails} MISS${fails === 1 ? '' : 'ES'}.`}
          </p>

          {!setMode && target ? (
            <div className="notecells" aria-label="Line diff">
              {target.pcs.map((pc, index) => {
                const row = result?.rows?.[index]
                const status = row?.status || 'missing'
                return (
                  <div className={`notecell is-${status}`} key={index}>
                    <span className="notecell__index">{index + 1}</span>
                    <span className="notecell__note">{noteName(pc)}</span>
                    <span className="notecell__mark">
                      {row?.playedPc == null ? 'MISSING' : noteName(row.playedPc)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="stagefoot">
            {completed ? (
              <button type="button" className="btn btn--signal" onClick={nextModule}>
                {position + 1 >= total ? 'FINISH SESSION' : 'NEXT MODULE'}
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={moveOn}>
                {position + 1 >= total ? 'FINISH SESSION' : 'NEXT MODULE'}
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
