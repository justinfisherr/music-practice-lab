import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence } from '../session/grade.js'
import { playChord, playPhrase, SILENT_HINT, unlockAudio } from '../session/audio.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import {
  allDegreesFilled,
  bluesChord,
  boogiePcs,
  bumpConfidence,
  CHORD_BAR_MS,
  CHORD_HOLD_POINTS,
  CHORD_MISS_POINTS,
  CHORD_TAIL_CAP_MS,
  CHORD_TAIL_SILENCE_MS,
  degreeRootPc,
  emptyConfidence,
  pickRapidDegree,
  rapidChordStep,
  scoreChord,
  seventhByDegree,
  seventhQuality,
  TURNAROUND_DEGREES,
} from '../session/set.js'
import ScaleLab from './ScaleLab.jsx'
import PointsPops, { usePointPops } from './PointsPops.jsx'

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
  const [listening, setListening] = useState(false)
  const [played, setPlayed] = useState([])
  const [result, setResult] = useState(null)
  const [chordRun, setChordRun] = useState(false)
  const [chordIndex, setChordIndex] = useState(0)
  const [chordClean, setChordClean] = useState(0)
  const [chordDone, setChordDone] = useState(false)
  const [chordMsg, setChordMsg] = useState('')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [confidence, setConfidence] = useState(() => emptyConfidence())
  const [rapidDegree, setRapidDegree] = useState(1)
  const [barKey, setBarKey] = useState(0)
  const [barLive, setBarLive] = useState(false)
  const [boogieId, setBoogieId] = useState(1)
  const [boogieRun, setBoogieRun] = useState(false)
  const [boogieMsg, setBoogieMsg] = useState('')
  const [boogieCleared, setBoogieCleared] = useState({})
  const [revealChord, setRevealChord] = useState(null)
  const [revealed, setRevealed] = useState(0)
  const { pops, pop } = usePointPops()
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
  const tailRef = useRef({ pending: false, capAt: 0 })
  const tailTimerRef = useRef(null)
  const revealTimerRef = useRef(null)
  const solvedRef = useRef(false)
  const chordMidiRef = useRef([])
  const rapidDegreeRef = useRef(1)
  const confidenceRef = useRef(emptyConfidence())
  const answeredRef = useRef(0)
  const barTimerRef = useRef(null)
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const bestComboRef = useRef(0)
  const correctRef = useRef(0)
  const boogieNotesRef = useRef([])
  const boogieGuardRef = useRef(false)
  const timerRef = useRef(null)
  const gradeRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const earPcs = warmup.ear.pcs
  // The turnaround keeps a fixed order; the rapid-fire prompt is drawn live.
  const sequence = TURNAROUND_DEGREES
  const chordDegree = sequence[chordIndex]
  const chordTotal = sequence.length
  const rapidFilled = allDegreesFilled(confidence)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (barTimerRef.current) clearTimeout(barTimerRef.current)
      if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
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
    setListening(true)
    setNotes([])
    setResult(null)
    setArmed(false)
    playPhrase(earPcs, { gap: 0.45 })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setListening(false)
      setArmed(true)
    }, earPcs.length * 450 + 350)
  }

  function goTo(next) {
    if (next === phase) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    setListening(false)
    stopBar()
    tailTimerRef.current = null
    revealTimerRef.current = null
    tailRef.current = { pending: false, capAt: 0 }
    solvedRef.current = false
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
    stopBar()
    chordIndexRef.current = 0
    chordCleanRef.current = 0
    chordRunRef.current = false
    chordNotesRef.current = []
    tailRef.current = { pending: false, capAt: 0 }
    solvedRef.current = false
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    tailTimerRef.current = null
    revealTimerRef.current = null
    setChordIndex(0)
    setChordClean(0)
    setChordDone(false)
    setChordMsg('')
    setRevealChord(null)
    setPlayed([])
    setBarLive(false)
    gradeRef.current = false
    if (next === 'rapid') {
      scoreRef.current = 0
      comboRef.current = 0
      bestComboRef.current = 0
      correctRef.current = 0
      answeredRef.current = 0
      confidenceRef.current = emptyConfidence()
      setScore(0)
      setCombo(0)
      setConfidence(confidenceRef.current)
      drawRapidDegree()
    }
  }

  // Draw the next chord toward whatever is still unfilled; once every degree is
  // full, the draw goes flat and the drill keeps running until MOVE ON.
  function drawRapidDegree() {
    const degree = pickRapidDegree(Math.random, confidenceRef.current)
    rapidDegreeRef.current = degree
    solvedRef.current = false
    setRapidDegree(degree)
    setChordMsg('')
    chordNotesRef.current = []
    chordMidiRef.current = []
    setPlayed([])
    setBarLive(false)
  }

  function stopBar() {
    if (barTimerRef.current) clearTimeout(barTimerRef.current)
    barTimerRef.current = null
  }

  // Every new chord tone restarts the bar from the top. When it empties the
  // prompt is scored as it stands and the drill moves on.
  function restartBar() {
    stopBar()
    setBarKey((value) => value + 1)
    setBarLive(true)
    barTimerRef.current = setTimeout(() => {
      expireRapid()
    }, CHORD_BAR_MS)
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

  // The bar is the clock: a solved chord scores once and waits for it to run
  // out. A stray note, or an empty bar on an unsolved chord, moves on.
  function solveRapid() {
    if (solvedRef.current) return
    const degree = rapidDegreeRef.current
    const rootPc = degreeRootPc(keyId, degree)
    const bassPc = chordMidiRef.current.length ? Math.min(...chordMidiRef.current) % 12 : rootPc
    const outcome = scoreChord({
      clean: true,
      combo: comboRef.current,
      inversion: bassPc !== rootPc,
    })
    recordAttempt('warmup', false)
    solvedRef.current = true
    comboRef.current = outcome.combo
    bestComboRef.current = Math.max(bestComboRef.current, outcome.combo)
    scoreRef.current += outcome.points
    answeredRef.current += 1
    correctRef.current += 1
    confidenceRef.current = bumpConfidence(confidenceRef.current, degree, true)
    setCombo(outcome.combo)
    setScore(scoreRef.current)
    setChordClean(correctRef.current)
    setConfidence(confidenceRef.current)
    pop(outcome.points, 'CLEAN')
    setChordMsg(`${ROMAN[degree - 1]} CLEAN · +${outcome.points} · KEEP COMPING +${CHORD_HOLD_POINTS}`)
    setRevealChord(null)
  }

  function awardHold() {
    scoreRef.current += CHORD_HOLD_POINTS
    setScore(scoreRef.current)
    pop(CHORD_HOLD_POINTS, 'HOLD')
  }

  function missRapid(penalty) {
    const degree = rapidDegreeRef.current
    const target = seventhByDegree(keyId, degree)
    const outcome = scoreChord({ clean: false, combo: comboRef.current, penalty })
    recordAttempt('warmup', true)
    comboRef.current = 0
    scoreRef.current = Math.max(0, scoreRef.current + outcome.points)
    answeredRef.current += 1
    confidenceRef.current = bumpConfidence(confidenceRef.current, degree, false)
    setCombo(0)
    setScore(scoreRef.current)
    setConfidence(confidenceRef.current)
    if (outcome.points) pop(outcome.points, 'SLIPPED')
    setChordMsg(`THE ${ROMAN[degree - 1]} IS ${chordFor(degree)} · NEXT`)
    setRevealChord(chordFor(degree))
    playChord(target)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setRevealChord(null), 1600)
    chordNotesRef.current = []
    chordMidiRef.current = []
    setPlayed([])
    advanceRapid()
  }

  function advanceRapid() {
    stopBar()
    setBarLive(false)
    // Hold the next chord until the player's hand stops, so the tail of a long
    // arpeggio cannot be graded against the chord that follows it.
    scheduleNextChord()
  }

  function expireRapid() {
    barTimerRef.current = null
    if (!chordRunRef.current) return
    if (solvedRef.current) advanceRapid()
    else missRapid(false)
  }

  function scheduleNextChord() {
    const now = performance.now()
    if (!tailRef.current.pending) {
      tailRef.current = { pending: true, capAt: now + CHORD_TAIL_CAP_MS }
    }
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    const wait = Math.min(CHORD_TAIL_SILENCE_MS, Math.max(0, tailRef.current.capAt - now))
    tailTimerRef.current = setTimeout(() => {
      tailTimerRef.current = null
      tailRef.current = { pending: false, capAt: 0 }
      drawRapidDegree()
    }, wait)
  }

  function handleChordNote(pc, note) {
    if (disabled || !chordRunRef.current || gradeRef.current) return
    // Still waiting for the last chord's hand to stop: swallow, keep waiting.
    if (tailRef.current.pending) {
      scheduleNextChord()
      return
    }
    if (phase === 'rapid') {
      const target = seventhByDegree(keyId, rapidDegreeRef.current)
      const step = rapidChordStep({ target, played: chordNotesRef.current, pc })
      if (step.kind === 'miss') {
        missRapid(true)
        return
      }
      // Any key on the current chord keeps the clock alive, solved or not.
      restartBar()
      if (step.kind === 'ignore') {
        // The chord is already clean: keep paying while the player comps it.
        if (target.includes(pc)) awardHold()
        return
      }
      chordNotesRef.current = step.played
      if (Number.isFinite(note)) chordMidiRef.current = [...chordMidiRef.current, note]
      setPlayed(step.played)
      if (step.solved) solveRapid()
      return
    }
    const degree = sequence[chordIndexRef.current]
    const target = seventhByDegree(keyId, degree)
    if (!target.includes(pc)) {
      finishChordPrompt(false)
      return
    }
    if (chordNotesRef.current.includes(pc)) return
    chordNotesRef.current = [...chordNotesRef.current, pc]
    setPlayed(chordNotesRef.current)
    if (chordNotesRef.current.length >= target.length) finishChordPrompt(true)
  }

  function handleChordSilence() {
    if (phase === 'rapid') return // the bar owns the timeout
    if (disabled || !chordRunRef.current || gradeRef.current || !chordNotesRef.current.length) return
    finishChordPrompt(false)
  }

  function skipChord() {
    if (phase === 'rapid') {
      stopBar()
      if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
      tailTimerRef.current = null
      tailRef.current = { pending: false, capAt: 0 }
      drawRapidDegree()
      setChordMsg('SKIPPED.')
      return
    }
    const next = chordIndexRef.current + 1
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
        total: answeredRef.current,
        confidence: [...confidenceRef.current],
        passed: allDegreesFilled(confidenceRef.current),
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
                ? 'One chord at a time, drawn toward whichever degree you are least sure of. The bar starts on your first note and every chord tone keeps it alive. A clean chord scores and you comp it until the bar runs out.'
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
                  ? rapidFilled
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
            <button type="button" className="btn btn--signal" onClick={hearEar}>
              {listening ? 'PLAYING…' : 'HEAR IT'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setRevealed((n) => Math.min(earPcs.length, n + 1))}
              disabled={revealed >= earPcs.length}
            >
              REVEAL NEXT
            </button>
          </div>
          <p className="hintline">
            {listening
              ? 'PLAYING THE FOUR NOTES.'
              : armed
                ? 'YOUR TURN — PLAY THE FOUR NOTES.'
                : 'LISTEN ONCE, THEN PLAY.'}
          </p>
          <p className="hintline">{SILENT_HINT}</p>
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
                <button type="button" className="btn" onClick={hearEar}>
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
            <PointsPops pops={pops} />
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
              {rapidFilled ? (
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
                  {chordClean} CLEAN · {confidence.filter((value) => value >= 1).length} OF 7 DEGREES FULL
                </span>
                <span className="rapidprompt__chord">{chordFor(rapidDegree)}</span>
                <span className="rapidprompt__sub">
                  {ROMAN[rapidDegree - 1]} · 7TH CHORD · {seventhByDegree(keyId, rapidDegree).length} NOTES
                </span>
                {revealChord ? (
                  <div className="rapidreveal">
                    <span className="rapidreveal__label">THE CHORD WAS</span>
                    <span className="rapidreveal__chord">{revealChord}</span>
                    <span className="rapidreveal__hint">HEARD IT · NEXT CHORD IS UP</span>
                  </div>
                ) : null}
              </div>
              <ChordBar runKey={barKey} live={barLive} />
              <div className="confidence" aria-label="Confidence by chord degree">
                {confidence.map((value, index) => (
                  <div
                    className={`confidence__item${value >= 1 ? ' is-full' : ''}`}
                    key={ROMAN[index]}
                  >
                    <span className="confidence__roman">{ROMAN[index]}</span>
                    <span className="confidence__track">
                      <span
                        className="confidence__fill"
                        style={{ height: `${Math.round(value * 100)}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <div className="rapidbar">
                <span>CHORD TONES RESET THE BAR</span>
                <span>A SLIPPED NOTE COSTS {Math.abs(CHORD_MISS_POINTS)}</span>
              </div>
              <p className="hintline">
                {chordMsg ||
                  (barLive
                    ? 'KEEP COMPING — THE BAR RUNS OUT TO MOVE ON.'
                    : 'PLAY THE CHORD TO START THE BAR.')}
              </p>
              <div className="stagefoot">
                <button type="button" className="btn" onClick={skipChord} disabled={disabled}>
                  SKIP
                </button>
                {rapidFilled ? (
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
              <button type="button" className="btn" onClick={hearBoogie}>
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

// The bar is the visible clock for a rapid-fire prompt. It drains from full to
// empty; every state change of runKey restarts it from the top.
function ChordBar({ runKey, live }) {
  const [percent, setPercent] = useState(100)

  useEffect(() => {
    if (!live) {
      setPercent(100)
      return undefined
    }
    const start = performance.now()
    const timer = setInterval(() => {
      const left = 1 - (performance.now() - start) / CHORD_BAR_MS
      setPercent(Math.max(0, Math.round(left * 100)))
    }, 50)
    return () => clearInterval(timer)
  }, [runKey, live])

  return (
    <div
      className={`chordbar${live ? ' is-live' : ''}`}
      aria-hidden="true"
    >
      <span className="chordbar__fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
