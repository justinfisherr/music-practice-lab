import { useCallback, useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import { laDate, seedFor, tonightKey } from '../session/tonight.js'
import {
  CHORD_STEP_MS,
  FALL_MS,
  HIT_MS,
  RUN_NOTES,
  RUN_MS,
  bestScore,
  buildRun,
  deltaFor,
  grade,
  gradeTiming,
  multiplierFor,
  saveBest,
} from '../session/arcade.js'
import { isMuted, playCountIn, setMuted, unlockAudio } from '../session/audio.js'

// Prototype: the falling block is the tap target. No ledger row, no session,
// no API call. A MIDI keyboard still feeds the same graders.

const COUNT_WORDS = ['READY', '3', '2', '1', 'GO']
const COUNT_MS = 600
const CUE_MS = 360 // 90 slam, 120 hold, 150 out
const CHORD_ROW = 20

const CUE_WORD = {
  perfect: 'PERFECT',
  good: 'GOOD',
  miss: 'MISS',
  bomb: 'BOMB',
  ok: 'OK',
  stray: 'STRAY',
}

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

function onLine(run, now) {
  return run.visible.find((event) => !event.status && now >= event.start && now <= event.end) || null
}

function nextUp(run, now) {
  return run.visible.find((event) => !event.status && event.arrival > now) || null
}

// One word at a time, replaced by the next grade.
function pushCue(run, tone, now) {
  run.cueSeq += 1
  run.cue = { id: run.cueSeq, tone, text: CUE_WORD[tone], combo: run.streak, until: now + CUE_MS }
}

function resolveTap(run, event, now) {
  if (event.kind === 'bomb') {
    event.status = 'bomb'
    event.goneAt = now + 300
    run.score -= 250
    run.streak = 0
    run.bombsHit += 1
    pushCue(run, 'bomb', now)
    return
  }
  const timing = gradeTiming(deltaFor(event, now - run.startedAt))
  if (timing === 'miss') {
    event.status = 'miss'
    event.goneAt = now
    run.streak = 0
    run.misses += 1
    pushCue(run, 'miss', now)
    return
  }
  run.score += 100 * multiplierFor(run.streak)
  run.hits += 1
  run.streak += 1
  run.bestStreak = Math.max(run.bestStreak, run.streak)
  event.status = 'hit'
  event.goneAt = now + 180
  pushCue(run, timing, now)
}

export default function Falling({ onExit }) {
  const [phase, setPhase] = useState('ready')
  const [view, setView] = useState({
    notes: [],
    cue: null,
    score: 0,
    streak: 0,
    hits: 0,
    misses: 0,
    line: null,
    next: null,
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
    const line = reducedRef.current ? onLine(run, now) : null
    setView({
      notes: run.visible.map((event) => ({
        id: event.id,
        kind: event.kind,
        pcs: event.pcs,
        status: event.status,
        delay: event.delay,
        column: event.column,
      })),
      cue: run.cue,
      score: run.score,
      streak: run.streak,
      hits: run.hits,
      misses: run.misses,
      line: line ? { id: line.id, pcs: line.pcs } : null,
      next: reducedRef.current ? (nextUp(run, now)?.pcs ?? null) : null,
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
        pushCue(run, 'ok', now)
      } else {
        event.status = 'miss'
        event.goneAt = now + 220
        run.streak = 0
        run.misses += 1
        pushCue(run, 'miss', now)
      }
      dirty = true
    }

    const before = run.visible.length
    run.visible = run.visible.filter((event) => !event.goneAt || now < event.goneAt)
    if (run.visible.length !== before) dirty = true

    if (run.cue && now >= run.cue.until) {
      run.cue = null
      dirty = true
    }

    // Reduced motion draws only the line and the next note, so those two swaps
    // are the only thing that changes between frames.
    if (reducedRef.current) {
      const lineId = onLine(run, now)?.id ?? 0
      const nextId = nextUp(run, now)?.id ?? 0
      if (lineId !== run.lineId || nextId !== run.nextId) {
        run.lineId = lineId
        run.nextId = nextId
        dirty = true
      }
    }

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
    run.cue = null
    setLeaveAsk(false)
    setRunKey((value) => value + 1)
    setPhase('run')
    publish(run, now)
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
    const events = buildRun({ keyId, seed: seedFor(laDate(), keyId) ^ attemptRef.current }).map(
      (event, id) => ({
        ...event,
        id,
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
      cue: null,
      cueSeq: 0,
      startedAt: 0,
      pausedAt: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      hits: 0,
      misses: 0,
      bombsHit: 0,
      lineId: 0,
      nextId: 0,
      ended: false,
    }
    setSummary(null)
    setElapsed(0)
    setLeaveAsk(false)
    setCountWord(0)
    setView({
      notes: [],
      cue: null,
      score: 0,
      streak: 0,
      hits: 0,
      misses: 0,
      line: null,
      next: null,
    })
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

  // Tapping a block grades that block. Anything else in the field is a stray.
  const tapBlock = useCallback(
    (id) => {
      const run = runRef.current
      if (!run || run.ended || phaseRef.current !== 'run') return
      const now = performance.now()
      const event = id == null ? null : run.visible.find((row) => row.id === id && !row.status)
      if (!event) {
        run.streak = 0
        pushCue(run, 'stray', now)
        publish(run, now)
        return
      }
      resolveTap(run, event, now)
      publish(run, now)
    },
    [publish],
  )

  // Keyboard input keeps working at the desk: a pitch class finds its block.
  const tapPc = useCallback(
    (pc) => {
      const run = runRef.current
      if (!run || run.ended || phaseRef.current !== 'run') return
      const now = performance.now()
      const found = grade(run.events, pc, now - run.startedAt, (event) => event.status !== null)
      if (!found.event) {
        run.streak = 0
        pushCue(run, 'stray', now)
        publish(run, now)
        return
      }
      resolveTap(run, found.event, now)
      publish(run, now)
    },
    [publish],
  )

  useNoteSequence({ active: phase === 'run', onNote: tapPc })

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
        <div
          className={`arcade__field${phase === 'paused' ? ' is-paused' : ''}`}
          ref={measure}
          onPointerDown={(event) => {
            const node = event.target.closest?.('.arcade__note')
            tapBlock(node ? Number(node.dataset.id) : null)
          }}
        >
          <div className="arcade__lane" key={runKey} aria-hidden="true">
            {reduced
              ? null
              : view.notes.map((note) => (
                  <div
                    key={note.id}
                    data-id={note.id}
                    className={`arcade__note${note.kind === 'chord' ? ' arcade__note--chord' : ''}${
                      note.status ? ` is-${note.status}` : ''
                    }`}
                    style={{
                      gridColumn: `${note.column + 1}`,
                      animationDelay: `${note.delay}ms`,
                      height:
                        note.kind === 'chord' ? `${note.pcs.length * CHORD_ROW + 16}px` : undefined,
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
                  {view.next ? view.next.map(noteName).join(' ') : '—'}
                </span>
              </div>
              {view.line ? (
                <div className="arcade__note arcade__note--static" data-id={view.line.id}>
                  <span className="arcade__name">
                    {view.line.pcs.map((pc) => (
                      <span key={pc} className="arcade__pc">
                        {noteName(pc)}
                      </span>
                    ))}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {view.cue ? (
            <div
              key={view.cue.id}
              className={`arcade__cue arcade__cue--${view.cue.tone}${
                view.cue.combo >= 5 ? ' is-hot' : ''
              }`}
              aria-hidden="true"
            >
              <span className="arcade__cueword">{view.cue.text}</span>
              {view.cue.combo >= 2 ? <span className="arcade__combo">×{view.cue.combo}</span> : null}
            </div>
          ) : null}

          {phase === 'ready' ? (
            <div className="arcade__ready">
              <span className="arcade__eyebrow">TEST · FALLING NOTES</span>
              <span className="arcade__readytitle">
                TAP THE NOTE IF IT'S IN THE KEY. LET THE REST THROUGH.
              </span>
              <span className="arcade__eyebrow">
                {RUN_NOTES} NOTES · 60 SECONDS · {keyDisplay(keyIdRef.current)} MAJOR
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
      )}

      <p className="arcade__live" aria-live="polite">
        {phase === 'count'
          ? COUNT_WORDS[countWord]
          : view.cue
            ? view.cue.text
            : summary
              ? `Run over. Score ${summary.score}. Accuracy ${summary.accuracy} percent.`
              : ''}
      </p>
    </section>
  )
}
