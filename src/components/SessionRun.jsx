import { useEffect, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence } from '../session/grade.js'
import { EAR_GAP } from '../session/phrases.js'
import { isMuted, playPhrase, setMuted, SILENT_HINT, unlockAudio } from '../session/audio.js'
import { noteName, pitchClassesEqual } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import ModuleStage from './ModuleStage.jsx'
import SetRun from './SetRun.jsx'

function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function noteText(pcs) {
  return pcs.map(noteName).join(' · ')
}

export default function SessionRun({ practice, onFinished, onExit }) {
  const midi = useMidiContext()
  const {
    session,
    recordAttempt,
    advanceStage,
    finish,
    abandon,
    pause,
    resume,
    syncState,
  } = practice
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(() => !isMuted())
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  )
  const [review, setReview] = useState(null)

  const active = session?.status === 'active'
  const lost = active && midi.supported && !midi.connected
  const pausedForInput = !midi.connected || hidden

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [active])

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!active || !midi.supported) return
    if (midi.connected) resume()
    else pause()
  }, [active, midi.supported, midi.connected, pause, resume])

  // Moving to the next module closes any read-only review.
  useEffect(() => {
    setReview(null)
  }, [session?.currentStage])

  if (!session || !active) {
    return (
      <section className="sessionrun">
        <div className="emptyblock">
          NO SESSION RUNNING.
          <br />
          <button type="button" className="linkbtn" onClick={onExit}>
            BACK TO TODAY
          </button>
        </div>
      </section>
    )
  }

  const elapsed =
    (session.pausedAt ? Date.parse(session.pausedAt) : now) -
    Date.parse(session.startedAt) -
    (session.pausedMs || 0)
  const stageId = session.stages[session.currentStage]?.id

  function toggleSound() {
    const next = !sound
    setSound(next)
    setMuted(!next)
  }

  function leave() {
    abandon()
    onExit()
  }

  const modules = session.composition?.modules || []
  const reviewing = review != null && modules[review]

  return (
    <section className="sessionrun" aria-label="Today's session">
      <div className="sessionbar">
        <span className="sessionbar__key">{keyDisplay(session.keyId)} MAJOR</span>
        <span className="sessionbar__timer" aria-label={`Elapsed ${clock(elapsed)}`}>
          {clock(elapsed)}
        </span>
        <div className="sessionbar__btns">
          <button type="button" className="sessionbar__btn" onClick={toggleSound}>
            SOUND {sound ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            className="sessionbar__btn"
            onClick={() => setConfirmLeave((value) => !value)}
          >
            {confirmLeave ? 'CANCEL' : 'LEAVE'}
          </button>
        </div>
        {confirmLeave ? (
          <div className="sessionbar__confirm">
            <span>LEAVE THIS SESSION?</span>
            <button type="button" className="btn" onClick={leave}>
              END SESSION
            </button>
            <button type="button" className="btn" onClick={() => setConfirmLeave(false)}>
              KEEP PRACTICING
            </button>
          </div>
        ) : null}
      </div>

      {!midi.supported ? (
        <p className="notestamp">
          GRADED STAGES NEED A DESKTOP + MIDI KEYBOARD. This run cannot be graded here.
        </p>
      ) : lost ? (
        <p className="notestamp notestamp--lost" role="status">
          KEYBOARD LOST — RECONNECT. The clock is paused and nothing is counted.
        </p>
      ) : null}

      {syncState.pending > 0 ? (
        <p className="queuebar">
          <span>
            <strong>{syncState.pending}</strong> FINISHED SESSION
            {syncState.pending === 1 ? '' : 'S'} WAITING TO SYNC
          </span>
          <span>{syncState.syncing ? 'SYNCING…' : 'KEPT ON THIS DEVICE'}</span>
        </p>
      ) : null}

      {!session.composition ? (
        <div className="emptyblock">SESSION DATA MISSING. LEAVE AND START AGAIN.</div>
      ) : session.composition.version === 4 ? (
        <SetRun practice={practice} onFinished={onFinished} disabled={pausedForInput} />
      ) : session.composition.version === 3 ? (
        <div className="run">
          <RunRail
            modules={modules}
            stages={session.stages}
            currentStage={session.currentStage}
            review={review}
            onReview={setReview}
          />
          <div className="run__main">
            {reviewing ? (
              <ModuleReview
                module={modules[review]}
                keyId={session.keyId}
                onBack={() => setReview(null)}
              />
            ) : (
              <ModuleStage
                key={`${stageId}-${session.currentStage}`}
                module={modules[session.currentStage]}
                position={session.currentStage}
                total={session.stages.length}
                keyId={session.keyId}
                recordAttempt={recordAttempt}
                advanceStage={advanceStage}
                finish={finish}
                onFinished={onFinished}
                disabled={pausedForInput}
              />
            )}
          </div>
        </div>
      ) : stageId === 'warmup' ? (
        <WarmupStage
          session={session}
          recordAttempt={recordAttempt}
          advanceStage={advanceStage}
          disabled={pausedForInput}
        />
      ) : stageId === 'ear' ? (
        <EarStage
          session={session}
          recordAttempt={recordAttempt}
          advanceStage={advanceStage}
          disabled={pausedForInput}
        />
      ) : (
        <HookStage
          session={session}
          recordAttempt={recordAttempt}
          advanceStage={advanceStage}
          finish={finish}
          onFinished={onFinished}
          disabled={pausedForInput}
        />
      )}
    </section>
  )
}

