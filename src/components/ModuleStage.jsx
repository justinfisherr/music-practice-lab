import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence, gradeSet } from '../session/grade.js'
import { playPhrase, unlockAudio } from '../session/audio.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'

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
  const steps = module.steps || []
  const hasSetStep = steps.some((step) => step.kind === 'set')
  const hasSequenceStep = steps.some((step) => step.kind === 'sequence')
  const [phase, setPhase] = useState('teach')
  const [stepIndex, setStepIndex] = useState(0)
  const [played, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const [fails, setFails] = useState(0)
  const [completed, setCompleted] = useState(false)
  const playedRef = useRef([])
  const timersRef = useRef([])
  const gradingRef = useRef(false)
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
    if (steps.length > 1) {
      const events = []
      steps.forEach((step, index) => {
        if (index > 0) events.push(null)
        events.push(...step.targetPcs)
      })
      return { events, gap: hasSequenceStep ? SEQ_GAP : SET_GAP }
    }
    const step = steps[0]
    return { events: step?.targetPcs || [], gap: step?.kind === 'set' ? SET_GAP : SEQ_GAP }
  }

  function hear() {
    clearTimers()
    unlockAudio()
    setNotes([])
    setResult(null)
    setStepIndex(0)
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

  function replayStep(index) {
    const step = steps[index]
    const gap = step.kind === 'set' ? SET_GAP : SEQ_GAP
    playPhrase(step.targetPcs, { gap })
    return step.targetPcs.length * gap * 1000 + 350
  }

  function finishModule(passed) {
    setPhase('grade')
    if (passed) setCompleted(true)
  }

  function endModule(passed) {
    advanceStage(passed)
    if (position + 1 >= total) {
      finish()
      onFinished()
    }
  }

  function moveOn() {
    clearTimers()
    endModule(false)
  }

  function grade(notes) {
    if (gradingRef.current) return
    const step = steps[stepIndex]
    if (!step) return
    gradingRef.current = true
    const diff =
      step.kind === 'set'
        ? gradeSet(step.targetPcs, notes)
        : gradeSequence(step.targetPcs, notes)
    setResult(diff)
    setPlayed(notes)

    if (diff.passed) {
      if (stepIndex + 1 < steps.length) {
        // Step cleared; move to the next step without leaving PLAY.
        timersRef.current.push(
          setTimeout(() => {
            setStepIndex((value) => value + 1)
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
    // Miss: replay the current step once, then automatically re-arm it.
    timersRef.current.push(
      setTimeout(() => {
        const wait = replayStep(stepIndex)
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
    const step = steps[stepIndex]
    if (!step) return
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (next.length >= step.targetPcs.length) grade(next)
  }

  function handleSilence() {
    if (disabled || phase !== 'play' || result) return
    if (playedRef.current.length) grade(playedRef.current)
  }

  useNoteSequence({
    active: phase === 'play' && !disabled,
    onNote: handleNote,
    onSilence: handleSilence,
    allowRepeats: hasSequenceStep,
  })

  function nextModule() {
    endModule(true)
  }

  const step = steps[stepIndex]
  const stepIsSet = step?.kind === 'set'
  const totalNotes = stepIsSet
    ? steps.reduce((sum, item) => sum + item.targetPcs.length, 0)
    : step?.targetPcs.length || 0

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

      <div className="moduleprogress" aria-label="Module progress">
        {steps.map((item, index) => (
          <span
            className={`moduleprogress__tick${
              index < stepIndex || completed ? ' is-passed' : index === stepIndex ? ' is-active' : ''
            }`}
            key={`${item.label}-${index}`}
          />
        ))}
        <span className="moduleprogress__label">
          {completed ? 'CLEAR' : `STEP ${Math.min(stepIndex + 1, steps.length)} OF ${steps.length}`}
        </span>
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

      {hasSetStep && steps.length ? (
        <ul className="triadlist module-targets" aria-label={`${module.title} steps`}>
          {steps.map((item, index) => {
            const state =
              index < stepIndex || completed ? 'is-passed' : index === stepIndex ? 'is-active' : ''
            return (
              <li className={`triad ${state}`} key={`${item.label}-${index}`}>
                <span className="triad__numeral">
                  {item.label.split(' · ')[0] || String(index + 1).padStart(2, '0')}
                </span>
                <span className="triad__name">
                  {item.label} <span className="hintline">{item.targetNotes.join(' ')}</span>
                </span>
                <span className="triad__status">
                  {index < stepIndex || completed ? 'PLAYED' : index === stepIndex ? 'NOW' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {phase === 'play' ? (
        <>
          {stepIsSet ? (
            <div className="chordprompt">
              <span className="chordprompt__label">PLAY THE CHORD</span>
              <span className="chordprompt__name">{step?.label}</span>
              <span className="chordprompt__sub">
                {step?.targetNotes.join(' ')} · {stepIndex + 1} OF {steps.length}
              </span>
            </div>
          ) : (
            <div className="chordprompt">
              <span className="chordprompt__label">PLAY THE LINE</span>
              <span className="chordprompt__name">{step?.label}</span>
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
              {stepIsSet ? 'LISTENING FOR THE CHORD…' : 'LISTENING FOR THE LINE…'}
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

          {!stepIsSet && step ? (
            <div className="notecells" aria-label="Line diff">
              {step.targetPcs.map((pc, index) => {
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
