import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence } from '../session/grade.js'
import {
  isMuted,
  playChord,
  playCountIn,
  playPhrase,
  SILENT_HINT,
  unlockAudio,
} from '../session/audio.js'
import { createTransport } from '../session/transport.js'
import { scoreChangeChord, targetForDegree } from '../session/changes.js'
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
  metersFilled,
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
// How far around a bar's downbeat a chord counts as "on the beat".
const PROG_WINDOW_MS = 260
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
  const [progTempo, setProgTempo] = useState(84)
  const [progCountin, setProgCountin] = useState(false)
  const [progBeat, setProgBeat] = useState(0)
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
  const progVoicingRef = useRef(0)
  const progLastMidiRef = useRef(null)
  const progNotesRef = useRef([])
  const progPendingRef = useRef([])
  const progTokenRef = useRef(0)
  const transportRef = useRef(null)
  const progMountedRef = useRef(true)
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
    () => {
      progMountedRef.current = true
      return () => {
        progMountedRef.current = false
        if (timerRef.current) clearTimeout(timerRef.current)
        if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
        transportRef.current?.stop()
        transportRef.current = null
        for (const entry of progPendingRef.current) clearTimeout(entry.timer)
        progPendingRef.current = []
      }
    },
    [],
  )

  // Pausing the session silences the band; the player restarts when ready.
  useEffect(() => {
    if (!disabled) return
    progTokenRef.current += 1
    progRunRef.current = false
    for (const entry of progPendingRef.current) clearTimeout(entry.timer)
    progPendingRef.current = []
    transportRef.current?.stop()
    transportRef.current = null
    setProgRun(false)
    setProgCountin(false)
    setProgBeat(0)
    setProgMsg('PAUSED.')
  }, [disabled])

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

  // ---- progressions: the band owns the clock, the player plays on the beat ----
  // A count-in, then a looping transport plays the changes. Each bar's chord is
  // graded in a window around its downbeat; fill every bar's meter to clear it.
  function clearProgPending() {
    for (const entry of progPendingRef.current) clearTimeout(entry.timer)
    progPendingRef.current = []
  }

  function stopProgTransport() {
    transportRef.current?.stop()
    transportRef.current = null
  }

  function resetProg(id = progChanges) {
    const bars = buildJamDegrees(id, 1).length
    progTokenRef.current += 1
    progRunRef.current = false
    progBarRef.current = 0
    progMetersRef.current = Array(bars).fill(0)
    progLastBassRef.current = Array(bars).fill(null)
    progLastMidiRef.current = null
    progNotesRef.current = []
    progVoicingRef.current = 0
    clearProgPending()
    stopProgTransport()
    setProgRun(false)
    setProgCountin(false)
    setProgBar(0)
    setProgBeat(0)
    setProgMeters(progMetersRef.current)
    setProgLastBass(progLastBassRef.current)
    setProgMsg('')
  }

  function chooseProg(id) {
    if (id === progChanges) {
      setProgPick(false)
      return
    }
    resetRun()
    setProgChanges(id)
    setProgPick(false)
    resetProg(id)
  }

  function stopProg() {
    progTokenRef.current += 1
    progRunRef.current = false
    clearProgPending()
    stopProgTransport()
    setProgRun(false)
    setProgCountin(false)
    setProgBeat(0)
    setProgMsg('STOPPED.')
  }

  async function beginProgTransport(startAt) {
    if (!progMountedRef.current) return
    const next = createTransport({
      keyId,
      bpm: progTempo,
      degrees: progBars,
      startAt,
      onBeat: (beat, bar, beatInBar) => setProgBeat(beatInBar),
      onChord: (bar, degree) => {
        progBarRef.current = bar
        setProgBar(bar)
        scheduleProgGrade(bar, degree)
      },
      onEnd: () => {
        if (!progRunRef.current) return
        if (metersFilled(progMetersRef.current) >= progBars.length) {
          progRunRef.current = false
          setProgRun(false)
          setProgBeat(0)
          setProgMsg('THE FORM IS FULL. FINISH THE SET.')
          return
        }
        beginProgTransport(transportRef.current?.endAt() ?? null)
      },
    })
    next.setMuted(isMuted())
    transportRef.current = next
    await next.start()
    if (!progMountedRef.current || !progRunRef.current) {
      next.stop()
      if (transportRef.current === next) transportRef.current = null
    }
  }

  async function startProg() {
    if (disabled) return
    unlockAudio()
    resetRun()
    resetProg()
    const token = progTokenRef.current
    setProgCountin(true)
    setProgMsg('COUNT IN.')
    const nextAt = await playCountIn(progTempo, 4)
    if (!progMountedRef.current || token !== progTokenRef.current) return
    setProgCountin(false)
    progRunRef.current = true
    setProgRun(true)
    setProgMsg('PLAY EACH CHORD ON THE DOWNBEAT.')
    beginProgTransport(nextAt)
  }

  function scheduleProgGrade(bar, degree) {
    if (!progRunRef.current) return
    const at = performance.now()
    const target = targetForDegree(keyId, degree)
    const timer = setTimeout(() => {
      progPendingRef.current = progPendingRef.current.filter((entry) => entry.timer !== timer)
      gradeProgBar(bar, target, at)
    }, PROG_WINDOW_MS + 45)
    progPendingRef.current.push({ timer, bar, target, at })
  }

  function gradeProgBar(bar, target, at) {
    if (!progRunRef.current) return
    const played = progNotesRef.current.filter(
      (note) => note.at >= at - PROG_WINDOW_MS && note.at <= at + PROG_WINDOW_MS,
    )
    const midi = played.map((note) => note.midi).filter(Number.isFinite)
    const timingMs = played.length
      ? Math.min(...played.map((note) => Math.abs(note.at - at)))
      : 0
    const outcome = scoreChangeChord({
      targetPcs: target.pcs,
      triadPcs: target.triadPcs,
      playedMidi: midi,
      previousMidi: progLastMidiRef.current,
      timingMs,
      combo: comboRef.current,
      windowMs: PROG_WINDOW_MS,
    })
    recordAttempt('warmup', !outcome.hit)
    const degree = progBars[bar]
    if (outcome.hit) {
      comboRef.current = outcome.combo
      bestComboRef.current = Math.max(bestComboRef.current, outcome.combo)
      scoreRef.current += outcome.points
      progMetersRef.current = bumpMeter(progMetersRef.current, bar, true)
      progLastMidiRef.current = midi
      if (outcome.smooth) progVoicingRef.current += 1
      progLastBassRef.current = progLastBassRef.current.map((value, index) =>
        index === bar ? Math.min(...midi) % 12 : value,
      )
      pop(outcome.points, outcome.smooth ? 'SMOOTH' : 'ON TIME')
      setProgMsg(`${ROMAN[degree - 1]} ON TIME · +${outcome.points}`)
    } else {
      comboRef.current = 0
      scoreRef.current = Math.max(0, scoreRef.current + outcome.points)
      setProgMsg(midi.length ? 'NOT THE CHORD · STAY ON THE FORM.' : 'NO CHORD · STAY ON THE FORM.')
    }
    setCombo(comboRef.current)
    setScore(scoreRef.current)
    setProgMeters(progMetersRef.current)
    setProgLastBass(progLastBassRef.current)
  }

  function handleProgNote(pc, note) {
    if (disabled || !progRunRef.current) return
    progNotesRef.current.push({
      pc,
      midi: Number.isFinite(note) ? note : 60 + pc,
      at: performance.now(),
    })
    if (progNotesRef.current.length > 400) progNotesRef.current.shift()
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
    progTokenRef.current += 1
    progRunRef.current = false
    clearProgPending()
    stopProgTransport()
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
        clean: metersFilled(progMetersRef.current),
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
                : 'Pick a progression and a tempo. The band counts you in and plays the changes. You play each chord on its downbeat; a chord inside the window fills that bar’s meter. Fill every bar to clear the form.'}
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
                  disabled={disabled || progRun || progCountin}
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
                  disabled={disabled || progRun || progCountin}
                >
                  CHANGE
                </button>
              </div>
            )}
          </div>

          {!progRun && !progCountin ? (
            <>
              <label className="progtempo">
                <span className="progtempo__label">TEMPO · {progTempo} BPM</span>
                <input
                  type="range"
                  className="progtempo__range"
                  min="60"
                  max="120"
                  step="2"
                  value={progTempo}
                  onChange={(event) => setProgTempo(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
              <div className="stagefoot">
                <button
                  type="button"
                  className="btn btn--signal"
                  onClick={startProg}
                  disabled={disabled}
                >
                  {progFilled ? 'RUN IT AGAIN' : 'START THE PROGRESSION'}
                </button>
                <button type="button" className="btn" onClick={finishWarmup} disabled={disabled}>
                  FINISH THE SET
                </button>
              </div>
              {progMsg ? <p className="hintline">{progMsg}</p> : null}
            </>
          ) : progCountin ? (
            <>
              <div className="rapidprompt">
                <span className="rapidprompt__play">COUNT IN · {progTempo} BPM</span>
                <span className="rapidprompt__chord">{chordFor(progBars[0])}</span>
                <span className="rapidprompt__sub">FIRST CHORD · GET READY</span>
              </div>
              <p className="hintline">FOUR CLICKS, THEN THE BAND. PLAY THE FIRST CHORD ON THE DOWNBEAT.</p>
              <div className="stagefoot">
                <button type="button" className="btn" onClick={stopProg} disabled={disabled}>
                  STOP
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rapidprompt">
                <span className="rapidprompt__play">
                  {progFilled} OF {progBars.length} BARS FULL
                </span>
                <span className="rapidprompt__chord">{chordFor(progBars[progBar])}</span>
                <span className="rapidprompt__sub">
                  {ROMAN[progBars[progBar] - 1]} · BAR {progBar + 1} OF {progBars.length} · PLAY IT ON THE BEAT
                </span>
              </div>
              <div className="progbeats" aria-label="Beat">
                {[0, 1, 2, 3].map((beat) => (
                  <span
                    key={beat}
                    className={`progbeat${beat === progBeat ? ' is-on' : ''}`}
                  />
                ))}
              </div>
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
                      <span className="chordmeter__numeral">{chordFor(degree)}</span>
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
                <span>PLAY EACH CHORD ON THE DOWNBEAT</span>
                <span>CLOSE VOICING PAYS</span>
              </div>
              <p className="hintline">
                {progMsg || 'LISTEN TO THE BAND AND LAND EACH CHORD ON THE BEAT.'}
              </p>
              <div className="stagefoot">
                <button type="button" className="btn" onClick={stopProg} disabled={disabled}>
                  STOP
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
