import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence } from '../session/grade.js'
import { playChord, playPhrase, SILENT_HINT, unlockAudio } from '../session/audio.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import {
  allDegreesFilled,
  buildJamDegrees,
  bumpConfidence,
  bumpMeter,
  CHORD_BAR_MS,
  CHORD_HOLD_POINTS,
  CHORD_MISS_POINTS,
  CHORD_TAIL_CAP_MS,
  CHORD_TAIL_SILENCE_MS,
  degreeRootPc,
  emptyConfidence,
  INVERSION_BONUS,
  INVERSION_BONUS_NEW,
  inversionBonus,
  metersFilled,
  nextBarIndex,
  pickRapidDegree,
  PLAY_CHANGES,
  rapidChordStep,
  scoreChord,
  seventhByDegree,
  seventhQuality,
} from '../session/set.js'
import ScaleLab from './ScaleLab.jsx'
import PointsPops, { usePointPops } from './PointsPops.jsx'

const SUFFIX = { maj7: 'maj7', min7: 'm7', dom7: '7', halfDim: 'ø7' }
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const WARMUP_SECTIONS = [
  { id: 'lab', label: 'LAB' },
  { id: 'ear', label: 'EAR' },
  { id: 'rapid', label: 'CHORDS' },
  { id: 'progression', label: 'PROGRESSIONS' },
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
  const [chordClean, setChordClean] = useState(0)
  const [chordMsg, setChordMsg] = useState('')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [confidence, setConfidence] = useState(() => emptyConfidence())
  const [rapidDegree, setRapidDegree] = useState(1)
  const [barKey, setBarKey] = useState(0)
  const [barLive, setBarLive] = useState(false)
  const [progChanges, setProgChanges] = useState('turnaround')
  const [progPick, setProgPick] = useState(false)
  const [progRun, setProgRun] = useState(false)
  const [progBar, setProgBar] = useState(0)
  const [progMeters, setProgMeters] = useState([])
  const [progLastBass, setProgLastBass] = useState([])
  const [progMsg, setProgMsg] = useState('')
  const [revealChord, setRevealChord] = useState(null)
  const [revealed, setRevealed] = useState(0)
  const { pops, pop } = usePointPops()
  const playedRef = useRef([])
  const passedRef = useRef({ ear: false })
  const labRef = useRef(null)
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
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const bestComboRef = useRef(0)
  const correctRef = useRef(0)
  const progRunRef = useRef(false)
  const progBarRef = useRef(0)
  const progMetersRef = useRef([])
  const progLastBassRef = useRef([])
  const progCleanRef = useRef(0)
  const progVoicingRef = useRef(0)
  const timerRef = useRef(null)
  const gradeRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const earPcs = warmup.ear.pcs
  const rapidFilled = allDegreesFilled(confidence)
  // The progressions phase loops the picked changes forever; the bar index is
  // the only key for its meters and bass history.
  const progBars = buildJamDegrees(progChanges, 1)
  const progName = PLAY_CHANGES.find((entry) => entry.id === progChanges)?.name || 'turnaround'
  const progFilled = metersFilled(progMeters)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
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
    resetProg(progChanges)
    setResult(null)
    setRevealed(0)
    setNotes([])
    chordNotesRef.current = []
    chordMidiRef.current = []
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

  // ---- chord phases: the rapid-fire drill, then the looping progressions ----
  function chordFor(degree) {
    return `${noteName(degreeRootPc(keyId, degree))}${SUFFIX[seventhQuality(degree)]}`
  }

  function stopBar() {
    setBarLive(false)
  }

  // Every chord tone restarts the bar from the top. The bar owns the clock: it
  // is the only thing that can move the drill on when the player stops.
  function restartBar() {
    setBarKey((value) => value + 1)
    setBarLive(true)
  }

  // Shared score, combo and bar state: only one drill runs at a time.
  function resetRun() {
    stopBar()
    chordRunRef.current = false
    chordNotesRef.current = []
    chordMidiRef.current = []
    tailRef.current = { pending: false, capAt: 0 }
    solvedRef.current = false
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    tailTimerRef.current = null
    revealTimerRef.current = null
    scoreRef.current = 0
    comboRef.current = 0
    bestComboRef.current = 0
    correctRef.current = 0
    answeredRef.current = 0
    confidenceRef.current = emptyConfidence()
    gradeRef.current = false
    setChordClean(0)
    setChordMsg('')
    setRevealChord(null)
    setPlayed([])
    setScore(0)
    setCombo(0)
    setConfidence(confidenceRef.current)
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

  function startChords(next = phase) {
    unlockAudio()
    if (next !== phase) setPhase(next)
    resetRun()
    if (next === 'rapid') drawRapidDegree()
    chordRunRef.current = true
    setChordRun(true)
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

  function missRapid(penalty, reason = 'TIME') {
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
    setChordMsg(
      `THE ${ROMAN[degree - 1]} IS ${chordFor(degree)} · ${
        reason === 'STRAY' ? 'WRONG NOTE' : 'BAR RAN OUT'
      }`,
    )
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
    // Hold the next chord until the player's hand stops, so the tail of a long
    // arpeggio cannot be graded against the chord that follows it.
    scheduleNextChord(drawRapidDegree)
  }

  function expireRapid() {
    if (!chordRunRef.current || disabled) return
    if (solvedRef.current) advanceRapid()
    else missRapid(false)
  }

  // Waiting for the player's hand to stop is the same for both drills; the
  // caller decides what comes next.
  function scheduleNextChord(next) {
    const now = performance.now()
    if (!tailRef.current.pending) {
      tailRef.current = { pending: true, capAt: now + CHORD_TAIL_CAP_MS }
    }
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    const wait = Math.min(CHORD_TAIL_SILENCE_MS, Math.max(0, tailRef.current.capAt - now))
    tailTimerRef.current = setTimeout(() => {
      tailTimerRef.current = null
      tailRef.current = { pending: false, capAt: 0 }
      next()
    }, wait)
  }

  // ---- progressions: the same clock, looping bars, a meter per bar ---------
  function resetProg(id = progChanges) {
    const bars = buildJamDegrees(id, 1).length
    progRunRef.current = false
    progBarRef.current = 0
    progMetersRef.current = Array(bars).fill(0)
    progLastBassRef.current = Array(bars).fill(null)
    progCleanRef.current = 0
    progVoicingRef.current = 0
    setProgRun(false)
    setProgBar(0)
    setProgMeters(progMetersRef.current)
    setProgLastBass(progLastBassRef.current)
    setProgMsg('')
  }

  function chooseProg(id) {
    if (id === progChanges) return
    resetRun()
    setProgChanges(id)
    setProgPick(false)
    resetProg(id)
  }

  function startProg() {
    unlockAudio()
    resetRun()
    resetProg()
    progRunRef.current = true
    setProgRun(true)
  }

  function solveProg() {
    if (solvedRef.current) return
    const bar = progBarRef.current
    const degree = progBars[bar]
    const rootPc = degreeRootPc(keyId, degree)
    const bassPc = chordMidiRef.current.length ? Math.min(...chordMidiRef.current) % 12 : rootPc
    const bonus = inversionBonus({ rootPc, bassPc, lastBassPc: progLastBassRef.current[bar] })
    const outcome = scoreChord({ clean: true, combo: comboRef.current, bonus })
    recordAttempt('warmup', false)
    solvedRef.current = true
    comboRef.current = outcome.combo
    bestComboRef.current = Math.max(bestComboRef.current, outcome.combo)
    scoreRef.current += outcome.points
    progCleanRef.current += 1
    if (bonus > 0) progVoicingRef.current += 1
    progLastBassRef.current = progLastBassRef.current.map((value, index) =>
      index === bar ? bassPc : value,
    )
    progMetersRef.current = bumpMeter(progMetersRef.current, bar, true)
    setCombo(outcome.combo)
    setScore(scoreRef.current)
    setProgMeters(progMetersRef.current)
    setProgLastBass(progLastBassRef.current)
    pop(outcome.points, bonus === INVERSION_BONUS_NEW ? 'NEW BASS' : bonus ? 'INVERTED' : 'CLEAN')
    setProgMsg(
      `${ROMAN[degree - 1]} CLEAN · +${outcome.points} · KEEP COMPING +${CHORD_HOLD_POINTS}`,
    )
  }

  function missProg(penalty) {
    const bar = progBarRef.current
    const outcome = scoreChord({ clean: false, combo: comboRef.current, penalty })
    recordAttempt('warmup', true)
    comboRef.current = 0
    scoreRef.current = Math.max(0, scoreRef.current + outcome.points)
    progMetersRef.current = bumpMeter(progMetersRef.current, bar, false)
    solvedRef.current = false
    setCombo(0)
    setScore(scoreRef.current)
    setProgMeters(progMetersRef.current)
    if (outcome.points) pop(outcome.points, 'SLIPPED')
    setProgMsg(penalty ? 'WRONG NOTE · NEXT BAR.' : 'BAR RAN OUT · NEXT BAR.')
    advanceProg()
  }

  function advanceProg() {
    stopBar()
    chordNotesRef.current = []
    chordMidiRef.current = []
    solvedRef.current = false
    setPlayed([])
    scheduleNextChord(nextProgBar)
  }

  function nextProgBar() {
    const next = nextBarIndex(progBarRef.current, progBars.length)
    progBarRef.current = next
    setProgBar(next)
    setBarLive(false)
  }

  function expireProg() {
    if (!progRunRef.current || disabled) return
    if (solvedRef.current) advanceProg()
    else missProg(false)
  }

  function handleProgNote(pc, note) {
    if (disabled || !progRunRef.current || gradeRef.current) return
    // Still waiting for the last bar's hand to stop: swallow, keep waiting.
    if (tailRef.current.pending) {
      scheduleNextChord(nextProgBar)
      return
    }
    const target = seventhByDegree(keyId, progBars[progBarRef.current])
    const step = rapidChordStep({ target, played: chordNotesRef.current, pc })
    if (step.kind === 'miss') {
      missProg(true)
      return
    }
    // Any key on the current chord keeps the clock alive, solved or not.
    restartBar()
    if (step.kind === 'ignore') {
      if (target.includes(pc)) awardHold()
      return
    }
    chordNotesRef.current = step.played
    if (Number.isFinite(note)) chordMidiRef.current = [...chordMidiRef.current, note]
    setPlayed(step.played)
    if (step.solved) solveProg()
  }

  function skipProg() {
    stopBar()
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    tailTimerRef.current = null
    tailRef.current = { pending: false, capAt: 0 }
    chordNotesRef.current = []
    chordMidiRef.current = []
    solvedRef.current = false
    setPlayed([])
    setProgMsg('SKIPPED.')
    nextProgBar()
  }

  function handleChordNote(pc, note) {
    if (disabled || gradeRef.current) return
    if (phase === 'progression') {
      handleProgNote(pc, note)
      return
    }
    if (!chordRunRef.current) return
    // Still waiting for the last chord's hand to stop: swallow, keep waiting.
    if (tailRef.current.pending) {
      scheduleNextChord(drawRapidDegree)
      return
    }
    const target = seventhByDegree(keyId, rapidDegreeRef.current)
    const step = rapidChordStep({ target, played: chordNotesRef.current, pc })
    if (step.kind === 'miss') {
      missRapid(true, 'STRAY')
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
  }

  // The bar owns the timeout in both drills, so a quiet hand is never graded.
  function skipChord() {
    stopBar()
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    tailTimerRef.current = null
    tailRef.current = { pending: false, capAt: 0 }
    drawRapidDegree()
    setChordMsg('SKIPPED.')
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
      progression: {
        changesId: progChanges,
        name: progName,
        clean: progCleanRef.current,
        total: progBars.length,
        meters: progMetersRef.current,
        lastBass: progLastBassRef.current,
        voicings: progVoicingRef.current,
        score: scoreRef.current,
        bestCombo: bestComboRef.current,
        passed: progBars.length > 0 && metersFilled(progMetersRef.current) === progBars.length,
      },
    })
  }

  useNoteSequence({
    active: ((phase === 'rapid' && chordRun) || (phase === 'progression' && progRun)) && !disabled,
    onNote: handleChordNote,
  })

  return (
    <div className="stagecard setwarmup">
      <div className="stagehead">
        <span className="stagehead__eyebrow">
          THE SET · {keyDisplay(keyId)} MAJOR · SCALE LAB · EAR · CHORDS · PROGRESSIONS
        </span>
        <h2 className="stagehead__title">
          {phase === 'lab'
            ? 'SCALE LAB'
            : phase === 'ear'
              ? 'EAR'
              : phase === 'rapid'
                ? 'CHORDS'
                : 'PROGRESSIONS'}
        </h2>
        <p className="stagehead__copy">
          {phase === 'lab'
            ? 'Three homes on one keyboard: major, relative minor, blues. Play all three, then call degrees by ear.'
            : phase === 'ear'
              ? 'Four notes. Hear them once, then play them back in order.'
              : phase === 'rapid'
                ? 'One chord at a time, drawn toward whichever degree you are least sure of. The bar starts on your first note and every chord tone keeps it alive. A clean chord scores and you comp it until the bar runs out.'
                : 'Pick a progression. The chords come in order and loop. The bar is the clock, every chord tone restarts it, and a wrong note or a full bar of silence moves you on. A clean chord fills that bar’s meter. Move the bass and it pays.'}
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
                  : progBars.length > 0 && progFilled === progBars.length
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
                  onClick={() => goTo('progression')}
                  disabled={disabled}
                >
                  MOVE ON · PROGRESSIONS
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="rapidprompt">
                <span className="rapidprompt__play">
                  {chordClean} CLEAN · {confidence.filter((value) => value >= 1).length} OF 7 DEGREES
                  FULL
                </span>
                <span className="rapidprompt__chord">{chordFor(rapidDegree)}</span>
                <span className="rapidprompt__sub">
                  {ROMAN[rapidDegree - 1]} · 7TH CHORD · {seventhByDegree(keyId, rapidDegree).length}{' '}
                  NOTES
                </span>
                {revealChord ? (
                  <div className="rapidreveal">
                    <span className="rapidreveal__label">THE CHORD WAS</span>
                    <span className="rapidreveal__chord">{revealChord}</span>
                    <span className="rapidreveal__hint">HEARD IT · NEXT CHORD IS UP</span>
                  </div>
                ) : null}
              </div>
              <ChordBar runKey={barKey} live={barLive} onExpire={expireRapid} />
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
                    onClick={() => goTo('progression')}
                    disabled={disabled}
                  >
                    MOVE ON · PROGRESSIONS
                  </button>
                ) : null}
              </div>
            </>
          )}
        </>
      ) : null}

      {phase === 'progression' ? (
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
              <span className="rapid__label">BARS FULL</span>
              <span className="rapid__value">{progFilled}</span>
            </div>
          </div>

          <div className="progpick">
            {progPick ? (
              PLAY_CHANGES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`jamchip${progChanges === entry.id ? ' is-on' : ''}`}
                  aria-pressed={progChanges === entry.id}
                  onClick={() => chooseProg(entry.id)}
                  disabled={disabled}
                >
                  {entry.name}
                </button>
              ))
            ) : (
              <div className="progpick__row">
                <span className="progpick__name">{progName.toUpperCase()}</span>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => setProgPick(true)}
                  disabled={disabled}
                >
                  CHANGE
                </button>
              </div>
            )}
          </div>

          {!progRun ? (
            <div className="stagefoot">
              <button
                type="button"
                className="btn btn--signal"
                onClick={startProg}
                disabled={disabled}
              >
                START THE PROGRESSION
              </button>
              <button type="button" className="btn" onClick={finishWarmup} disabled={disabled}>
                FINISH THE SET
              </button>
            </div>
          ) : (
            <>
              <div className="rapidprompt">
                <span className="rapidprompt__play">
                  {progFilled} OF {progBars.length} BARS FULL
                </span>
                <span className="rapidprompt__chord">{chordFor(progBars[progBar])}</span>
                <span className="rapidprompt__sub">
                  {ROMAN[progBars[progBar] - 1]} · BAR {progBar + 1} OF {progBars.length} · 7TH CHORD
                </span>
              </div>
              <ChordBar runKey={barKey} live={barLive} onExpire={expireProg} />
              <div className="chordmeters" aria-label="Bars">
                {progBars.map((degree, bar) => {
                  const meter = progMeters[bar] ?? 0
                  const bass = progLastBass[bar]
                  const moved = bass != null && bass !== degreeRootPc(keyId, degree)
                  return (
                    <div
                      className={`chordmeter${bar === progBar ? ' is-current' : ''}${
                        meter >= 1 ? ' is-full' : ''
                      }`}
                      key={`${bar}-${degree}`}
                    >
                      <span className="chordmeter__numeral">{ROMAN[degree - 1]}</span>
                      <span className="chordmeter__track">
                        <span
                          className="chordmeter__fill"
                          style={{ height: `${Math.round(meter * 100)}%` }}
                        />
                      </span>
                      <span className={`chordmeter__bass${moved ? ' is-moved' : ''}`}>
                        {bass == null ? '—' : noteName(bass)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="rapidbar">
                <span>CHORD TONES RESET THE BAR</span>
                <span>
                  NON-ROOT BASS +{INVERSION_BONUS} · A NEW ONE +{INVERSION_BONUS_NEW}
                </span>
              </div>
              <p className="hintline">
                {progMsg ||
                  (barLive
                    ? 'KEEP COMPING — THE BAR RUNS OUT TO MOVE ON.'
                    : 'PLAY THE CHORD TO START THE BAR.')}
              </p>
              <div className="stagefoot">
                <button type="button" className="btn" onClick={skipProg} disabled={disabled}>
                  SKIP
                </button>
                <button type="button" className="btn btn--signal" onClick={finishWarmup} disabled={disabled}>
                  FINISH THE SET
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}

// The bar owns the drill's clock: it drains from full to empty and calls
// onExpire when it runs out. Every new runKey restarts it from the top, so a
// chord tone played anywhere in an attempt buys another full bar.
function ChordBar({ runKey, live, onExpire }) {
  const [percent, setPercent] = useState(100)
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire

  useEffect(() => {
    if (!live) {
      setPercent(100)
      return undefined
    }
    const start = performance.now()
    const timer = setInterval(() => {
      const elapsed = performance.now() - start
      setPercent(Math.max(0, Math.round((1 - elapsed / CHORD_BAR_MS) * 100)))
      if (elapsed >= CHORD_BAR_MS) {
        clearInterval(timer)
        expireRef.current()
      }
    }, 50)
    return () => clearInterval(timer)
  }, [runKey, live])

  return (
    <div className={`chordbar${live ? ' is-live' : ''}`} aria-hidden="true">
      <span className="chordbar__fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
