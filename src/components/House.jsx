import { useCallback, useEffect, useRef, useState } from 'react'
import PianoKeys from './PianoKeys.jsx'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { noteName } from '../data/diminishedChords.js'
import { diatonicSevenths, keyDisplay } from '../data/scales.js'
import { laDate, seedFor, tonightKey } from '../session/tonight.js'
import {
  GOAL,
  createRun,
  gradeTiming,
  nextCue,
  playDuration,
  resolveStation,
  runAccuracy,
  stationChord,
  toArcadeRow,
} from '../session/arcade.js'
import {
  isMuted,
  playBuzz,
  playChord,
  playCountIn,
  setMuted,
  unlockAudio,
} from '../session/audio.js'

// SEVENTH HOUSE: the phone session. Build the key's seven diatonic sevenths,
// each correctly twice. Chord stations freeze the clock; four single notes sit
// between them. The goal is fourteen clears, not a score.

const COUNT_WORDS = ['READY', '3', '2', '1', 'GO']
const COUNT_MS = 600
const WORD_MS = 420
const CLEAR_HOLD_MS = 650
const MISS_HOLD_MS = 900

const CUE_WORD = {
  perfect: 'PERFECT',
  good: 'GOOD',
  miss: 'MISS',
  stray: 'STRAY',
  ok: 'OK',
}