function RunRail({ modules, stages, currentStage, review, onReview }) {
  return (
    <aside className="runrail" aria-label="Session modules">
      <span className="runrail__label">MODULES</span>
      <ol className="runrail__list">
        {modules.map((module, index) => {
          const stage = stages[index]
          const current = index === currentStage
          const passed = stage?.passed === true
          const status = current ? 'UP NEXT' : passed ? 'PASSED' : 'OPEN'
          return (
            <li key={`${module.type}-${index}`}>
              <button
                type="button"
                className={`runrail__item${current ? ' is-current' : ''}${
                  passed ? ' is-passed' : ''
                }${review === index ? ' is-review' : ''}`}
                aria-current={current ? 'step' : undefined}
                disabled={!passed}
                onClick={() => onReview(index)}
              >
                <span className="runrail__num">{String(index + 1).padStart(2, '0')}</span>
                <span className="runrail__body">
                  <span className="runrail__type">{module.type}</span>
                  <span className="runrail__title">{module.title}</span>
                  <span className="runrail__teach">{module.teach}</span>
                </span>
                <span className="runrail__status">{status}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

function ModuleReview({ module, keyId, onBack }) {
  return (
    <div className="stagecard modulestage reviewcard">
      <div className="stagehead">
        <span className="stagehead__eyebrow">
          REVIEW · {keyDisplay(keyId)} MAJOR · T{module.tier}
        </span>
        <h2 className="stagehead__title">{module.title}</h2>
        <p className="stagehead__copy">{module.teach}</p>
      </div>

      <div className="modulewhy">
        <span className="modulewhy__label">WHY</span>
        <span>{module.why}</span>
        <span className="modulewhy__est">{module.estSec}S</span>
      </div>

      <ul className="triadlist module-targets" aria-label={`${module.title} targets`}>
        {module.steps.map((step, index) => (
          <li className="triad is-passed" key={`${step.label}-${index}`}>
            <span className="triad__numeral">{String(index + 1).padStart(2, '0')}</span>
            <span className="triad__name">
              {step.label} <span className="hintline">{step.targetNotes.join(' ')}</span>
            </span>
            <span className="triad__status">{step.kind === 'set' ? 'SET' : 'ORDER'}</span>
          </li>
        ))}
      </ul>

      <p className="verdictline verdictline--ok">PASSED · REVIEW ONLY. NO KEYBOARD INPUT.</p>

      <div className="stagefoot">
        <button type="button" className="btn" onClick={onBack}>
          BACK TO ACTIVE MODULE
        </button>
      </div>
    </div>
  )
}

function StageHead({ eyebrow, title, copy }) {
  return (
    <div className="stagehead">
      <span className="stagehead__eyebrow">{eyebrow}</span>
      <h2 className="stagehead__title">{title}</h2>
      <p className="stagehead__copy">{copy}</p>
    </div>
  )
}

function WarmupStage({ session, recordAttempt, advanceStage, disabled }) {
  const stage = session.composition.stages[0]
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [armed, setArmed] = useState(false)
  const [, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const playedRef = useRef([])
  const timerRef = useRef(null)
  const gradingRef = useRef(false)

  const isV = step >= stage.triads.length
  const target = isV ? stage.vChord : stage.triads[step]

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  function setNotes(next) {
    playedRef.current = next
    setPlayed(next)
  }

  function grade(notes) {
    if (gradingRef.current) return
    gradingRef.current = true
    const passed = pitchClassesEqual(target.pitchClasses, notes)
    setArmed(false)
    recordAttempt('warmup', !passed)
    setResult({ passed, notes })
    if (passed) {
      playPhrase(target.pitchClasses)
      timerRef.current = setTimeout(() => {
        if (isV) {
          advanceStage(true)
          return
        }
        setStep((value) => value + 1)
        setNotes([])
        setResult(null)
        setArmed(true)
      }, 900)
    } else {
      // Miss: replay the correct chord once, then re-ask the same chord.
      timerRef.current = setTimeout(() => {
        playPhrase(target.pitchClasses)
        timerRef.current = setTimeout(() => {
          setNotes([])
          setResult(null)
          setArmed(true)
        }, target.pitchClasses.length * 450 + 250)
      }, 900)
    }
    gradingRef.current = false
  }

  function handleNote(pc) {
    if (!armed || disabled || result) return
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (next.length >= target.pitchClasses.length) grade(next)
  }

  function handleSilence() {
    if (!armed || disabled || result) return
    if (playedRef.current.length) grade(playedRef.current)
  }

  useNoteSequence({
    active: armed && !disabled && !result,
    onNote: handleNote,
    onSilence: handleSilence,
  })

  function startTriads() {
    unlockAudio()
    setStarted(true)
    setStep(0)
    setNotes([])
    setResult(null)
    setArmed(true)
  }

  function hearChord() {
    if (timerRef.current) clearTimeout(timerRef.current)
    unlockAudio()
    setArmed(false)
    setNotes([])
    setResult(null)
    playPhrase(target.pitchClasses)
    timerRef.current = setTimeout(() => setArmed(true), target.pitchClasses.length * 450 + 250)
  }

  return (
    <div className="stagecard">
      <StageHead
        eyebrow={`STAGE 1 OF 3 · ${keyDisplay(session.keyId)} MAJOR`}
        title="WARM-UP"
        copy="Hear the scale. Play the seven diatonic triads in order, then close on the V chord."
      />

      <div className="scaleviz" aria-label="Scale notes">
        {stage.scale.notes.map((note, index) => (
          <span className="scaleviz__note" key={`${note}-${index}`}>
            {note}
          </span>
        ))}
      </div>

      {!started ? (
        <>
          <div className="stagefoot">
            <button
              type="button"
              className="btn"
              onClick={() => playPhrase(stage.scale.pcs, { gap: 0.32 })}
            >
              HEAR SCALE
            </button>
            <button type="button" className="btn btn--signal" onClick={startTriads} disabled={disabled}>
              START TRIADS
            </button>
          </div>
          <p className="hintline">Any octave. Any inversion. The grader listens for pitch class.</p>
        </>
      ) : (
        <>
          <div className="spine" aria-hidden="true">
            {stage.triads.map((chord, index) => (
              <span
                key={chord.name}
                className={`spine__tick${index === step ? ' is-active' : ''}${
                  index < step ? ' is-passed' : ''
                }`}
              />
            ))}
          </div>

          <ul className="triadlist" aria-label="Diatonic triads">
            {stage.triads.map((chord, index) => {
              const state =
                index < step
                  ? 'is-passed'
                  : index === step && isV
                    ? ''
                    : index === step
                      ? 'is-active'
                      : ''
              return (
                <li className={`triad ${state}`} key={`${chord.numeral}-${chord.name}`}>
                  <span className="triad__numeral">{chord.numeral}</span>
                  <span className="triad__name">
                    {chord.name} <span className="hintline">{chord.notes.join(' ')}</span>
                  </span>
                  <span className="triad__status">
                    {index < step ? 'PLAYED' : index === step && !isV ? 'NOW' : ''}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="chordprompt">
            <span className="chordprompt__label">{isV ? 'CLOSE ON' : 'PLAY THE CHORD'}</span>
            <span className="chordprompt__name">{target.name}</span>
            <span className="chordprompt__sub">
              {isV ? `${target.numeral} · V CHORD` : `${target.numeral} · ${target.notes.join(' ')}`}
            </span>
          </div>

          {result ? (
            <p className={`verdictline ${result.passed ? 'verdictline--ok' : 'verdictline--bad'}`}>
              {result.passed ? 'CLEAR.' : `NOT QUITE — YOU PLAYED ${noteText(result.notes) || 'NOTHING'}.`}
            </p>
          ) : (
            <p className="hintline">
              {armed ? 'LISTENING FOR THREE NOTES…' : 'READY FOR THREE NOTES.'}
            </p>
          )}

          <div className="stagefoot">
            <button
              type="button"
              className="btn"
              onClick={hearChord}
              disabled={result?.passed || disabled}
            >
              HEAR CHORD
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function EarStage({ session, recordAttempt, advanceStage, disabled }) {
  const stage = session.composition.stages[1]
  const [phase, setPhase] = useState('ready')
  const [played, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const [fails, setFails] = useState(0)
  const playedRef = useRef([])
  const timerRef = useRef(null)
  const gradingRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  function setNotes(next) {
    playedRef.current = next
    setPlayed(next)
  }

  function hear() {
    if (timerRef.current) clearTimeout(timerRef.current)
    unlockAudio()
    setPhase('listening')
    setResult(null)
    setNotes([])
    playPhrase(stage.pcs, { gap: EAR_GAP })
    timerRef.current = setTimeout(
      () => setPhase('your-turn'),
      stage.pcs.length * EAR_GAP * 1000 + 450,
    )
  }

  function grade(notes) {
    if (gradingRef.current) return
    gradingRef.current = true
    const diff = gradeSequence(stage.pcs, notes)
    recordAttempt('ear', !diff.passed)
    setResult(diff)
    setPlayed(notes)
    setPhase('result')
    if (!diff.passed) {
      setFails((value) => value + 1)
      // Miss: replay the phrase, then automatically re-arm the same attempt.
      timerRef.current = setTimeout(() => {
        if (disabledRef.current) {
          setNotes([])
          setResult(null)
          setPhase('your-turn')
          return
        }
        hear()
      }, 1200)
    }
    gradingRef.current = false
  }

  function handleNote(pc) {
    if (disabled || phase !== 'your-turn') return
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (next.length >= stage.pcs.length) grade(next)
  }

  function handleSilence() {
    if (disabled || phase !== 'your-turn') return
    if (playedRef.current.length) grade(playedRef.current)
  }

  useNoteSequence({
    active: phase === 'your-turn' && !disabled,
    onNote: handleNote,
    onSilence: handleSilence,
  })

  const matched = result ? result.rows.filter((row) => row.status === 'match').length : 0
  const canSkip = fails >= 2

  return (
    <div className="stagecard">
      <StageHead
        eyebrow={`STAGE 2 OF 3 · ${keyDisplay(session.keyId)} MAJOR`}
        title="EAR CHECK"
        copy="Four diatonic notes at 96 BPM. Hear it, then play it back in order."
      />

      {phase === 'ready' || phase === 'listening' ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={hear}>
              {phase === 'listening' ? 'PLAYING…' : 'HEAR IT'}
            </button>
          </div>
          <p className="hintline">{SILENT_HINT}</p>
        </>
      ) : null}

      {phase === 'your-turn' ? (
        <>
          <p className="verdictline">YOUR TURN — PLAY THE FOUR NOTES.</p>
          <NoteCells target={stage.pcs} played={played} result={null} />
          <p className="hintline">Stop early and the silence timer grades what you gave it.</p>
          {canSkip ? (
            <div className="stagefoot">
              <button type="button" className="btn btn--ghost" onClick={() => advanceStage(false)}>
                SKIP TO THE HOOK
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {phase === 'result' && result ? (
        <>
          <p className={`verdictline ${result.passed ? 'verdictline--ok' : 'verdictline--bad'}`}>
            {result.passed ? 'CLEAN.' : `${matched} OF ${stage.pcs.length}.`}
          </p>
          <NoteCells target={stage.pcs} played={played} result={result} />
          {result.extraCount ? (
            <p className="hintline">{result.extraCount} EXTRA NOTE{result.extraCount === 1 ? '' : 'S'}.</p>
          ) : null}
          <div className="stagefoot">
            {result.passed ? (
              <button type="button" className="btn btn--signal" onClick={() => advanceStage(true)}>
                CONTINUE TO HOOK
              </button>
            ) : (
              <>
                <button type="button" className="btn" onClick={hear}>
                  LISTEN AGAIN
                </button>
                {canSkip ? (
                  <button type="button" className="btn btn--ghost" onClick={() => advanceStage(false)}>
                    SKIP TO THE HOOK
                  </button>
                ) : null}
              </>
            )}
          </div>
          {canSkip ? (
            <p className="hintline">Two misses. The hook is open whenever you want it.</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function NoteCells({ target, played, result }) {
  return (
    <div className="notecells" aria-label="Note cells">
      {target.map((targetPc, index) => {
        const row = result?.rows[index]
        const playedPc = row ? row.playedPc : played[index]
        const status = row ? row.status : 'pending'
        return (
          <div className={`notecell is-${status}`} key={index}>
            <span className="notecell__index">{index + 1}</span>
            <span className="notecell__note">
              {result ? noteName(targetPc) : playedPc == null ? '·' : noteName(playedPc)}
            </span>
            <span className="notecell__mark">
              {result
                ? playedPc == null
                  ? 'MISSING'
                  : `YOU ${noteName(playedPc)}`
                : playedPc == null
                  ? 'PLAY'
                  : 'HEARD'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function HookStage({ session, recordAttempt, advanceStage, finish, onFinished, disabled }) {
  const stage = session.composition.stages[2]
  const [phase, setPhase] = useState('ready')
  const [, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const [lit, setLit] = useState(-1)
  const [fails, setFails] = useState(0)
  const playedRef = useRef([])
  const timersRef = useRef([])
  const gradingRef = useRef(false)
  const finishedRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

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

  function hear() {
    clearTimers()
    unlockAudio()
    setResult(null)
    setPhase('listening')
    setNotes([])
    setLit(-1)
    const beats = Array.isArray(stage.beats) ? stage.beats : [0, 1, 2, 4, 5, 6]
    const pcs = Array.isArray(stage.pcs) ? stage.pcs : []
    const performance = Array.from({ length: 8 }, (_, beat) => {
      const index = beats.indexOf(beat)
      return index >= 0 ? pcs[index] : null
    })
    playPhrase(performance, { gap: 0.5 })
    for (let beat = 0; beat < 8; beat++) {
      timersRef.current.push(setTimeout(() => setLit(beat), beat * 500))
    }
    timersRef.current.push(
      setTimeout(() => {
        setLit(-1)
        setPhase('your-turn')
      }, 8 * 500 + 350),
    )
  }

  function grade(notes) {
    if (gradingRef.current) return
    gradingRef.current = true
    const diff = gradeSequence(stage.pcs, notes)
    recordAttempt('hook', !diff.passed)
    setResult(diff)
    setPlayed(notes)
    setPhase('result')
    if (!diff.passed) {
      setFails((value) => value + 1)
      // Miss: replay the hook, then automatically re-arm the attempt.
      timersRef.current.push(
        setTimeout(() => {
          if (disabledRef.current) {
            setNotes([])
            setResult(null)
            setPhase('your-turn')
            return
          }
          hear()
        }, 1200),
      )
    }
    gradingRef.current = false
  }

  function handleNote(pc) {
    if (disabled || phase !== 'your-turn') return
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (next.length >= stage.pcs.length) grade(next)
  }

  function handleSilence() {
    if (disabled || phase !== 'your-turn') return
    if (playedRef.current.length) grade(playedRef.current)
  }

  useNoteSequence({
    active: phase === 'your-turn' && !disabled,
    onNote: handleNote,
    onSilence: handleSilence,
  })

  function finishHook() {
    if (finishedRef.current) return
    finishedRef.current = true
    advanceStage(true)
    finish()
    onFinished()
  }

  const beatNotes = new Map(stage.beats.map((beat, index) => [beat, { pc: stage.pcs[index], index }]))
  const matched = result ? result.rows.filter((row) => row.status === 'match').length : 0

  return (
    <div className="hook">
      <div className="hook__top">
        <h2 className="hook__title">HOOK</h2>
        <span className="hook__meta">
          STAGE 3 OF 3
          <br />
          {keyDisplay(session.keyId)} MAJOR
        </span>
      </div>
      <p className="hook__copy">
        Two bars. Six notes. Listen once, then play it back. Clean means clean.
      </p>

      <div className="hookgrid" aria-label="Two bar hook grid">
        {Array.from({ length: 8 }, (_, beat) => {
          const item = beatNotes.get(beat)
          const state = lit === beat ? ' is-lit' : lit > beat ? ' is-past' : ''
          if (!item) {
            return (
              <div className={`hookcell is-rest${state}`} key={beat}>
                <span className="hookcell__beat">{beat + 1}</span>
                <span className="hookcell__note">·</span>
              </div>
            )
          }
          return (
            <div className={`hookcell${state}`} key={beat}>
              <span className="hookcell__beat">{beat + 1}</span>
              <span className="hookcell__note">{noteName(item.pc)}</span>
            </div>
          )
        })}
      </div>

      {phase === 'ready' || phase === 'listening' ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={hear}>
              {phase === 'listening' ? 'PLAYING…' : 'HEAR THE HOOK'}
            </button>
          </div>
          <p className="hintline" style={{ color: 'var(--muted-on-ink)' }}>
            {SILENT_HINT}
          </p>
        </>
      ) : null}

      {phase === 'your-turn' ? (
        <>
          <div className="verdictline verdictline--ink">YOUR TURN — PLAY IT BACK.</div>
          <p className="hook__copy">Stop early and the silence timer grades the partial.</p>
        </>
      ) : null}

      {phase === 'result' && result ? (
        <>
          {result.passed ? (
            <p className="hook__pass">6 OF 6. THAT&apos;S THE SESSION.</p>
          ) : (
            <p className="hook__fail">{matched} OF {stage.pcs.length}. LISTEN AGAIN.</p>
          )}
          <div className={`notecells${stage.pcs.length === 6 ? ' notecells--six' : ''}`}>
            {stage.pcs.map((pc, index) => {
              const row = result.rows[index]
              const status = row?.status || 'missing'
              return (
                <div className={`notecell is-${status}`} key={index}>
                  <span className="notecell__index">{index + 1}</span>
                  <span className="notecell__note">{noteName(pc)}</span>
                  <span className="notecell__mark">
                    <span className={`hookmark hookmark--${status}`} aria-hidden="true" />{' '}
                    {row?.playedPc == null ? 'MISSING' : noteName(row.playedPc)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="hookmarks" aria-label="Diff key">
            <span className="hookmarks__item">
              <span className="hookmark hookmark--match" aria-hidden="true" /> SOLID = MATCH
            </span>
            <span className="hookmarks__item">
              <span className="hookmark hookmark--off" aria-hidden="true" /> SLASH = WRONG
            </span>
            <span className="hookmarks__item">
              <span className="hookmark hookmark--missing" aria-hidden="true" /> DASH = MISSING
            </span>
          </div>
          {result.extraCount ? (
            <p className="hintline" style={{ color: 'var(--muted-on-ink)' }}>
              {result.extraCount} EXTRA NOTE{result.extraCount === 1 ? '' : 'S'}.
            </p>
          ) : null}
          <div className="stagefoot">
            {result.passed ? (
              <button type="button" className="btn btn--signal" onClick={finishHook}>
                FINISH SESSION
              </button>
            ) : (
              <button type="button" className="btn" onClick={hear}>
                LISTEN AGAIN
              </button>
            )}
          </div>
          {!result.passed && fails >= 2 ? (
            <p className="hintline" style={{ color: 'var(--muted-on-ink)' }}>
              Two misses. The line is still yours to take.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
