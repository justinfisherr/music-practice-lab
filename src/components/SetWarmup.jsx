import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence, gradeSet } from '../session/grade.js'
import { playChord, playPhrase, unlockAudio } from '../session/audio.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import {
  bluesChord,
  boogiePcs,
  degreeRootPc,
  seventhByDegree,
  seventhQuality,
  RAPID_COUNT,
  RAPID_TARGET_SCORE,
  rapidPrompts,
  scoreRapidFire,
  TURNAROUND_DEGREES,
} from '../session/set.js'
import ScaleLab from './ScaleLab.jsx'

const SUFFIX = { maj7: 'maj7', min7: 'm7', dom7: '7', halfDim: 'ø7' }
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const BOOGIE_ROMAN = { 1: 'I7', 4: 'IV7', 5: 'V7' }
const WARMUP_SECTIONS = [
  { id: 'lab', label: 'SCALE LAB' },
  { id: 'ear', label: 'EAR' },
  { id: 'rapid', label: 'CHORDS' },
  { id: 'turnaround', label: 'TURNAROUND' },
]

export default function SetWarmup({ session, onDone, disabled, recordAttempt }) {
  const keyId = session.keyId
  const warmup = session.composition.stages[0].detail
  const [phase, setPhase] = useState('lab')
  const [armed, setArmed] = useState(false)
  const [played, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const [chordRun, setChordRun] = useState(false)
  const [chordIndex, setChordIndex] = useState(0)
  const [chordClean, setChordClean] = useState(0)
  const [chordDone, setChordDone] = useState(false)
  const [chordMsg, setChordMsg] = useState('')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [rapidPassed, setRapidPassed] = useState(false)
  const [boogieId, setBoogieId] = useState(1)
  const [boogieRun, setBoogieRun] = useState(false)
  const [boogieMsg, setBoogieMsg] = useState('')
  const [boogieCleared, setBoogieCleared] = useState({})
  const [revealChord, setRevealChord] = useState(null)
  const [revealed, setRevealed] = useState(0)
  const playedRef = useRef([])
  const passedRef = useRef({ ear: false })
  const labRef = useRef(null)
  const turnaroundRef = useRef({
    clean: 0,
    total: TURNAROUND_DEGREES.length,
    passed: false,
  })
  const chordIndexRef = useRef(0)
  const chordCleanRef = useRef(0)
  const chordRunRef = useRef(false)
  const chordNotesRef = useRef([])
  const chordArmedRef = useRef(true)
  const chordMidiRef = useRef([])
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const bestComboRef = useRef(0)
  const correctRef = useRef(0)
  const promptAtRef = useRef(0)
  const prevBassRef = useRef(null)
  const boogieNotesRef = useRef([])
  const boogieGuardRef = useRef(false)
  const timerRef = useRef(null)
  const gradeRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const earPcs = warmup.ear.pcs
  // Older saved runs stored six ordered prompts; regenerate the forty.
  const prompts =
    warmup.rapid.prompts?.length === RAPID_COUNT
      ? warmup.rapid.prompts
      : rapidPrompts(session.seed, keyId, RAPID_COUNT)
  const sequence = phase === 'turnaround' ? TURNAROUND_DEGREES : prompts
  const chordDegree = sequence[chordIndex]
  const chordTotal = sequence.length

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

  function gradeEar(notes) {
    if (gradeRef.current) return
    gradeRef.current = true
    const diff = gradeSequence(earPcs, notes)
    recordAttempt('warmup', !diff.passed)
    if (diff.passed) passedRef.current.ear = true
    setArmed(false)
    setResult({ passed: diff.passed, kind: 'ear', rows: diff.rows })
    if (!diff.passed) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (disabledRef.current) return
        setResult(null)
        setNotes([])
        hearEar()
      }, 1400)
    }
    gradeRef.current = false
  }

  function hearEar() {
    unlockAudio()
    setNotes([])
    setResult(null)
    setArmed(false)
    playPhrase(earPcs, { gap: 0.45 })
    timerRef.current = setTimeout(() => setArmed(true), earPcs.length * 450 + 350)
  }

  function goTo(next) {
    if (next === phase) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setArmed(false)
    setChordRun(false)
    chordRunRef.current = false
    setBoogieRun(false)
    setResult(null)
    setRevealed(0)
    setNotes([])
    chordNotesRef.current = []
    boogieNotesRef.current = []
    setPhase(next)
  }

  function nextPhase() {
    setRevealed(0)
    setNotes([])
    setResult(null)
    setArmed(false)
    setPhase('rapid')
  }

  function handleNote(pc) {
    if (disabled || !armed) return
    const next = [...playedRef.current, pc]
    setNotes(next)
    if (next.length >= earPcs.length) gradeEar(next)
  }

  function handleSilence() {
    if (disabled || !armed || !playedRef.current.length) return
    gradeEar(playedRef.current)
  }

  useNoteSequence({
    active: phase === 'ear' && armed && !disabled,
    onNote: handleNote,
    onSilence: handleSilence,
  })

  // ---- chord phases: six in order, then the I–vi–ii–V turnaround ----------
  function chordFor(degree) {
    return `${noteName(degreeRootPc(keyId, degree))}${SUFFIX[seventhQuality(degree)]}`
  }

  function resetChordState(next = phase) {
    chordIndexRef.current = 0
    chordCleanRef.current = 0
    chordRunRef.current = false
    chordNotesRef.current = []
    chordArmedRef.current = true
    setChordIndex(0)
    setChordClean(0)
    setChordDone(false)
    setChordMsg('')
    setRevealChord(null)
    setPlayed([])
    gradeRef.current = false
    if (next === 'rapid') {
      scoreRef.current = 0
      comboRef.current = 0
      bestComboRef.current = 0
      correctRef.current = 0
      prevBassRef.current = null
      setScore(0)
      setCombo(0)
      setRapidPassed(false)
      promptAtRef.current = performance.now()
    }
  }

  function startChords(next = phase) {
    unlockAudio()
    if (next !== phase) setPhase(next)
    resetChordState(next)
    chordRunRef.current = true
    setChordRun(true)
  }

  function finishChordRun(clean) {
    const total = sequence.length
    const passed = clean === total
    if (phase === 'turnaround') turnaroundRef.current = { clean, total, passed }
    setChordDone(true)
  }

  function finishChordPrompt(correct) {
    if (gradeRef.current) return
    gradeRef.current = true
    const index = chordIndexRef.current
    const degree = sequence[index]
    const target = seventhByDegree(keyId, degree)
    recordAttempt('warmup', !correct)

    if (phase === 'rapid') {
      if (correct) {
        const elapsed = performance.now() - promptAtRef.current
        const bassPc = chordMidiRef.current.length
          ? Math.min(...chordMidiRef.current) % 12
          : degreeRootPc(keyId, degree)
        const inversion = bassPc !== degreeRootPc(keyId, degree)
        const changed = prevBassRef.current != null && bassPc !== prevBassRef.current
        prevBassRef.current = bassPc
        const outcome = scoreRapidFire({
          correct: true,
          elapsedMs: elapsed,
          combo: comboRef.current,
          inversion,
          changed,
        })
        comboRef.current = outcome.combo
        bestComboRef.current = Math.max(bestComboRef.current, outcome.combo)
        scoreRef.current += outcome.score
        correctRef.current += 1
        setCombo(outcome.combo)
        setScore(scoreRef.current)
        setChordClean(correctRef.current)
        if (scoreRef.current >= RAPID_TARGET_SCORE) setRapidPassed(true)
        setChordMsg(
          outcome.bonus
            ? `CLEAN · +${outcome.score} · VOICING +${outcome.bonus}`
            : `CLEAN · +${outcome.score}`,
        )
        setRevealChord(null)
        chordNotesRef.current = []
        chordMidiRef.current = []
        setPlayed([])
        gradeRef.current = false
        const next = index + 1
        if (next >= sequence.length) {
          chordRunRef.current = false
          setChordRun(false)
          return
        }
        chordIndexRef.current = next
        setChordIndex(next)
        promptAtRef.current = performance.now()
        chordArmedRef.current = false
        setTimeout(() => {
          chordArmedRef.current = true
        }, 350)
        return
      }
      // Wrong: reveal and play the chord, then retry the same degree.
      comboRef.current = 0
      setCombo(0)
      const label = chordFor(degree)
      setRevealChord(label)
      playChord(target)
      setChordMsg(`THE ${ROMAN[degree - 1]} IS ${label}. TRY IT AGAIN.`)
      chordNotesRef.current = []
      chordMidiRef.current = []
      setPlayed([])
      promptAtRef.current = performance.now()
      gradeRef.current = false
      return
    }

    if (correct) {
      const clean = chordCleanRef.current + 1
      const next = index + 1
      chordCleanRef.current = clean
      setChordClean(clean)
      chordIndexRef.current = next
      setChordIndex(next)
      setRevealChord(null)
      setChordMsg(clean === sequence.length ? 'ALL CLEAN.' : 'CLEAN.')
      chordNotesRef.current = []
      setPlayed([])
      gradeRef.current = false
      // Let the last note of the passed chord settle before grading the next one.
      chordArmedRef.current = false
      setTimeout(() => {
        chordArmedRef.current = true
      }, 350)
      if (next >= sequence.length) {
        chordRunRef.current = false
        setChordRun(false)
        finishChordRun(clean)
      }
      return
    }
    // Wrong: reveal and play the chord, then let them try the same degree again.
    const label = chordFor(degree)
    setRevealChord(label)
    playChord(target)
    setChordMsg(`THE ${degree} IS ${label}. LISTEN, THEN TRY IT AGAIN.`)
    chordNotesRef.current = []
    setPlayed([])
    gradeRef.current = false
  }

  function handleChordNote(pc, note) {
    if (disabled || !chordRunRef.current || !chordArmedRef.current || gradeRef.current) return
    const degree = sequence[chordIndexRef.current]
    chordNotesRef.current = [...chordNotesRef.current, pc]
    if (Number.isFinite(note)) chordMidiRef.current = [...chordMidiRef.current, note]
    setPlayed(chordNotesRef.current)
    const target = seventhByDegree(keyId, degree)
    if (gradeSet(target, chordNotesRef.current).passed) finishChordPrompt(true)
    else if (chordNotesRef.current.length >= 4) finishChordPrompt(false)
  }

  function handleChordSilence() {
    if (disabled || !chordRunRef.current || gradeRef.current || !chordNotesRef.current.length) return
    finishChordPrompt(false)
  }

  function skipChord() {
    const next = chordIndexRef.current + 1
    if (phase === 'rapid') {
      comboRef.current = 0
      setCombo(0)
      promptAtRef.current = performance.now()
    }
    setRevealChord(null)
    setChordMsg('SKIPPED.')
    chordNotesRef.current = []
    setPlayed([])
    chordIndexRef.current = next
    setChordIndex(next)
    if (next >= sequence.length) {
      chordRunRef.current = false
      setChordRun(false)
      finishChordRun(chordCleanRef.current)
    }
  }

  function finishWarmup() {
    onDone({
      lab: labRef.current || {
        passed: false,
        homesPlayed: [],
        callsCorrect: 0,
        callsTotal: 6,
      },
      ear: { passed: passedRef.current.ear },
      rapid: {
        score: scoreRef.current,
        bestCombo: bestComboRef.current,
        correct: correctRef.current,
        total: prompts.length,
        target: RAPID_TARGET_SCORE,
        passed: scoreRef.current >= RAPID_TARGET_SCORE,
        prompts: [...prompts],
      },
      turnaround: turnaroundRef.current,
    })
  }

  useNoteSequence({
    active: (phase === 'rapid' || phase === 'turnaround') && chordRun && !disabled,
    onNote: handleChordNote,
    onSilence: handleChordSilence,
  })

  // ---- boogie drill, inside the turnaround phase --------------------------
  const boogieLabel = bluesChord(keyId, boogieId).label
  const boogieFigure = boogiePcs(keyId, boogieId).map(noteName)

  function hearBoogie() {
    unlockAudio()
    playPhrase(boogiePcs(keyId, boogieId), { gap: 0.22 })
    setBoogieMsg(`HEAR ${boogieLabel}.`)
  }

  function startBoogie() {
    unlockAudio()
    boogieNotesRef.current = []
    boogieGuardRef.current = false
    setBoogieRun(true)
    setBoogieMsg('EIGHT NOTES, ONE BAR, IN ORDER.')
  }

  function gradeBoogie(notes) {
    if (boogieGuardRef.current) return
    boogieGuardRef.current = true
    const diff = gradeSequence(boogiePcs(keyId, boogieId), notes)
    recordAttempt('warmup', !diff.passed)
    setBoogieRun(false)
    if (diff.passed) {
      setBoogieCleared((value) => ({ ...value, [boogieId]: true }))
      setBoogieMsg(`${boogieLabel} BOOGIE CLEAR.`)
    } else {
      setBoogieMsg('NOT QUITE. THE NOTES ARE ABOVE. TRY IT AGAIN.')
    }
    boogieGuardRef.current = false
  }

  function handleBoogieNote(pc) {
    if (disabled || !boogieRun) return
    const next = [...boogieNotesRef.current, pc]
    boogieNotesRef.current = next
    if (next.length >= 8) gradeBoogie(next)
  }

  useNoteSequence({
    active: phase === 'turnaround' && boogieRun && !disabled,
    onNote: handleBoogieNote,
    onSilence: () => {
      if (boogieNotesRef.current.length) gradeBoogie(boogieNotesRef.current)
    },
    allowRepeats: true,
  })

  return (
    <div className="stagecard setwarmup">
      <div className="stagehead">
        <span className="stagehead__eyebrow">
          STAGE 1 OF 2 · {keyDisplay(keyId)} MAJOR · SCALE LAB · EAR · CHORDS · TURNAROUND
        </span>
        <h2 className="stagehead__title">
          {phase === 'lab'
            ? 'SCALE LAB'
            : phase === 'ear'
              ? 'EAR'
              : phase === 'rapid'
                ? 'CHORDS'
                : 'TURNAROUND'}
        </h2>
        <p className="stagehead__copy">
          {phase === 'lab'
            ? 'Three homes on one keyboard: major, relative minor, blues. Play all three, then call degrees by ear.'
            : phase === 'ear'
              ? 'Four notes. Hear them once, then play them back in order.'
              : phase === 'rapid'
                ? 'Six seventh chords by degree, in order: I ii iii IV V vi. Play all six clean to move on.'
                : 'I–vi–ii–V. The chord names stay on screen. Comp each one clean to move on.'}
        </p>
      </div>

      <div className="jamchips" role="group" aria-label="Warm-up section">
        {WARMUP_SECTIONS.map((section) => {
          const done =
            section.id === 'lab'
              ? Boolean(labRef.current?.passed)
              : section.id === 'ear'
                ? passedRef.current.ear
                : section.id === 'rapid'
                  ? rapidPassed
                  : turnaroundRef.current.passed
          return (
            <button
              key={section.id}
              type="button"
              className={`jamchip${phase === section.id ? ' is-on' : ''}`}
              aria-pressed={phase === section.id}
              onClick={() => goTo(section.id)}
              disabled={disabled}
            >
              {section.label}
              {done ? ' · CLEAR' : ''}
            </button>
          )
        })}
      </div>

      {phase === 'lab' ? (
        <ScaleLab
          keyId={keyId}
          disabled={disabled}
          recordAttempt={recordAttempt}
          onContinue={(lab) => {
            labRef.current = lab
            setPhase('ear')
          }}
        />
      ) : null}

      {phase === 'ear' ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={hearEar} disabled={disabled}>
              HEAR IT
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setRevealed((n) => Math.min(earPcs.length, n + 1))}
              disabled={disabled || revealed >= earPcs.length}
            >
              REVEAL NEXT
            </button>
          </div>
          <p className="hintline">
            {armed ? 'YOUR TURN — PLAY THE FOUR NOTES.' : 'LISTEN ONCE, THEN PLAY.'}
          </p>
          <div className="notecells" aria-label="Ear notes">
            {earPcs.map((pc, index) => {
              const playedPc = played[index]
              const correct = playedPc != null && playedPc === pc
              const wrong = playedPc != null && playedPc !== pc
              return (
                <div
                  className={`notecell ${playedPc == null ? 'is-pending' : correct ? 'is-match' : 'is-off'}`}
                  key={index}
                >
                  <span className="notecell__index">{index + 1}</span>
                  <span className="notecell__note">
                    {correct || (playedPc == null && index < revealed)
                      ? noteName(pc)
                      : wrong
                        ? noteName(playedPc)
                        : '·'}
                  </span>
                  <span className="notecell__mark">
                    {correct ? 'HIT' : wrong ? 'OFF' : index < revealed ? 'HINT' : 'PLAY'}
                  </span>
                </div>
              )
            })}
          </div>
          {result ? (
            <p className={`verdictline ${result.passed ? 'verdictline--ok' : 'verdictline--bad'}`}>
              {result.passed ? 'EAR CLEAR.' : 'NOT QUITE — LISTEN AGAIN.'}
            </p>
          ) : null}
          {result ? (
            <div className="stagefoot">
              <button
                type="button"
                className="btn btn--signal"
                onClick={nextPhase}
                disabled={!result.passed}
              >
                NEXT · CHORDS
              </button>
              {!result.passed ? (
                <button type="button" className="btn" onClick={hearEar} disabled={disabled}>
                  LISTEN AGAIN
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {phase === 'rapid' ? (
        <>
          <div className="rapid">
            <div className="rapid__score">
              <span className="rapid__label">SCORE</span>
              <span className="rapid__value">{score}</span>
            </div>
            <div className="rapid__combo">
              <span className="rapid__label">COMBO</span>
              <span className="rapid__value">×{combo}</span>
            </div>
            <div className="rapid__count">
              <span className="rapid__label">CLEAN</span>
              <span className="rapid__value">{chordClean}</span>
            </div>
          </div>
          {!chordRun ? (
            <div className="stagefoot">
              <button
                type="button"
                className="btn btn--signal"
                onClick={() => startChords('rapid')}
                disabled={disabled}
              >
                {score ? 'RAPID FIRE AGAIN' : 'START RAPID FIRE'}
              </button>
              {rapidPassed ? (
                <button
                  type="button"
                  className="btn btn--signal"
                  onClick={() => startChords('turnaround')}
                  disabled={disabled}
                >
                  MOVE ON · TURNAROUND
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="rapidprompt">
                <span className="rapidprompt__play">
                  {chordClean} CLEAN · TARGET {RAPID_TARGET_SCORE}
                </span>
                <span className="rapidprompt__chord">{chordFor(chordDegree)}</span>
                <span className="rapidprompt__sub">
                  {ROMAN[chordDegree - 1]} · 7TH CHORD · {seventhByDegree(keyId, chordDegree).length} NOTES
                </span>
                {revealChord ? (
                  <div className="rapidreveal">
                    <span className="rapidreveal__label">THE CHORD WAS</span>
                    <span className="rapidreveal__chord">{revealChord}</span>
                    <span className="rapidreveal__hint">PLAY IT TO CONTINUE</span>
                  </div>
                ) : null}
              </div>
              <div className="rapidbar">
                <span>FAST ADDS, SLOW NEVER TAXES</span>
                <span>INVERSION BASS BONUS</span>
              </div>
              <p className="hintline">{chordMsg || 'PLAY THE CHORD WHEN READY.'}</p>
              <div className="stagefoot">
                <button type="button" className="btn" onClick={skipChord} disabled={disabled}>
                  SKIP
                </button>
                {rapidPassed ? (
                  <button
                    type="button"
                    className="btn btn--signal"
                    onClick={() => startChords('turnaround')}
                    disabled={disabled}
                  >
                    MOVE ON · TURNAROUND
                  </button>
                ) : null}
              </div>
            </>
          )}
        </>
      ) : null}

      {phase === 'turnaround' ? (
        <>
          <div className="scalelab__block">
            <span className="pianoexample__label">BOOGIE · {boogieLabel}</span>
            <div className="jamchips" role="group" aria-label="Boogie chord">
              {[1, 4, 5].map((degree) => (
                <button
                  key={degree}
                  type="button"
                  className={`jamchip${boogieId === degree ? ' is-on' : ''}`}
                  aria-pressed={boogieId === degree}
                  onClick={() => {
                    setBoogieId(degree)
                    setBoogieRun(false)
                    boogieNotesRef.current = []
                    setBoogieMsg('')
                  }}
                  disabled={disabled}
                >
                  {BOOGIE_ROMAN[degree]} · {bluesChord(keyId, degree).label}
                  {boogieCleared[degree] ? ' · CLEAR' : ''}
                </button>
              ))}
            </div>
            <div className="notecells" aria-label="Boogie figure">
              {boogieFigure.map((name, index) => (
                <div className="notecell" key={index}>
                  <span className="notecell__index">{index + 1}</span>
                  <span className="notecell__note">{name}</span>
                </div>
              ))}
            </div>
            <div className="stagefoot">
              <button type="button" className="btn" onClick={hearBoogie} disabled={disabled}>
                HEAR THE BOOGIE
              </button>
              <button
                type="button"
                className={`btn${boogieRun ? ' btn--signal' : ''}`}
                onClick={startBoogie}
                disabled={disabled}
              >
                PLAY THE BOOGIE
              </button>
            </div>
            <p className="hintline">{boogieMsg || 'ROOT · 3 · 5 · 6 · ♭7 · 6 · 5 · 3'}</p>
          </div>
          <div className="rapidbar">
            <span>{chordClean} OF {chordTotal} CLEAN</span>
            <span>I · vi · ii · V</span>
          </div>
          {!chordRun ? (
            <div className="stagefoot">
              {chordDone && turnaroundRef.current.passed ? (
                <button
                  type="button"
                  className="btn btn--signal"
                  onClick={finishWarmup}
                  disabled={disabled}
                >
                  MOVE ON · CHANGES
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--signal"
                  onClick={() => startChords('turnaround')}
                  disabled={disabled}
                >
                  {chordDone ? 'TRY AGAIN' : 'START TURNAROUND'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="rapidprompt">
                <span className="rapidprompt__play">
                  {chordClean} OF {chordTotal} · PLAY
                </span>
                <span className="rapidprompt__chord">{chordFor(chordDegree)}</span>
                <span className="rapidprompt__sub">
                  {ROMAN[chordDegree - 1]} · 7TH CHORD · {seventhByDegree(keyId, chordDegree).length} NOTES
                </span>
              </div>
              <p className="hintline">{chordMsg || 'COMP THE CHORD. THE NAME STAYS UP.'}</p>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
