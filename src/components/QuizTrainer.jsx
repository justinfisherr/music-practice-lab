import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { CHORDS, FAMILIES, randomItem } from '../data/diminishedChords.js'
import Stats from './Stats.jsx'

const QUIZ_TYPES = [
  { id: 'name-notes', label: 'NAME → NOTES' },
  { id: 'notes-name', label: 'NOTES → NAME' },
  { id: 'name-family', label: 'NAME → FAMILY' },
  { id: 'mixed', label: 'MIXED' },
]

const TIMER_OPTIONS = [
  { id: 0, label: 'OFF' },
  { id: 5, label: '5S' },
  { id: 10, label: '10S' },
  { id: 15, label: '15S' },
]

const REVEAL_DELAY = 1300

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Build one multiple-choice question. Distractors are always pulled from OTHER
// families so exactly one option is correct (dim7 note-sets repeat within a
// family, which would otherwise make "notes → name" ambiguous).
function makeQuestion(type) {
  const kind = type === 'mixed' ? randomItem([{ id: 'name-notes' }, { id: 'notes-name' }, { id: 'name-family' }]).id : type
  const chord = randomItem(CHORDS)
  const otherFamilyChords = CHORDS.filter((c) => c.family !== chord.family)

  if (kind === 'name-family') {
    const options = FAMILIES.map((f) => ({
      key: `f${f.id}`,
      text: f.label,
      correct: f.id === chord.family,
    }))
    return { kind, promptLabel: 'FAMILY OF', prompt: chord.name, options: shuffle(options) }
  }

  if (kind === 'notes-name') {
    const distractors = shuffle(otherFamilyChords).slice(0, 3)
    const options = shuffle([
      { key: chord.name, text: chord.name, correct: true },
      ...distractors.map((c) => ({ key: c.name, text: c.name, correct: false })),
    ])
    return { kind, promptLabel: 'NAME THE CHORD', prompt: chord.notes.join('  '), options }
  }

  // name-notes
  const distractors = shuffle(otherFamilyChords).slice(0, 3)
  const options = shuffle([
    { key: chord.name, text: chord.notes.join(' · '), correct: true },
    ...distractors.map((c) => ({ key: c.name, text: c.notes.join(' · '), correct: false })),
  ])
  return { kind, promptLabel: 'NOTES OF', prompt: chord.name, options }
}

const FRESH = { score: 0, correct: 0, attempted: 0, streak: 0, best: 0 }

export default function QuizTrainer() {
  const [type, setType] = useState('mixed')
  const [timer, setTimer] = useState(0)
  const [stats, setStats] = useLocalStorage('mpl.quiz.stats', FRESH)
  const [question, setQuestion] = useState(() => makeQuestion('mixed'))
  const [answered, setAnswered] = useState(null) // { pickedKey }
  const [timeLeft, setTimeLeft] = useState(0)

  const typeRef = useRef(type)
  const timerRef = useRef(timer)
  const advanceTimer = useRef(null)
  const tick = useRef(null)
  const timeLeftRef = useRef(0)

  useEffect(() => { typeRef.current = type }, [type])
  useEffect(() => { timerRef.current = timer }, [timer])

  function clearTimers() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    if (tick.current) clearInterval(tick.current)
    advanceTimer.current = null
    tick.current = null
  }

  function loadNext() {
    clearTimers()
    setAnswered(null)
    const q = makeQuestion(typeRef.current)
    setQuestion(q)
    if (timerRef.current > 0) startCountdown()
  }

  function startCountdown() {
    timeLeftRef.current = timerRef.current
    setTimeLeft(timerRef.current)
    tick.current = setInterval(() => {
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) resolve(null) // ran out of time = wrong
    }, 1000)
  }

  function resolve(pickedKey) {
    if (answered) return
    clearTimers()
    const opt = pickedKey ? question.options.find((o) => o.key === pickedKey) : null
    const isCorrect = !!opt?.correct
    setAnswered({ pickedKey })
    setStats((prev) => {
      const streak = isCorrect ? prev.streak + 1 : 0
      return {
        score: prev.score + (isCorrect ? 1 : 0),
        correct: prev.correct + (isCorrect ? 1 : 0),
        attempted: prev.attempted + 1,
        streak,
        best: Math.max(prev.best, streak),
      }
    })
    advanceTimer.current = setTimeout(loadNext, REVEAL_DELAY)
  }

  // Restart the round whenever type or timer changes.
  function chooseType(next) {
    setType(next)
    typeRef.current = next
    clearTimers()
    setAnswered(null)
    setQuestion(makeQuestion(next))
    if (timerRef.current > 0) startCountdown()
  }

  function chooseTimer(next) {
    setTimer(next)
    timerRef.current = next
    clearTimers()
    setAnswered(null)
    setQuestion(makeQuestion(typeRef.current))
    if (next > 0) startCountdown()
  }

  function resetStats() {
    setStats(FRESH)
  }

  useEffect(() => clearTimers, [])

  return (
    <div className="quiz">
      <p className="hint">No MIDI needed — pick the right answer.</p>

      <Picker legend="QUIZ" options={QUIZ_TYPES} value={type} onChange={chooseType} />
      <Picker legend="TIMER" options={TIMER_OPTIONS} value={timer} onChange={chooseTimer} />

      <Stats
        score={stats.score}
        streak={stats.streak}
        best={stats.best}
        correct={stats.correct}
        attempted={stats.attempted}
        extra={timer > 0 ? [{ label: 'TIME', value: `${timeLeft}s` }] : []}
      />

      <div className="quizcard">
        <span className="target__label">{question.promptLabel}</span>
        <span className="target__value">{question.prompt}</span>

        <div className="options">
          {question.options.map((o) => {
            let cls = 'optionbtn'
            if (answered) {
              if (o.correct) cls += ' optionbtn--correct'
              else if (o.key === answered.pickedKey) cls += ' optionbtn--wrong'
            }
            return (
              <button
                key={o.key}
                type="button"
                className={cls}
                disabled={!!answered}
                onClick={() => resolve(o.key)}
              >
                {o.text}
              </button>
            )
          })}
        </div>

        {answered && (
          <p className="quizcard__verdict">
            {question.options.find((o) => o.key === answered.pickedKey)?.correct
              ? 'CORRECT'
              : answered.pickedKey
                ? 'WRONG'
                : "TIME'S UP"}
          </p>
        )}
      </div>

      <button type="button" className="btn btn--ghost" onClick={resetStats}>
        RESET QUIZ STATS
      </button>
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
