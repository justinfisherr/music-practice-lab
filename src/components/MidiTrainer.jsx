import { useEffect, useMemo, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import {
  dim7Drill,
  makeChordsDrill,
  makeFunctionDrill,
  MAJOR_KEYS,
  MODES,
  LIGHTNING_SECONDS,
  SURVIVAL_LIVES,
} from '../drills/index.js'
import { QUIZZES_KEY, isPlayable, quizToDrill } from '../data/quizzes.js'
import { pitchClassesEqual, noteName } from '../data/diminishedChords.js'
import MidiConnection from './MidiConnection.jsx'
import Stats from './Stats.jsx'

const CORRECT_DELAY = 900
const WRONG_DELAY = 2300

function freshSession(mode) {
  return {
    score: 0,
    attempted: 0,
    correct: 0,
    streak: 0,
    lives: mode === 'SURVIVAL' ? SURVIVAL_LIVES : null,
  }
}

function formatTime(ms) {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

export default function MidiTrainer() {
  const midi = useMidiContext()

  // Built-in drills (dim7 + key-scoped chords/function) plus any playable
  // custom quizzes from localStorage. The key-scoped drills are rebuilt when
  // the key changes, so their generate/buildSet closures always see it.
  const [keyId, setKeyId] = useState(MAJOR_KEYS[0].id)
  const [quizzes] = useLocalStorage(QUIZZES_KEY, [])
  const drills = useMemo(
    () => [
      dim7Drill,
      makeChordsDrill(keyId),
      makeFunctionDrill(keyId),
      ...quizzes.filter(isPlayable).map(quizToDrill),
    ],
    [quizzes, keyId],
  )

  const [drillId, setDrillId] = useState(dim7Drill.id)
  const [mode, setMode] = useState('NORMAL')
  const [phase, setPhase] = useState('idle') // idle | running | done
  const [question, setQuestion] = useState(null)
  const [collected, setCollected] = useState([]) // pitch classes this attempt
  const [feedback, setFeedback] = useState(null)
  const [timeLeft, setTimeLeft] = useState(LIGHTNING_SECONDS)
  const [elapsedMs, setElapsedMs] = useState(0) // timed-set stopwatch
  const [lastTime, setLastTime] = useState(null) // last completed set time
  const [progress, setProgress] = useState(null) // "3 / 7" for set drills

  const drill = drills.find((d) => d.id === drillId) ?? drills[0]

  // Best score (streak) and best time are scoped per drill — and per key for
  // the key-scoped drills — so D major and E major track separately.
  const scopeId = drill.usesKey ? `${drill.id}.${keyId}` : drill.id
  const [best, setBest] = useLocalStorage(`mpl.trainer.best.${scopeId}`, 0)
  const [bestTime, setBestTime] = useLocalStorage(`mpl.trainer.besttime.${scopeId}`, 0)

  // The live session snapshot for rendering; mutated through sessionRef.
  const [session, setSession] = useState(() => freshSession('NORMAL'))

  // --- Refs mirror everything the MIDI callback and timers need (no stale closures).
  const sessionRef = useRef(session)
  const phaseRef = useRef('idle')
  const modeRef = useRef(mode)
  const drillRef = useRef(drill)
  const questionRef = useRef(null)
  const collectedRef = useRef([])
  const bestRef = useRef(best)
  const bestTimeRef = useRef(bestTime)
  const busyRef = useRef(false) // true during feedback pause: ignore input
  const feedbackTimer = useRef(null)
  const tick = useRef(null)
  const timeLeftRef = useRef(LIGHTNING_SECONDS)
  const setRef = useRef([]) // fixed question set for timed drills
  const setIndexRef = useRef(0)
  const startTimeRef = useRef(0)
  const stopwatchRef = useRef(null)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { drillRef.current = drill }, [drill])
  useEffect(() => { bestRef.current = best }, [best])
  useEffect(() => { bestTimeRef.current = bestTime }, [bestTime])

  function commit() {
    setSession({ ...sessionRef.current })
  }

  function clearTimers() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (tick.current) clearInterval(tick.current)
    if (stopwatchRef.current) clearInterval(stopwatchRef.current)
    feedbackTimer.current = null
    tick.current = null
    stopwatchRef.current = null
  }

  function startStopwatch() {
    if (stopwatchRef.current) clearInterval(stopwatchRef.current)
    startTimeRef.current = Date.now()
    setElapsedMs(0)
    stopwatchRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)
  }

  function nextQuestion() {
    const d = drillRef.current
    const q = d.buildSet
      ? setRef.current[setIndexRef.current]
      : d.generate(questionRef.current)
    questionRef.current = q
    setQuestion(q)
    collectedRef.current = []
    setCollected([])
    busyRef.current = false
    setProgress(d.buildSet ? `${setIndexRef.current + 1} / ${setRef.current.length}` : null)
  }

  function endSession() {
    clearTimers()
    phaseRef.current = 'done'
    setPhase('done')
    busyRef.current = true
  }

  function startSession() {
    clearTimers()
    sessionRef.current = freshSession(modeRef.current)
    commit()
    setFeedback(null)
    collectedRef.current = []
    setCollected([])
    busyRef.current = false
    setLastTime(null)
    phaseRef.current = 'running'
    setPhase('running')

    if (drillRef.current.buildSet) {
      setRef.current = drillRef.current.buildSet()
      setIndexRef.current = 0
      startStopwatch()
    }
    nextQuestion()

    if (modeRef.current === 'LIGHTNING') {
      timeLeftRef.current = LIGHTNING_SECONDS
      setTimeLeft(LIGHTNING_SECONDS)
      tick.current = setInterval(() => {
        timeLeftRef.current -= 1
        setTimeLeft(timeLeftRef.current)
        if (timeLeftRef.current <= 0) endSession()
      }, 1000)
    }
  }

  function advance() {
    setFeedback(null)
    if (phaseRef.current !== 'running') return
    if (modeRef.current === 'SURVIVAL' && (sessionRef.current.lives ?? 0) <= 0) {
      endSession()
      return
    }
    nextQuestion()
  }

  function advanceSet() {
    setFeedback(null)
    setIndexRef.current += 1
    if (setIndexRef.current >= setRef.current.length) {
      finishSet()
      return
    }
    nextQuestion()
  }

  function finishSet() {
    const elapsed = Date.now() - startTimeRef.current
    if (stopwatchRef.current) clearInterval(stopwatchRef.current)
    stopwatchRef.current = null
    setElapsedMs(elapsed)
    setLastTime(elapsed)
    if (elapsed < bestTimeRef.current || bestTimeRef.current === 0) {
      bestTimeRef.current = elapsed
      setBestTime(elapsed)
    }
    endSession()
  }

  function evaluate(detected) {
    busyRef.current = true
    const q = questionRef.current
    const s = sessionRef.current
    const correct = pitchClassesEqual(detected, q.expected)

    s.attempted += 1
    if (correct) {
      s.score += 1
      s.correct += 1
      s.streak += 1
      if (s.streak > bestRef.current) {
        bestRef.current = s.streak
        setBest(s.streak)
      }
      setFeedback({ correct: true })
    } else {
      s.streak = 0
      if (modeRef.current === 'SURVIVAL' && s.lives != null) s.lives -= 1
      setFeedback({
        correct: false,
        detected: [...new Set(detected.map((pc) => ((pc % 12) + 12) % 12))],
        expectedNotes: q.expectedNotes,
      })
    }
    commit()

    // Timed sets: a wrong answer re-presents the same numeral (the clock keeps
    // running); a right answer advances to the next numeral.
    if (drillRef.current.buildSet) {
      feedbackTimer.current = setTimeout(
        () => (correct ? advanceSet() : retryQuestion()),
        correct ? CORRECT_DELAY : WRONG_DELAY,
      )
      return
    }

    feedbackTimer.current = setTimeout(advance, correct ? CORRECT_DELAY : WRONG_DELAY)
  }

  function retryQuestion() {
    setFeedback(null)
    nextQuestion() // same set index -> same question, cleared collected
  }

  // Subscribe once to MIDI note-on events; all state read through refs.
  useEffect(() => {
    const unsubscribe = midi.subscribe((note) => {
      if (phaseRef.current !== 'running' || busyRef.current) return
      const pc = ((note % 12) + 12) % 12
      if (collectedRef.current.includes(pc)) return
      const next = [...collectedRef.current, pc]
      collectedRef.current = next
      setCollected(next)
      // Per-question count first (custom quizzes mix triads and 7ths), then the
      // drill default.
      const target = questionRef.current?.notesToCollect || drillRef.current.notesToCollect || 4
      if (next.length >= target) evaluate(next)
    })
    return unsubscribe
    // Intentionally only depends on the stable `subscribe`. The handler reads
    // all mutable state through refs so it never needs to re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midi.subscribe])

  // Clean up timers on unmount.
  useEffect(() => clearTimers, [])

  // Changing mode or drill resets to idle.
  function chooseMode(next) {
    clearTimers()
    setMode(next)
    modeRef.current = next
    phaseRef.current = 'idle'
    setPhase('idle')
    setFeedback(null)
    setCollected([])
    collectedRef.current = []
    sessionRef.current = freshSession(next)
    commit()
    busyRef.current = false
    setProgress(null)
  }

  function chooseDrill(next) {
    const d = drills.find((x) => x.id === next) ?? drills[0]
    setDrillId(next)
    drillRef.current = d
    // Timed drills don't play the normal/life modes — force NORMAL.
    if (d.timed && modeRef.current !== 'NORMAL') modeRef.current = 'NORMAL'
    chooseMode(modeRef.current)
  }

  function chooseKey(next) {
    setKeyId(next)
    // Same reset as switching mode: idle, fresh session.
    clearTimers()
    phaseRef.current = 'idle'
    setPhase('idle')
    setFeedback(null)
    setCollected([])
    collectedRef.current = []
    sessionRef.current = freshSession(modeRef.current)
    commit()
    busyRef.current = false
    setProgress(null)
  }

  // If the selected quiz was deleted or emptied elsewhere, fall back to the
  // built-in drill so the picker and engine stay in sync.
  useEffect(() => {
    if (!drills.some((d) => d.id === drillId)) chooseDrill(drills[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drills, drillId])

  const accuracy = session.attempted > 0 ? Math.round((session.correct / session.attempted) * 100) : 0
  const extraStats = []
  if (drill.timed) {
    extraStats.push({ label: 'TIME', value: formatTime(elapsedMs) })
  } else if (mode === 'LIGHTNING') {
    extraStats.push({ label: 'TIME', value: `${timeLeft}s` })
  }
  if (!drill.timed && mode === 'SURVIVAL') {
    extraStats.push({ label: 'LIVES', value: session.lives ?? SURVIVAL_LIVES })
  }

  const bestDisplay = drill.timed ? (bestTime > 0 ? formatTime(bestTime) : '—') : best

  return (
    <div className="midi">
      <MidiConnection midi={midi} />

      {midi.supported && (
        <>
          <Picker
            legend="DRILL"
            options={drills.map((d) => ({ id: d.id, label: d.label }))}
            value={drill.id}
            onChange={chooseDrill}
          />
          {drill.usesKey && (
            <Picker
              legend="KEY"
              options={MAJOR_KEYS.map((k) => ({ id: k.id, label: k.label }))}
              value={keyId}
              onChange={chooseKey}
            />
          )}
          {drill.timed ? (
            <p className="hint">{drill.blurb}</p>
          ) : (
            <>
              <Picker
                legend="MODE"
                options={MODES.map((m) => ({ id: m.id, label: m.label }))}
                value={mode}
                onChange={chooseMode}
              />
              <p className="hint">{MODES.find((m) => m.id === mode)?.blurb}</p>
            </>
          )}

          <Stats
            score={session.score}
            streak={session.streak}
            best={bestDisplay}
            correct={session.correct}
            attempted={session.attempted}
            extra={extraStats}
          />

          <div className="stage">
            {phase === 'idle' && (
              <div className="stage__idle">
                {midi.connected ? (
                  <button type="button" className="btn btn--huge" onClick={startSession}>
                    START {drill.timed ? 'SET' : mode}
                  </button>
                ) : (
                  <p className="stage__msg">CONNECT A MIDI KEYBOARD TO BEGIN.</p>
                )}
              </div>
            )}

            {phase === 'running' && (
              <RunningStage
                question={question}
                collected={collected}
                feedback={feedback}
                progress={progress}
              />
            )}

            {phase === 'done' && (
              <div className="stage__done">
                <p className="stage__doneline">{drill.timed ? 'SET COMPLETE' : 'SESSION OVER'}</p>
                {drill.timed ? (
                  <>
                    <p className="stage__bigscore">{formatTime(lastTime)}</p>
                    <p className="stage__msg">
                      BEST {formatTime(bestTime)} · {session.correct}/{session.attempted} CORRECT
                    </p>
                  </>
                ) : (
                  <>
                    <p className="stage__bigscore">{session.score}</p>
                    <p className="stage__msg">
                      {session.correct}/{session.attempted} · {accuracy}% ACCURACY
                    </p>
                  </>
                )}
                <button type="button" className="btn btn--huge" onClick={startSession}>
                  PLAY AGAIN
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RunningStage({ question, collected, feedback, progress }) {
  if (feedback) {
    return (
      <div className={`verdict ${feedback.correct ? 'verdict--ok' : 'verdict--bad'}`}>
        <p className="verdict__word">{feedback.correct ? 'CORRECT' : 'WRONG'}</p>
        {!feedback.correct && (
          <div className="verdict__detail">
            <div>
              <span className="verdict__k">YOU PLAYED</span>
              <span className="verdict__v">{feedback.detected.map(noteName).join(' · ') || '—'}</span>
            </div>
            <div>
              <span className="verdict__k">CORRECT</span>
              <span className="verdict__v">{feedback.expectedNotes.join(' · ')}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="target">
      <span className="target__label">{question?.promptLabel || 'PLAY'}</span>
      <span className="target__value">{question?.promptValue || '—'}</span>
      {question?.subtitle && <span className="target__sub">{question.subtitle}</span>}
      {progress && <span className="target__progress">{progress}</span>}
      <div className="target__collected">
        {collected.length === 0 ? (
          <span className="target__waiting">WAITING FOR NOTES…</span>
        ) : (
          collected.map((pc) => (
            <span className="notechip" key={pc}>
              {noteName(pc)}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function Picker({ legend, options, value, onChange }) {
  return (
    <fieldset className="picker">
      <legend className="picker__legend">{legend}</legend>
      <div className="picker__opts">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`chipbtn${value === o.id ? ' is-active' : ''}`}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
