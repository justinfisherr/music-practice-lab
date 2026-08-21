import { useEffect, useMemo, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { DRILLS, MODES, LIGHTNING_SECONDS, SURVIVAL_LIVES } from '../drills/index.js'
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

export default function MidiTrainer() {
  const midi = useMidiContext()

  // Built-in drills (dim7) plus any playable custom quizzes from localStorage.
  const [quizzes] = useLocalStorage(QUIZZES_KEY, [])
  const drills = useMemo(
    () => [...DRILLS, ...quizzes.filter(isPlayable).map(quizToDrill)],
    [quizzes],
  )

  const [drillId, setDrillId] = useState(DRILLS[0].id)
  const [mode, setMode] = useState('NORMAL')
  const [phase, setPhase] = useState('idle') // idle | running | done
  const [question, setQuestion] = useState(null)
  const [collected, setCollected] = useState([]) // pitch classes this attempt
  const [feedback, setFeedback] = useState(null)
  const [timeLeft, setTimeLeft] = useState(LIGHTNING_SECONDS)

  const drill = drills.find((d) => d.id === drillId) ?? drills[0]
  const [best, setBest] = useLocalStorage(`mpl.trainer.best.${drill.id}`, 0)

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
  const busyRef = useRef(false) // true during feedback pause: ignore input
  const feedbackTimer = useRef(null)
  const tick = useRef(null)
  const timeLeftRef = useRef(LIGHTNING_SECONDS)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { drillRef.current = drill }, [drill])
  useEffect(() => { bestRef.current = best }, [best])

  function commit() {
    setSession({ ...sessionRef.current })
  }

  function clearTimers() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (tick.current) clearInterval(tick.current)
    feedbackTimer.current = null
    tick.current = null
  }

  function nextQuestion() {
    const q = drillRef.current.generate(questionRef.current)
    questionRef.current = q
    setQuestion(q)
    collectedRef.current = []
    setCollected([])
    busyRef.current = false
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
    phaseRef.current = 'running'
    setPhase('running')
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

    feedbackTimer.current = setTimeout(advance, correct ? CORRECT_DELAY : WRONG_DELAY)
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
  }

  function chooseDrill(next) {
    setDrillId(next)
    drillRef.current = drills.find((d) => d.id === next) ?? drills[0]
    chooseMode(modeRef.current)
  }

  // If the selected quiz was deleted or emptied elsewhere, fall back to the
  // built-in drill so the picker and engine stay in sync.
  useEffect(() => {
    if (!drills.some((d) => d.id === drillId)) chooseDrill(drills[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drills, drillId])

  const accuracy = session.attempted > 0 ? Math.round((session.correct / session.attempted) * 100) : 0
  const extraStats = []
  if (mode === 'LIGHTNING') extraStats.push({ label: 'TIME', value: `${timeLeft}s` })
  if (mode === 'SURVIVAL') extraStats.push({ label: 'LIVES', value: session.lives ?? SURVIVAL_LIVES })

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
          <Picker
            legend="MODE"
            options={MODES.map((m) => ({ id: m.id, label: m.label }))}
            value={mode}
            onChange={chooseMode}
          />
          <p className="hint">{MODES.find((m) => m.id === mode)?.blurb}</p>

          <Stats
            score={session.score}
            streak={session.streak}
            best={best}
            correct={session.correct}
            attempted={session.attempted}
            extra={extraStats}
          />

          <div className="stage">
            {phase === 'idle' && (
              <div className="stage__idle">
                {midi.connected ? (
                  <button type="button" className="btn btn--huge" onClick={startSession}>
                    START {mode}
                  </button>
                ) : (
                  <p className="stage__msg">CONNECT A MIDI KEYBOARD TO BEGIN.</p>
                )}
              </div>
            )}

            {phase === 'running' && (
              <RunningStage question={question} collected={collected} feedback={feedback} />
            )}

            {phase === 'done' && (
              <div className="stage__done">
                <p className="stage__doneline">SESSION OVER</p>
                <p className="stage__bigscore">{session.score}</p>
                <p className="stage__msg">
                  {session.correct}/{session.attempted} · {accuracy}% ACCURACY
                </p>
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

function RunningStage({ question, collected, feedback }) {
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
