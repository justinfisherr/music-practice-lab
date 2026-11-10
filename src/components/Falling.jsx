import { useCallback, useEffect, useRef, useState } from 'react'
import PianoKeys from './PianoKeys.jsx'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { keyDisplay } from '../data/scales.js'
import { laDate, seedFor, tonightKey } from '../session/tonight.js'
import {
  CLEAR_MS,
  CUE_WORD_MS,
  RUN_CUES,
  bestScore,
  breakSweep,
  buildRun,
  gradeTiming,
  multiplierFor,
  pointsFor,
  saveBest,
  startBreak,
} from '../session/arcade.js'
import {
  isMuted,
  playBuzz,
  playChord,
  playCountIn,
  setMuted,
  unlockAudio,
} from '../session/audio.js'

// Lit-key prototype: a cue lights keys on the one-octave piano and the lit
// window is the grade window. No ledger row, no session, no API call.

const COUNT_WORDS = ['READY', '3', '2', '1', 'GO']
const COUNT_MS = 600

const CUE_WORD = {
  perfect: 'PERFECT',
  good: 'GOOD',
  miss: 'MISS',
  bomb: 'BOMB',
  ok: 'OK',
  stray: 'STRAY',
}

function say(summary) {
  if (summary.bombs >= 2) return 'BOMBS ARE NOT IN THE KEY.'
  if (summary.accuracy >= 95) return 'NOTHING OFF-SCALE GOT THROUGH.'
  if (summary.accuracy >= 80) return 'A FEW SLIPPED. THE KEY KNOWS.'
  return 'YOU PLAYED THE WRONG SCALE.'
}

// One word at a time, replaced by the next grade.
function pushCue(run, tone, now) {
  run.cueSeq += 1
  run.cue = { id: run.cueSeq, tone, text: CUE_WORD[tone], combo: run.streak, until: now + CUE_WORD_MS }
}

const EMPTY = {
  lit: {},
  cue: null,
  break: null,
  clear: null,
  next: null,
  score: 0,
  streak: 0,
  hits: 0,
  misses: 0,
  index: 0,
}

