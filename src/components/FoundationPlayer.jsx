import { useEffect, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { playChord, playPhrase, unlockAudio } from '../session/audio.js'
import { gradeSequence, gradeSet } from '../session/grade.js'
import { noteName } from '../data/diminishedChords.js'
import PianoExample from './PianoExample.jsx'

function playExample(pcs, kind) {
  unlockAudio()
  if (kind === 'set') playChord(pcs)
  else playPhrase(pcs, { gap: 0.45 })
}

export default function FoundationPlayer({ lesson, learned, onLearned }) {
  const midi = useMidiContext()
  const kind = lesson.play.kind === 'set' ? 'set' : 'sequence'
  const expected = lesson.play.pcs || []
  const [playPhase, setPlayPhase] = useState('idle')
  const [played, setPlayed] = useState([])
  const [playResult, setPlayResult] = useState(null)
  const [answers, setAnswers] = useState({})
  const playedRef = useRef([])

  const allCorrect = lesson.checks.every((check, index) => answers[index] === check.answer)
  const complete = learned || allCorrect

  useEffect(() => {
    if (allCorrect && !learned) onLearned(lesson.id)
  }, [allCorrect, learned, lesson.id, onLearned])

  function grade(notes) {
    const diff = kind === 'set' ? gradeSet(expected, notes) : gradeSequence(expected, notes)
    setPlayResult({ ...diff, kind })
    setPlayPhase('result')
  }

  function handleNote(pc) {
    if (playPhase !== 'listening') return
    const next = [...playedRef.current, pc]
    playedRef.current = next
    setPlayed(next)
    if (next.length >= expected.length) grade(next)
  }

  function handleSilence() {
    if (playPhase !== 'listening' || !playedRef.current.length) return
    grade(playedRef.current)
  }

  useNoteSequence({
    active: playPhase === 'listening',
    allowRepeats: kind === 'sequence',
    onNote: handleNote,
    onSilence: handleSilence,
  })

  function hearDemo() {
    setPlayPhase('idle')
    setPlayed([])
    playedRef.current = []
    setPlayResult(null)
    playExample(lesson.demo.pcs, lesson.demo.kind)
  }

  function startPlay() {
    setPlayed([])
    playedRef.current = []
    setPlayResult(null)
    setPlayPhase('listening')
    unlockAudio()
  }

  function answer(index, option) {
    setAnswers((current) => ({ ...current, [index]: option }))
  }

  return (
    <div className="foundationplayer">
      <p className="foundationplayer__definition">{lesson.definition}</p>

      <div className="foundationplayer__block">
        <span className="pianoexample__label">{lesson.demo.label}</span>
        <PianoExample pcs={lesson.demo.pcs} accentPc={lesson.demo.pcs[0]} label={lesson.demo.label} />
        <div className="foundationplayer__actions">
          <button type="button" className="btn" onClick={hearDemo}>
            HEAR IT
          </button>
          <button type="button" className="btn btn--signal" onClick={startPlay}>
            {playPhase === 'result' ? 'PLAY IT AGAIN' : 'PLAY IT'}
          </button>
        </div>
      </div>

      <div className="foundationplayer__block">
        <span className="foundationplayer__label">PLAY IT · {lesson.play.label}</span>
        <div className="notecells" aria-label="Notes you play">
          {expected.map((pc, index) => {
            const got = played[index]
            const state = got == null ? 'is-pending' : got === pc ? 'is-match' : 'is-off'
            return (
              <div className={`notecell ${state}`} key={`${pc}-${index}`}>
                <span className="notecell__index">{index + 1}</span>
                <span className="notecell__note">{got == null ? noteName(pc) : noteName(got)}</span>
                <span className="notecell__mark">
                  {got == null ? 'PLAY' : got === pc ? 'HIT' : 'OFF'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="hintline" aria-live="polite">
          {playPhase === 'listening'
            ? `LISTENING · ${played.length} OF ${expected.length}`
            : playPhase === 'result'
              ? playResult?.passed
                ? 'LINE CLEAR.'
                : 'NOT YET. HEAR IT, THEN TRY AGAIN.'
              : 'PLAY IT FOR PRACTICE. THE CHECKS BELOW MARK THE LESSON LEARNED.'}
        </p>
        {!midi.supported ? (
          <p className="hintline">NO WEB MIDI HERE — THE CHECKS STILL COUNT.</p>
        ) : !midi.connected ? (
          <p className="hintline">CONNECT A MIDI KEYBOARD IN SESSION TO PLAY IT.</p>
        ) : null}
      </div>

      <div className="foundationplayer__block">
        <span className="foundationplayer__label">THREE CHECKS</span>
        <div className="foundationchecks">
          {lesson.checks.map((check, index) => {
            const chosen = answers[index]
            const right = chosen === check.answer
            return (
              <div className="foundationcheck" key={check.q}>
                <p className="foundationcheck__q">
                  {index + 1}. {check.q}
                </p>
                <div className="foundationcheck__options">
                  {check.options.map((option, optionIndex) => (
                    <button
                      type="button"
                      key={option}
                      className={`chipbtn${chosen === optionIndex ? (right ? ' is-correct' : ' is-wrong') : ''}`}
                      aria-pressed={chosen === optionIndex}
                      onClick={() => answer(index, optionIndex)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {chosen != null ? (
                  <span className={`foundationcheck__state${right ? ' is-correct' : ' is-wrong'}`}>
                    {right ? 'CORRECT' : 'TRY AGAIN'}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className={`foundationplayer__status${complete ? ' is-learned' : ''}`}>
          {complete ? 'LEARNED — ALL THREE CHECKS CLEAR.' : 'ANSWER ALL THREE TO MARK IT LEARNED.'}
        </p>
      </div>
    </div>
  )
}
