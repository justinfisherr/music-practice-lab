import { useCallback, useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import NotePad from './NotePad.jsx'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import { laDate, seedFor, tonightKey } from '../session/tonight.js'
import {
  CHORD_STEP_MS,
  FALL_MS,
  HIT_MS,
  RUN_MS,
  bestScore,
  buildRun,
  grade,
  multiplierFor,
  saveBest,
} from '../session/arcade.js'
import { isMuted, playCountIn, setMuted, unlockAudio } from '../session/audio.js'

// Prototype: does a falling-note game feel good on a phone with the 12-key pad?
// Throwaway on purpose: no ledger row, no session, no API call.

const COUNT_WORDS = ['READY', '3', '2', '1', 'GO']
const COUNT_MS = 600

function clock(ms) {
  const total = Math.min(60, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function say(summary) {
  if (summary.bombs >= 2) return 'BOMBS ARE NOT IN THE KEY.'
  if (summary.accuracy >= 95) return 'NOTHING OFF-SCALE GOT THROUGH.'
  if (summary.accuracy >= 80) return 'A FEW SLIPPED. THE KEY KNOWS.'
  return 'YOU PLAYED THE WRONG SCALE.'
}

// The one note due next gets the pad hint; two hard states, no animation.
// Reduced motion gets it with the note and keeps it static.
function nearestHint(run, now, reduced) {
  let best = null
  for (const event of run.visible) {
    if (event.status) continue
    if (!reduced && event.arrival - now > 300) continue
    if (!best || event.arrival < best.arrival) best = event
  }
  if (!best) return { hint: null, sig: '' }
  const bar = !reduced && best.arrival - now <= 120
  return {
    hint: { pcs: best.remaining.length ? best.remaining : best.pcs, bar },
    sig: `${best.id}:${bar ? 'b' : 'o'}`,
  }
}

function onLine(run, now) {
  return run.visible.find((event) => !event.status && now >= event.start && now <= event.end) || null
}

function nextUp(run, now) {
  return run.visible.find((event) => !event.status && event.arrival > now) || null
}

export default function Falling({ onExit }) {
  const [phase, setPhase] = useState('ready')
  const [view, setView] = useState({
    notes: [],
    stamps: [],
    score: 0,
    streak: 0,
    hits: 0,
    misses: 0,
    hint: null,
    static: null,
  })
  const [elapsed, setElapsed] = useState(0)
  const [countWord, setCountWord] = useState(0)
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [sound, setSound] = useState(() => !isMuted())
  const [summary, setSummary] = useState(null)
  const [runKey, setRunKey] = useState(0)
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  const runRef = useRef(null)
  const phaseRef = useRef(phase)
  const reducedRef = useRef(reduced)
  const rafRef = useRef(0)
  const timersRef = useRef([])
  const stampId = useRef(0)
  const attemptRef = useRef(0)
  const fieldRef = useRef(null)
  const keyIdRef = useRef(tonightKey())
  phaseRef.current = phase
  reducedRef.current = reduced

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // The fall distance is a CSS var measured once per field, never React state.
  const measure = useCallback((node) => {
    if (!node) return undefined
    fieldRef.current = node
    const set = () => node.style.setProperty('--field-h', `${node.clientHeight}px`)
    set()
    const observer = new ResizeObserver(set)
    observer.observe(node)
    return () => {
      observer.disconnect()
      fieldRef.current = null
    }
  }, [])

  const publish = useCallback((run, now) => {
    const { hint, sig } = nearestHint(run, now, reducedRef.current)
    run.hintSig = sig
    const line = reducedRef.current ? onLine(run, now) : null
    setView({
      notes: run.visible.map((event) => ({
        id: event.id,
        kind: event.kind,
        pcs: event.pcs,
        status: event.status,
        delay: event.delay,
        col0: event.kind === 'chord' ? Math.min(...event.pcs.map((pc) => pc % 4)) : event.column,
        col1: event.kind === 'chord' ? Math.max(...event.pcs.map((pc) => pc % 4)) : event.column,
      })),
      stamps: run.stamps.map((stamp) => ({
        id: stamp.id,
        text: stamp.text,
        tone: stamp.tone,
        column: stamp.column,
      })),
      score: run.score,
      streak: run.streak,
      hits: run.hits,
      misses: run.misses,
      hint,
      static: reducedRef.current
        ? { line: line?.pcs || null, next: nextUp(run, now)?.pcs || null, quarter: run.quarter || 0 }
        : null,
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

  const tick = useCallback(() => {
    const run = runRef.current
    if (!run || run.ended || phaseRef.current !== 'run') return
    const now = performance.now()
    let dirty = false

    while (run.cursor < run.events.length && now >= run.events[run.cursor].arrival - FALL_MS) {
      const event = run.events[run.cursor++]
      event.delay = Math.round(event.arrival - FALL_MS - now)
      run.visible.push(event)
      dirty = true
    }

    for (const event of run.visible) {
      if (event.status || now <= event.end) continue
      if (event.kind === 'bomb') {
        // Letting a bomb through is the correct play.
        event.status = 'ok'
        event.goneAt = now + 200
        run.stamps.push({ id: stampId.current++, text: 'OK', tone: 'ok', column: event.column, until: now + 200 })
      } else {
        event.status = 'miss'
        event.goneAt = now + 220
        run.streak = 0
        run.misses += event.remaining.length
      }
      dirty = true
    }

    const before = run.visible.length
    run.visible = run.visible.filter((event) => !event.goneAt || now < event.goneAt)
    if (run.visible.length !== before) dirty = true

    const stampCount = run.stamps.length
    run.stamps = run.stamps.filter((stamp) => now < stamp.until)
    if (run.stamps.length !== stampCount) dirty = true

    if (reducedRef.current) {
      const line = onLine(run, now)
      const quarter = line
        ? Math.min(4, Math.max(1, Math.ceil((now - line.start) / ((line.end - line.start) / 4))))
        : 0
      if (quarter !== run.quarter) {
        run.quarter = quarter
        dirty = true
      }
    }

    // The hint flips twice per note, off the spawn/miss beat.
    if (nearestHint(run, now, reducedRef.current).sig !== run.hintSig) dirty = true

    if (dirty) publish(run, now)

    if (run.cursor >= run.events.length && run.visible.length === 0) finish()
  }, [publish, finish])

  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      tick()
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  useEffect(() => () => timersRef.current.forEach((timer) => clearTimeout(timer)), [])

  useEffect(() => {
    if (phase !== 'run') return undefined
    const id = setInterval(() => {
      const run = runRef.current
      if (!run) return
      const ms = Math.min(RUN_MS, performance.now() - run.startedAt)
      setElapsed(ms)
      if (ms >= RUN_MS) finish()
    }, 200)
    return () => clearInterval(id)
  }, [phase, finish])

  const pauseRun = useCallback(() => {
    const run = runRef.current
    if (!run || run.ended || run.pausedAt || phaseRef.current !== 'run') return
    run.pausedAt = performance.now()
    setPhase('paused')
  }, [])

  // Every pending arrival moves by the hidden duration, so a frozen field does
  // not hand out free misses.
  const resumeRun = useCallback(() => {
    const run = runRef.current
    if (!run || !run.pausedAt) return
    const hidden = performance.now() - run.pausedAt
    run.pausedAt = 0
    run.startedAt += hidden
    const now = performance.now()
    for (const event of run.events) {
      event.arrival += hidden
      event.start += hidden
      event.end += hidden
      if (!event.status) event.delay = Math.round(event.arrival - FALL_MS - now)
    }
    setLeaveAsk(false)
    setRunKey((value) => value + 1)
    setPhase('run')
  }, [])

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
    const events = buildRun({ keyId, seed: seedFor(laDate(), keyId) ^ attemptRef.current }).map(
      (event, id) => ({
        ...event,
        id,
        remaining: event.pcs.slice(),
        status: null,
        goneAt: 0,
        delay: 0,
        extra: event.kind === 'chord' ? CHORD_STEP_MS * (event.pcs.length - 1) : 0,
      }),
    )

    runRef.current = {
      events,
      cursor: 0,
      visible: [],
      stamps: [],
      startedAt: 0,
      pausedAt: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      hits: 0,
      misses: 0,
      bombsHit: 0,
      quarter: 0,
      hintSig: '',
      ended: false,
    }
    setSummary(null)
    setElapsed(0)
    setLeaveAsk(false)
    setCountWord(0)
    setView({ notes: [], stamps: [], score: 0, streak: 0, hits: 0, misses: 0, hint: null, static: null })
    setPhase('count')
    unlockAudio()
    playCountIn(100, 4)

    COUNT_WORDS.forEach((_, index) => {
      timersRef.current.push(setTimeout(() => setCountWord(index), index * COUNT_MS))
    })
    timersRef.current.push(
      setTimeout(() => {
        const run = runRef.current
        run.startedAt = performance.now()
        for (const event of run.events) {
          event.arrival = run.startedAt + event.t
          event.start = event.arrival - HIT_MS
          event.end = event.arrival + HIT_MS + event.extra
        }
        setRunKey((value) => value + 1)
        setPhase('run')
      }, COUNT_WORDS.length * COUNT_MS),
    )
  }, [])

  function flashKey(pc) {
    const key = fieldRef.current?.closest('.arcade')?.querySelectorAll('.notepad__key')[pc]
    if (!key) return
    key.classList.add('is-flash')
    timersRef.current.push(setTimeout(() => key.classList.remove('is-flash'), 90))
  }

  const tap = useCallback(
    (pc) => {
      const run = runRef.current
      if (!run || run.ended || phaseRef.current !== 'run') return
      const now = performance.now()
      const found = grade(run.events, pc, now - run.startedAt, (event) => event.status !== null)

      if (!found.event) {
        run.streak = 0
        run.stamps.push({
          id: stampId.current++,
          text: 'STRAY',
          tone: 'stray',
          column: pc % 4,
          until: now + 200,
        })
        publish(run, now)
        return
      }

      const event = found.event
      if (found.result === 'bomb') {
        event.status = 'bomb'
        event.goneAt = now + 300
        run.score -= 250
        run.streak = 0
        run.bombsHit += 1
        flashKey(pc)
      } else {
        const multiplier = multiplierFor(run.streak)
        const points = 100 * multiplier
        run.score += points
        run.hits += 1
        run.streak += 1
        run.bestStreak = Math.max(run.bestStreak, run.streak)
        event.remaining = event.remaining.filter((value) => value !== pc)
        if (!event.remaining.length) {
          event.status = 'hit'
          event.goneAt = now + 180
        }
        run.stamps.push({
          id: stampId.current++,
          text: `+${points} Ã—${multiplier}`,
          tone: 'hit',
          column: event.column,
          until: now + 180,
        })
      }
      publish(run, now)
    },
    [publish],
  )

  useNoteSequence({ active: phase === 'run', onNote: tap })

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
    <section className="arcade" aria-label="Falling notes test page">
      <div className="arcade__bar">
        <span className="arcade__key">{keyDisplay(keyIdRef.current)} MAJOR</span>
        <span className="arcade__timer">{clock(elapsed)}</span>
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
        <span className="arcade__mult">Ã—{multiplierFor(view.streak)}</span>
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
        <div className={`arcade__field${phase === 'paused' ? ' is-paused' : ''}`} ref={measure}>
          <div className="arcade__lane" key={runKey} aria-hidden="true">
            {reduced
              ? null
              : view.notes.map((note) => (
                  <div
                    key={note.id}
                    className={`arcade__note${note.kind === 'chord' ? ' arcade__note--chord' : ''}${
                      note.status ? ` is-${note.status}` : ''
                    }`}
                    style={{
                      gridColumn: `${note.col0 + 1} / ${note.col1 + 2}`,
                      animationDelay: `${note.delay}ms`,
                      height: note.kind === 'chord' ? `${note.pcs.length * 22 + 12}px` : undefined,
                    }}
                  >
                    <span className="arcade__name">
                      {note.status === 'miss' ? (
                        'MISS'
                      ) : note.status === 'bomb' ? (
                        'BOMB'
                      ) : (
                        note.pcs.map((pc) => (
                          <span key={pc} className="arcade__pc">
                            {noteName(pc)}
                          </span>
                        ))
                      )}
                    </span>
                  </div>
                ))}
          </div>

          {reduced ? (
            <div className="arcade__static">
              <div className="arcade__next">
                <span className="arcade__staticlabel">NEXT</span>
                <span className="arcade__staticname">
                  {view.static?.next ? view.static.next.map(noteName).join(' ') : 'â€”'}
                </span>
              </div>
              <div className="arcade__online">
                <span className="arcade__staticlabel">ON THE LINE</span>
                <span className="arcade__onlinename">
                  {view.static?.line ? view.static.line.map(noteName).join(' ') : 'â€”'}
                </span>
              </div>
              <div className="arcade__segments" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`arcade__segment${(view.static?.quarter || 0) >= step ? ' is-on' : ''}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="arcade__stamps" aria-hidden="true">
            {view.stamps.map((stamp) => (
              <span
                key={stamp.id}
                className={`arcade__stamp arcade__stamp--${stamp.tone}`}
                style={{ gridColumn: `${stamp.column + 1}` }}
              >
                {stamp.text}
              </span>
            ))}
          </div>

          <div className="arcade__tray" aria-hidden="true" />

          {phase === 'ready' ? (
            <div className="arcade__ready">
              <span className="arcade__eyebrow">TEST Â· FALLING NOTES</span>
              <span className="arcade__readytitle">TAP THE NOTE ON THE LINE.</span>
              <p className="arcade__readycopy">
                Notes in {keyDisplay(keyIdRef.current)} major are yours. Off-scale notes are bombs:
                let them through. Anything else is a stray.
              </p>
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
      )}

      <p className="arcade__live" aria-live="polite">
        {phase === 'count'
          ? COUNT_WORDS[countWord]
          : summary
            ? `Run over. Score ${summary.score}. Accuracy ${summary.accuracy} percent.`
            : ''}
      </p>

      <p className="arcade__land">TURN THE PHONE UPRIGHT.</p>

      <NotePad keyId={keyIdRef.current} disabled={phase !== 'run'} hint={phase === 'run' ? view.hint : null} />
    </section>
  )
}