export default function Falling({ onExit }) {
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
  const keyIdRef = useRef(tonightKey())
  phaseRef.current = phase

  const publish = useCallback((run, now) => {
    const lit = {}
    if (run.active) {
      for (const pc of run.active.pcs) if (!run.active.pressed.has(pc)) lit[pc] = run.active.kind
    }
    let breaking = null
    if (run.break) {
      const { cue, start } = run.break
      const swept = breakSweep(start, now)
      for (let i = 0; i < swept; i++) lit[cue.sweep[i]] = 'chord'
      breaking = { name: cue.label, numeral: cue.numeral, notes: cue.notesText }
    }
    const upcoming = run.cues[run.cursor]
    setView({
      lit,
      cue: run.cue,
      break: breaking,
      clear: run.clear ? run.clear.label : null,
      next: upcoming ? (upcoming.kind === 'chord' ? upcoming.label : '1 NOTE') : null,
      score: run.score,
      streak: run.streak,
      hits: run.hits,
      misses: run.misses,
      index: run.cursor,
    })
  }, [])

  const finish = useCallback(() => {
    const run = runRef.current
    if (!run || run.ended) return
    run.ended = true
    const graded = run.hits + run.misses
    const newBest = saveBest(run.score)
    setSummary({
      score: run.score,
      accuracy: graded ? Math.round((100 * run.hits) / graded) : 0,
      bombs: run.bombsHit,
      bestStreak: run.bestStreak,
      newBest,
      best: Math.max(bestScore(), run.score),
    })
    setPhase('summary')
  }, [])

  // Resolve the cue whose light just went out and light the next one due. Run
  // from the frame loop and again on a tap, so a tap never grades the wrong cue.
  const advance = useCallback((run, now) => {
    let dirty = false
    const active = run.active
    if (active && now >= active.darkAt) {
      run.active = null
      if (active.kind === 'bomb') {
        pushCue(run, 'ok', now) // letting a bomb go dark is the play
      } else {
        // Expiry costs the streak, never the points already banked.
        run.misses += active.pcs.filter((pc) => !active.pressed.has(pc)).length
        run.streak = 0
        pushCue(run, 'miss', now)
      }
      dirty = true
    }

    while (!run.active && run.cursor < run.cues.length && now >= run.cues[run.cursor].litAt) {
      const cue = run.cues[run.cursor++]
      // A stalled frame can arrive after the whole light: grade it, move on.
      if (now < cue.darkAt) {
        if (cue.kind === 'chord') {
          startBreak(run, cue, now)
        } else {
          run.active = cue
          if (!isMuted()) playChord(cue.pcs, { duration: 0.4 })
        }
        dirty = true
        break
      }
      if (cue.kind === 'bomb') {
        pushCue(run, 'ok', now)
      } else {
        run.misses += cue.pcs.length
        run.streak = 0
        pushCue(run, 'miss', now)
      }
      dirty = true
    }

    return dirty
  }, [])

  const tick = useCallback(() => {
    const run = runRef.current
    if (!run || run.ended || phaseRef.current !== 'run') return
    const now = performance.now()
    let dirty = false

    if (run.break) {
      // The break holds the clock: the sweep advances, nothing grades.
      const swept = breakSweep(run.break.start, now)
      if (swept !== run.break.swept) {
        run.break.swept = swept
        dirty = true
      }
      if (now >= run.break.until) {
        run.active = run.break.cue
        run.break = null
        if (!isMuted()) playChord(run.active.pcs, { duration: 0.5 })
        dirty = true
      }
    } else {
      dirty = advance(run, now)
    }

    if (run.cue && now >= run.cue.until) {
      run.cue = null
      dirty = true
    }
    if (run.clear && now >= run.clear.until) {
      run.clear = null
      dirty = true
    }

    if (dirty) publish(run, now)
    if (run.cursor >= run.cues.length && !run.active && !run.break) finish()
  }, [advance, publish, finish])

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
    run.pausedAt = performance.now()
    setPhase('paused')
  }, [])

  // Freeze, don't clear: lit keys stay lit and every pending window shifts by
  // the hidden time, so a pause never hands out a free miss.
  const resumeRun = useCallback(() => {
    const run = runRef.current
    if (!run || !run.pausedAt) return
    const hidden = performance.now() - run.pausedAt
    run.pausedAt = 0
    for (const cue of run.cues) {
      cue.litAt += hidden
      cue.darkAt += hidden
    }
    if (run.break) {
      run.break.start += hidden
      run.break.until += hidden
    }
    if (run.cue) run.cue.until += hidden
    if (run.clear) run.clear.until += hidden
    setLeaveAsk(false)
    setPhase('run')
    publish(run, performance.now())
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
    const keyId = tonightKey()
    keyIdRef.current = keyId
    const cues = buildRun({ keyId, seed: seedFor(laDate(), keyId) ^ attemptRef.current }).map(
      (cue) => ({ ...cue, litAt: 0, darkAt: 0, pressed: new Set() }),
    )

    runRef.current = {
      cues,
      cursor: 0,
      active: null,
      break: null,
      clear: null,
      cue: null,
      cueSeq: 0,
      pausedAt: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      hits: 0,
      misses: 0,
      bombsHit: 0,
      ended: false,
    }

    setSummary(null)
    setLeaveAsk(false)
    setCountWord(0)
    setView({ ...EMPTY, next: cues[0].kind === 'chord' ? cues[0].label : '1 NOTE' })
    setPhase('count')
    unlockAudio() // iOS only opens the context inside a real gesture
    playCountIn(100, 4)

    COUNT_WORDS.forEach((_, index) => {
      timersRef.current.push(setTimeout(() => setCountWord(index), index * COUNT_MS))
    })
    timersRef.current.push(
      setTimeout(() => {
        const startedAt = performance.now()
        for (const cue of cues) {
          cue.litAt = startedAt + cue.t
          cue.darkAt = cue.litAt + cue.hold
        }
        setPhase('run')
      }, COUNT_WORDS.length * COUNT_MS),
    )
  }, [])

  // A key is only ever the input. Lit and correct: grade it. Anything else is a
  // stray, which costs the streak and nothing else.
  const tapKey = useCallback(
    (pc) => {
      const run = runRef.current
      if (!run || run.ended || phaseRef.current !== 'run') return
      if (run.break) return // the break teaches; it never grades
      const now = performance.now()
      advance(run, now) // the next cue may have taken over this instant
      const active = run.active
      const lit = active && active.pcs.includes(pc) && !active.pressed.has(pc)

      if (!lit) {
        run.streak = 0
        pushCue(run, 'stray', now)
        if (!isMuted()) playBuzz()
        publish(run, now)
        return
      }

      if (active.kind === 'bomb') {
        run.score -= 150
        run.streak = 0
        run.bombsHit += 1
        run.active = null
        pushCue(run, 'bomb', now)
        if (!isMuted()) playBuzz()
        publish(run, now)
        return
      }

      // Every lit key grades on its own tap, so a half-entered chord keeps what
      // its keys already earned.
      active.pressed.add(pc)
      if (!isMuted()) playChord([pc], { duration: 0.25 })
      const timing = gradeTiming(now - active.litAt, active.hold)
      run.score += pointsFor(timing) * multiplierFor(run.streak)
      run.streak += 1
      run.bestStreak = Math.max(run.bestStreak, run.streak)
      run.hits += 1

      if (active.pressed.size === active.pcs.length) {
        run.active = null
        // A finished chord gets its name stamped back instead of a grade word.
        if (active.kind === 'chord') {
          run.cue = null
          run.clear = { label: active.label, until: now + CLEAR_MS }
        } else {
          pushCue(run, timing === 'late' ? 'good' : timing, now)
        }
      } else {
        pushCue(run, timing === 'late' ? 'good' : timing, now)
      }

      publish(run, now)
    },
    [advance, publish],
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
    onExit()
  }

  const graded = view.hits + view.misses
  const accuracy = graded ? Math.round((100 * view.hits) / graded) : 0

  return (
    <section className="arcade" aria-label="Lit keys test page">
      <div className="arcade__bar">
        <span className="arcade__key">{keyDisplay(keyIdRef.current)} MAJOR</span>
        <span className="arcade__count-cues">
          {Math.min(view.index, RUN_CUES)}/{RUN_CUES}
        </span>
        <button type="button" className="arcade__btn" onClick={toggleSound} aria-pressed={sound}>
          SOUND {sound ? 'ON' : 'OFF'}
        </button>
        <button type="button" className="arcade__btn" onClick={back}>
          BACK
        </button>
      </div>

      <div className="arcade__hud">
        <span className="arcade__stat">
          <span className="arcade__statlabel">SCORE</span>
          <span className="arcade__statval">{view.score}</span>
        </span>
        <span className="arcade__mult">×{multiplierFor(view.streak)}</span>
        <span className="arcade__stat arcade__stat--right">
          <span className="arcade__statlabel">ACCURACY</span>
          <span className="arcade__statval">{accuracy}%</span>
        </span>
      </div>

      {phase === 'summary' && summary ? (
        <div className="arcade__field arcade__field--summary">
          <div className="arcade__summary">
            <span className="arcade__eyebrow">RUN OVER</span>
            <span className="arcade__scorelabel">SCORE</span>
            <span className="arcade__scorenum">{summary.score}</span>
            {summary.newBest ? (
              <span className="arcade__best arcade__best--new">NEW BEST</span>
            ) : (
              <span className="arcade__best">BEST {summary.best}</span>
            )}
            <div className="arcade__cells">
              <span className="arcade__cell">
                <span className="arcade__cellval">{summary.accuracy}%</span>
                <span className="arcade__celllabel">ACCURACY</span>
              </span>
              <span className="arcade__cell">
                <span className="arcade__cellval">{summary.bombs}</span>
                <span className="arcade__celllabel">BOMBS HIT</span>
              </span>
              <span className="arcade__cell">
                <span className="arcade__cellval">{summary.bestStreak}</span>
                <span className="arcade__celllabel">BEST STREAK</span>
              </span>
            </div>
            <p className="arcade__say">{say(summary)}</p>
            <button type="button" className="arcade__again" onClick={start}>
              RUN IT BACK
            </button>
            <button type="button" className="arcade__desk" onClick={onExit}>
              BACK TO DESK
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="arcade__field">
            <div className="arcade__stage">
              <div
                className={`arcade__cue${view.cue ? ` arcade__cue--${view.cue.tone}` : ' is-empty'}${
                  view.cue && view.cue.combo >= 5 ? ' is-hot' : ''
                }`}
                aria-hidden="true"
              >
                <span className="arcade__cueword">{view.cue ? view.cue.text : ''}</span>
                {view.cue && view.cue.combo >= 2 ? (
                  <span className="arcade__combo">×{view.cue.combo}</span>
                ) : null}
              </div>
              <div className="arcade__next">
                <span className="arcade__nextlabel">NEXT</span>
                <span className="arcade__nextname">{view.next ?? '—'}</span>
              </div>
            </div>

            {view.break ? (
              <div className="arcade__break">
                <span className="arcade__breakname">{view.break.name}</span>
                <span className="arcade__breakrule" aria-hidden="true" />
                <span className="arcade__breaknum">{view.break.numeral}</span>
                <span className="arcade__breaknotes">{view.break.notes}</span>
              </div>
            ) : null}

            {view.clear ? (
              <div className="arcade__break arcade__break--clear">
                <span className="arcade__breakname">{view.clear}</span>
                <span className="arcade__breakrule" aria-hidden="true" />
                <span className="arcade__breakclear">CLEAR</span>
              </div>
            ) : null}

            {phase === 'ready' ? (
              <div className="arcade__ready">
                <span className="arcade__eyebrow">TEST · LIT KEYS</span>
                <span className="arcade__readytitle">
                  TAP THE KEYS THAT LIGHT. DON'T PRESS THE BOMBS.
                </span>
                <span className="arcade__eyebrow">
                  {RUN_CUES} CUES · {keyDisplay(keyIdRef.current)} MAJOR
                </span>
                <button type="button" className="arcade__start" onClick={start}>
                  START
                </button>
              </div>
            ) : null}

            {phase === 'count' ? (
              <div className="arcade__count">
                <span className="arcade__countword">{COUNT_WORDS[countWord]}</span>
              </div>
            ) : null}

            {leaveAsk ? (
              <div className="arcade__confirm">
                <span>LEAVE THIS RUN?</span>
                <button type="button" className="arcade__btn" onClick={onExit}>
                  LEAVE
                </button>
                <button type="button" className="arcade__btn" onClick={resumeRun}>
                  KEEP GOING
                </button>
              </div>
            ) : phase === 'paused' ? (
              <div className="arcade__confirm">
                <span>PAUSED</span>
                <button type="button" className="arcade__btn" onClick={resumeRun}>
                  RESUME
                </button>
              </div>
            ) : null}
          </div>

          <PianoKeys lit={view.lit} onKey={tapKey} disabled={phase !== 'run'} />
        </>
      )}

      <p className="arcade__live" aria-live="polite">
        {phase === 'count'
          ? COUNT_WORDS[countWord]
          : view.break
            ? `Chord ${view.break.name}. ${view.break.numeral}. ${view.break.notes}.`
            : view.clear
              ? `${view.clear} clear.`
              : view.cue
                ? view.cue.text
                : summary
                  ? `Run over. Score ${summary.score}. Accuracy ${summary.accuracy} percent.`
                  : ''}
      </p>
    </section>
  )
}
