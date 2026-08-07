import { useState } from 'react'
import MidiTrainer from './MidiTrainer.jsx'
import QuizTrainer from './QuizTrainer.jsx'

const SUBVIEWS = [
  { id: 'midi', label: 'MIDI DRILL' },
  { id: 'quiz', label: 'QUIZ (NO MIDI)' },
]

export default function ChordTrainer() {
  const [sub, setSub] = useState('midi')

  return (
    <section className="trainer">
      <div className="subnav" role="group" aria-label="Trainer mode">
        {SUBVIEWS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`subnav__tab${sub === s.id ? ' is-active' : ''}`}
            aria-pressed={sub === s.id}
            onClick={() => setSub(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'midi' ? <MidiTrainer /> : <QuizTrainer />}
    </section>
  )
}