const INSTRUCTIONS = [
  'TAP FOUR NOTES',
  'THREE MORE',
  'TWO MORE',
  'ONE MORE · TAP A LIT KEY TO UNDO',
]

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `house-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// The mark: a chevron roof over seven columns of two cells. Decorative; the
// pip strip and the count carry the progress.
export function HouseMark({ size = 34 }) {
  return (
    <svg
      className="housemark"
      width={size}
      height={(size * 24) / 40}
      viewBox="0 0 40 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 8 L20 1 L38 8" fill="none" stroke="currentColor" strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5, 6].map((column) => (
        <g key={column}>
          <rect x={3 + column * 5} y="11" width="3" height="3" fill="currentColor" />
          <rect x={3 + column * 5} y="16" width="3" height="3" fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

function Pips({ degrees }) {
  return (
    <div className="house__pips" aria-hidden="true">
      {degrees.map((row, index) => (
        <span className="house__pipcol" key={index}>
          <span className={`house__pip${row.correct >= 2 ? ' is-on' : ''}`} />
          <span className={`house__pip${row.correct >= 1 ? ' is-on' : ''}`} />
        </span>
      ))}
    </div>
  )
}

const EMPTY = {
  mode: 'stream',
  lit: {},
  cue: null,
  station: null,
  verdict: null,
  cleared: 0,
  degrees: Array.from({ length: 7 }, () => ({ correct: 0, missed: 0 })),
  accuracy: 0,
}

function snapshot(run) {
  const { engine } = run
  const lit = {}
  if (run.mode === 'stream' && run.active) lit[run.active.pc] = run.active.kind
  if (run.mode === 'station' && run.station) {
    for (const pc of run.station.tapped) lit[pc] = 'picked'
  }
  if (run.verdict) {
    for (const pc of run.verdict.correct) lit[pc] = 'good'
    for (const pc of run.verdict.tapped) {
      if (!run.verdict.correct.includes(pc)) lit[pc] = 'bad'
    }
  }
  return {
    mode: run.mode,
    lit,
    cue: run.cue,
    station: run.station
      ? {
          degree: run.station.degree,
          name: run.station.chord.name,
          numeral: run.station.chord.numeral,
          tapped: [...run.station.tapped],
        }
      : null,
    verdict: run.verdict
      ? {
          kind: run.verdict.kind,
          numeral: run.verdict.numeral,
          clears: engine.degrees[run.verdict.degree].correct,
        }
      : null,
    cleared: engine.cleared,
    degrees: engine.degrees.map((row) => ({ ...row })),
    accuracy: runAccuracy(engine),
  }
}

export default function House({ keyId = tonightKey(), onExit, onSubmit }) {
  const [phase, setPhase] = useState('ready')
  const [view, setView] = useState(EMPTY)
  const [countWord, setCountWord] = useState(0)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [sound, setSound] = useState(() => !isMuted())
  const [summary, setSummary] = useState(null)

  const runRef = useRef(null)
  const phaseRef = useRef(phase)
  const rafRef = useRef(0)
  const timersRef = useRef([])
  const attemptRef = useRef(0)
  const submittedRef = useRef(false)
  phaseRef.current = phase

  const publish = useCallback((run) => {
    setView(snapshot(run))
  }, [])

  const finish = useCallback(
    (run) => {
      if (!run || run.ended) return
      run.ended = true
      const now = Date.now()
      const durationMs = playDuration(run, now)
      const row = toArcadeRow(run.engine, {
        id: run.id,
        date: laDate(new Date(run.startedAt)),
        startedAt: new Date(run.startedAt).toISOString(),
        endedAt: new Date(now).toISOString(),
        durationMs,
      })
      if (!submittedRef.current) {
        submittedRef.current = true
        onSubmit?.(row)
      }
      const sevenths = diatonicSevenths(run.engine.keyId)
      setSummary({
        row,
        durationMs,
        cues: run.engine.cues.total,
        accuracy: row.payload.accuracy,
        cleared: row.payload.cleared,
        complete: row.payload.complete,
        cameBack: sevenths.filter((chord) => run.engine.degrees[chord.degree - 1].missed > 0).length,
        rows: sevenths.map((chord) => ({
          name: chord.name,
          numeral: chord.numeral,
          correct: run.engine.degrees[chord.degree - 1].correct,
          missed: run.engine.degrees[chord.degree - 1].missed,
        })),
      })
      setPhase('summary')
    },
    [onSubmit],
  )

  const pushCue = useCallback((run, tone, now) => {
    run.cue = { tone, text: CUE_WORD[tone], until: now + WORD_MS }
  }, [])

  // One cue at a time; a station just stops the stream.
  const pump = useCallback(
    (run, now) => {
      if (run.mode !== 'stream' || run.active || run.verdict || run.ended) return
      const cue = nextCue(run.engine)
      if (!cue) {
        finish(run)
        return
      }
      if (cue.kind === 'station') {
        run.mode = 'station'
        run.station = {
          degree: cue.degree,
          chord: stationChord(run.engine, cue.degree),
          tapped: [],
        }
        return
      }
      run.active = {
        kind: cue.kind,
        pc: cue.pc,
        hold: cue.hold,
        litAt: now,
        darkAt: now + cue.hold,
      }
      if (!isMuted()) playChord([cue.pc], { duration: 0.4 })
    },
    [finish],
  )

  const tick = useCallback(() => {
    const run = runRef.current
    if (!run || run.ended || phaseRef.current !== 'run') return
    const now = performance.now()
    let dirty = false

    if (run.verdict) {
      if (now >= run.verdict.until) {
        run.verdict = null
        if (run.engine.cleared >= GOAL) {
          finish(run)
          return
        }
        run.station = null
        run.mode = 'stream'
        pump(run, now)
        dirty = true
      }
    } else if (run.mode === 'stream') {
      if (run.active && now >= run.active.darkAt) {
        const active = run.active
        run.active = null
        // A resolved cue ends where the next one starts: it stays lit until
        // its window closes, so the stream keeps its cadence.
        if (!active.resolved) {
          if (active.kind === 'bomb') {
            pushCue(run, 'ok', now) // letting a bomb go dark is the play
          } else {
            run.engine.cues.misses += 1
            pushCue(run, 'miss', now)
          }
        }
        dirty = true
      }
      pump(run, now)
      dirty = true
    }

    if (run.cue && now >= run.cue.until) {
      run.cue = null
      dirty = true
    }
    if (dirty) publish(run)
  }, [finish, publish, pump, pushCue])

  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      tick()
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  useEffect(() => () => timersRef.current.forEach((timer) => clearTimeout(timer)), [])

  const pauseRun = useCallback(() => {
    const run = runRef.current
    if (!run || run.ended || run.pausedAt || phaseRef.current !== 'run') return
    // Two clocks: Date.now() measures the pause for the row, performance.now()
    // shifts the cue windows.
    run.pausedAt = Date.now()
    run.pausedPerf = performance.now()
    setPhase('paused')
  }, [])

  const resumeRun = useCallback(() => {
    const run = runRef.current
    if (!run || !run.pausedAt) return
    const hidden = performance.now() - run.pausedPerf
    run.pausedMs += Date.now() - run.pausedAt
    run.pausedAt = 0
    run.pausedPerf = 0
    if (run.active) {
      run.active.litAt += hidden
      run.active.darkAt += hidden
    }
    if (run.verdict) run.verdict.until += hidden
    if (run.cue) run.cue.until += hidden
    setLeaveAsk(false)
    setPhase('run')
    publish(run)
  }, [publish])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pauseRun()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pauseRun])

  const start = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
    attemptRef.current += 1
    submittedRef.current = false
    const seed = (seedFor(laDate(), keyId) ^ attemptRef.current) | 0
    const engine = createRun({ keyId, seed })
    runRef.current = {
      engine,
      id: newId(),
      startedAt: Date.now(),
      pausedMs: 0,
      pausedAt: 0,
      pausedPerf: 0,
      active: null,
      mode: 'stream',
      station: null,
      verdict: null,
      cue: null,
      ended: false,
    }

    setSummary(null)
    setLeaveAsk(false)
    setCountWord(0)
    setView({ ...EMPTY, degrees: engine.degrees.map((row) => ({ ...row })) })
    setPhase('count')
    unlockAudio() // iOS only opens the context inside a real gesture
    playCountIn(100, 4)

    COUNT_WORDS.forEach((_, index) => {
      timersRef.current.push(setTimeout(() => setCountWord(index), index * COUNT_MS))
    })
    timersRef.current.push(
      setTimeout(() => {
        setPhase('run')
        publish(runRef.current)
      }, COUNT_WORDS.length * COUNT_MS),
    )
  }, [keyId, publish])

  const gradeStation = useCallback(
    (run, now) => {
      const { station } = run
      const { chord } = station
      const correct =
        chord.pitchClasses.length === 4 && chord.pitchClasses.every((pc) => station.tapped.includes(pc))
      resolveStation(run.engine, station.degree, correct)
      if (!isMuted()) {
        if (correct) playChord(chord.pitchClasses, { duration: 0.6 })
        else playBuzz()
      }
      run.mode = 'verdict'
      run.active = null
      run.verdict = {
        kind: correct ? 'clear' : 'miss',
        degree: station.degree,
        numeral: chord.numeral,
        correct: [...chord.pitchClasses],
        tapped: [...station.tapped],
        until: now + (correct ? CLEAR_HOLD_MS : MISS_HOLD_MS),
      }
    },
    [],
  )

  const tapStation = useCallback(
    (run, pc, now) => {
      const { station } = run
      if (!station || run.verdict) return
      const index = station.tapped.indexOf(pc)
      if (index >= 0) {
        station.tapped.splice(index, 1)
      } else if (station.tapped.length < 4) {
        station.tapped.push(pc)
        if (!isMuted()) playChord([pc], { duration: 0.25 })
      }
      if (station.tapped.length === 4) gradeStation(run, now)
      publish(run)
    },
    [gradeStation, publish],
  )

  const tapKey = useCallback(
    (pc) => {
      const run = runRef.current
      if (!run || run.ended || phaseRef.current !== 'run') return
      const now = performance.now()
      if (run.mode === 'station') {
        tapStation(run, pc, now)
        return
      }
      if (run.mode !== 'stream') return
      const active = run.active
      if (!active) {
        run.engine.cues.misses += 1
        pushCue(run, 'stray', now)
        if (!isMuted()) playBuzz()
        publish(run)
        return
      }
      if (active.kind === 'bomb') {
        if (pc === active.pc) {
          run.engine.cues.bombsHit += 1
          run.engine.cues.misses += 1
          active.resolved = true
          pushCue(run, 'miss', now)
          if (!isMuted()) playBuzz()
        } else {
          run.engine.cues.misses += 1
          pushCue(run, 'stray', now)
          if (!isMuted()) playBuzz()
        }
        publish(run)
        return
      }
      if (pc !== active.pc) {
        run.engine.cues.misses += 1
        pushCue(run, 'stray', now)
        if (!isMuted()) playBuzz()
        publish(run)
        return
      }
      const timing = gradeTiming(now - active.litAt, active.hold)
      active.resolved = true
      if (timing === 'late') run.engine.cues.late += 1
      else run.engine.cues.hits += 1
      pushCue(run, timing === 'late' ? 'good' : timing, now)
      if (!isMuted()) playChord([pc], { duration: 0.25 })
      publish(run)
    },
    [publish, pushCue, tapStation],
  )

  useNoteSequence({ active: phase === 'run', onNote: tapKey })

  function toggleSound() {
    const next = !sound
    setSound(next)
    setMuted(!next)
  }

  function back() {
    if (phase === 'run') {
      pauseRun()
      setLeaveAsk(true)
      return
    }
    if (phase === 'paused') {
      setLeaveAsk(true)
      return
    }
    if (phase === 'count') {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
      runRef.current.ended = true
      setPhase('ready')
      return
    }
    onExit()
  }

  function leave() {
    // End & bank: submit the partial run, then show what was banked.
    const run = runRef.current
    if (run && !run.ended) finish(run)
    else onExit()
  }

  const ordinal = Math.min(GOAL, view.cleared + 1)
  const interactive = phase === 'run' && view.mode !== 'verdict'
  const instruction = view.station ? INSTRUCTIONS[Math.min(3, view.station.tapped.length)] : ''

  return (
    <section className="house" aria-label="Seventh House">
      <div className="house__bar">
        <span className="house__key">{keyDisplay(keyId)} MAJOR</span>
        <button type="button" className="house__btn" onClick={toggleSound} aria-pressed={sound}>
          SOUND {sound ? 'ON' : 'OFF'}
        </button>
        <button type="button" className="house__btn" onClick={back}>
          BACK
        </button>
      </div>

      <div className="house__hud">
        <span className="house__count">CHORDS {view.cleared}/14</span>
        <Pips degrees={view.degrees} />
        <span className="house__acc">ACC {view.accuracy}%</span>
      </div>

      {phase === 'summary' && summary ? (
        <div className="house__field house__field--summary">
          <div className="house__summary">
            <span className="house__stamp">
              <HouseMark size={34} />
              <span>{summary.complete ? 'HOUSE BUILT' : 'HOUSE BANKED'}</span>
            </span>
            <span className="house__summaryline">
              {keyDisplay(keyId)} MAJOR · {clock(summary.durationMs)} · {summary.cues} CUES
            </span>
            <div className="house__band">
              <span className="house__cell">
                <span className="house__cellval">{clock(summary.durationMs)}</span>
                <span className="house__celllabel">TIME</span>
              </span>
              <span className="house__cell">
                <span className="house__cellval">{summary.cues}</span>
                <span className="house__celllabel">CUES</span>
              </span>
              <span className="house__cell">
                <span className="house__cellval">{summary.accuracy}%</span>
                <span className="house__celllabel">ACC</span>
              </span>
            </div>
            <table className="house__table">
              <thead>
                <tr>
                  <th scope="col">CHORD</th>
                  <th scope="col">NUM</th>
                  <th scope="col">HITS / TRIES</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => {
                  const tries = row.correct + row.missed
                  return (
                    <tr key={row.numeral + row.name}>
                      <td>{row.name}</td>
                      <td>{row.numeral}</td>
                      <td className={tries > row.correct ? 'is-back' : undefined}>
                        {row.correct}/{tries}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="house__came">
              {summary.complete
                ? summary.cameBack === 0
                  ? 'NOTHING CAME BACK.'
                  : `${summary.cameBack} CAME BACK.`
                : `${GOAL - summary.cleared} CHORDS SHORT.`}
            </p>
            <button type="button" className="house__again" onClick={start}>
              PLAY IT AGAIN
            </button>
            <button type="button" className="house__desk" onClick={onExit}>
              BACK TO DESK
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="house__field">
            {view.station ? (
              <div className="house__station">
                <div className="house__stationname">
                  <span className="house__eyebrow">CHORD {ordinal} / 14</span>
                  <span className="house__name">{view.station.name}</span>
                  <span className="house__rule" aria-hidden="true" />
                  <span className="house__numeral">{view.station.numeral}</span>
                </div>
                <div className="house__stationbuild">
                  <div className="house__built">
                    <span className="house__builtlabel">YOU BUILT</span>
                    <div className="house__cells">
                      {[0, 1, 2, 3].map((index) => (
                        <span className="house__slot" key={index}>
                          {view.station.tapped[index] == null
                            ? '—'
                            : noteName(view.station.tapped[index])}
                        </span>
                      ))}
                    </div>
                  </div>
                  {view.verdict ? (
                    <div className="house__verdict">
                      <span className={`house__verdictstamp is-${view.verdict.kind}`}>
                        {view.verdict.kind === 'clear' ? 'CLEAR' : 'MISS'}
                      </span>
                      {view.verdict.kind === 'clear' ? (
                        <span className="house__verdictsub">
                          {view.verdict.numeral} · {view.verdict.clears} OF 2
                        </span>
                      ) : (
                        <span className="house__verdictback">
                          {view.verdict.numeral} COMES BACK
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="house__instruction">{instruction}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="house__stream">
                <div
                  className={`house__word${view.cue ? ` house__word--${view.cue.tone}` : ' is-empty'}`}
                  aria-hidden="true"
                >
                  {view.cue ? view.cue.text : ''}
                </div>
              </div>
            )}

            {phase === 'ready' ? (
              <div className="house__ready">
                <span className="house__stamp house__stamp--ready">
                  <HouseMark size={34} />
                  <span>SEVENTH HOUSE</span>
                </span>
                <span className="house__readytitle">
                  BUILD THE SEVEN CHORDS OF {keyDisplay(keyId)} MAJOR. TWICE EACH.
                </span>
                <span className="house__eyebrow">14 CHORDS · 4 NOTES BETWEEN</span>
                <button type="button" className="house__start" onClick={start}>
                  START
                </button>
              </div>
            ) : null}

            {phase === 'count' ? (
              <div className="house__countover">
                <span className="house__countword">{COUNT_WORDS[countWord]}</span>
              </div>
            ) : null}

            {leaveAsk ? (
              <div className="house__confirm">
                <span>END THIS RUN?</span>
                <button type="button" className="house__btn" onClick={leave}>
                  END &amp; BANK IT
                </button>
                <button type="button" className="house__btn" onClick={resumeRun}>
                  KEEP GOING
                </button>
              </div>
            ) : phase === 'paused' ? (
              <div className="house__confirm">
                <span>PAUSED</span>
                <button type="button" className="house__btn" onClick={resumeRun}>
                  RESUME
                </button>
              </div>
            ) : null}
          </div>

          <PianoKeys
            lit={view.lit}
            onKey={tapKey}
            disabled={!interactive}
            dim={view.mode !== 'stream'}
          />
        </>
      )}

      <p className="house__live" aria-live="polite">
        {phase === 'count'
          ? COUNT_WORDS[countWord]
          : view.verdict
            ? view.verdict.kind === 'clear'
              ? 'Clear.'
              : 'Miss. It comes back.'
            : view.station
              ? `Build ${view.station.name}. ${view.station.numeral}. ${instruction}.`
              : view.cue
                ? view.cue.text
                : summary
                  ? `${summary.cleared} of 14 chords. Accuracy ${summary.accuracy} percent.`
                  : ''}
      </p>
    </section>
  )
}
