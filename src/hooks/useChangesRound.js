import { useCallback, useEffect, useRef, useState } from 'react'
import { useNoteSequence } from './useNoteSequence.js'
import { playCountIn, unlockAudio } from '../session/audio.js'
import { createTransport } from '../session/transport.js'
import { buildJamDegrees } from '../session/set.js'
import {
  bestFor,
  CHANGE_WINDOW_MS,
  CHANGES_ROUND_SECONDS,
  saveRound,
  scoreChangeChord,
  targetForDegree,
} from '../session/changes.js'

const EMPTY = {
  score: 0,
  combo: 0,
  bestCombo: 0,
  hits: 0,
  changes: 0,
  accuracy: 0,
  voiceLead: 0,
  notes: 0,
}

// A 30-second comping round over the looping changes. The backing keeps going
// after the window closes; scoring stops at the bell.
export function useChangesRound({
  keyId,
  changesId,
  barsPerChord,
  bpm = 84,
  roundSeconds = CHANGES_ROUND_SECONDS,
  degrees = null,
  onRoundEnd,
}) {
  const [phase, setPhase] = useState('idle')
  const [live, setLive] = useState(EMPTY)
  const [round, setRound] = useState(null)
  const [position, setPosition] = useState(null)
  const [remaining, setRemaining] = useState(roundSeconds)

  const mountedRef = useRef(true)
  const transportRef = useRef(null)
  const startedRef = useRef(false)
  const scoringRef = useRef(false)
  const tokenRef = useRef(0)
  const intervalRef = useRef(null)
  const degreesRef = useRef([])
  const notesRef = useRef([])
  const pendingRef = useRef([])
  const statsRef = useRef({ ...EMPTY })
  const previousMidiRef = useRef(null)
  const roundEndRef = useRef(0)
  const keyRef = useRef(keyId)
  const paramsRef = useRef({ changesId, barsPerChord, bpm, roundSeconds, degrees })
  const onRoundEndRef = useRef(onRoundEnd)
  keyRef.current = keyId
  paramsRef.current = { changesId, barsPerChord, bpm, roundSeconds, degrees }
  onRoundEndRef.current = onRoundEnd

  const clearPending = useCallback(() => {
    for (const entry of pendingRef.current) clearTimeout(entry.timer)
    pendingRef.current = []
  }, [])

  const stopInternal = useCallback(() => {
    tokenRef.current += 1
    startedRef.current = false
    scoringRef.current = false
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    clearPending()
    transportRef.current?.stop()
    transportRef.current = null
  }, [clearPending])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopInternal()
    }
  }, [stopInternal])

  // The backing belongs to the run it started with.
  useEffect(() => {
    stopInternal()
    setPhase('idle')
    setPosition(null)
    setLive({ ...EMPTY })
    setRound(null)
    setRemaining(roundSeconds)
  }, [keyId, changesId, barsPerChord, roundSeconds, stopInternal])

  const resetStats = useCallback(() => {
    statsRef.current = { ...EMPTY }
    previousMidiRef.current = null
    notesRef.current = []
    setLive({ ...EMPTY })
    setRound(null)
    setRemaining(roundSeconds)
  }, [roundSeconds])

  function finishChange(event) {
    const current = statsRef.current
    const start = event.at - CHANGE_WINDOW_MS
    const end = event.at + CHANGE_WINDOW_MS
    const played = notesRef.current.filter((note) => note.at >= start && note.at <= end)
    const midi = played.map((note) => note.midi).filter(Number.isFinite)
    const timingMs = played.length
      ? Math.min(...played.map((note) => Math.abs(note.at - event.at)))
      : 0
    const outcome = scoreChangeChord({
      targetPcs: event.target.pcs,
      triadPcs: event.target.triadPcs,
      playedMidi: midi,
      previousMidi: previousMidiRef.current,
      timingMs,
      combo: current.combo,
    })
    const next = {
      ...current,
      score: current.score + outcome.points,
      combo: outcome.combo,
      bestCombo: Math.max(current.bestCombo, outcome.combo),
      hits: current.hits + (outcome.hit ? 1 : 0),
      changes: current.changes + 1,
      voiceLead: current.voiceLead + outcome.voiceLead,
    }
    next.accuracy = next.changes ? Math.round((next.hits / next.changes) * 100) : 0
    statsRef.current = next
    setLive(next)
    if (outcome.hit) previousMidiRef.current = midi
  }

  function scheduleChange(degree) {
    if (!startedRef.current || !scoringRef.current) return
    const at = performance.now()
    if (at > roundEndRef.current) return
    const event = { at, degree, target: targetForDegree(keyRef.current, degree) }
    const timer = setTimeout(() => {
      pendingRef.current = pendingRef.current.filter((entry) => entry.timer !== timer)
      if (scoringRef.current || at <= roundEndRef.current) finishChange(event)
    }, CHANGE_WINDOW_MS + 45)
    pendingRef.current.push({ timer, event })
  }

  function beginTransport() {
    if (!startedRef.current) return
    const next = createTransport({
      keyId: keyRef.current,
      bpm: paramsRef.current.bpm,
      degrees: degreesRef.current,
      onChord: (_bar, degree) => scheduleChange(degree),
      onEnd: () => {
        if (!startedRef.current || !mountedRef.current) return
        beginTransport()
      },
    })
    transportRef.current = next
    void next.start()
  }

  function flushPending() {
    const now = performance.now()
    for (const entry of pendingRef.current) {
      clearTimeout(entry.timer)
      if (entry.event.at <= roundEndRef.current && entry.event.at <= now) finishChange(entry.event)
    }
    pendingRef.current = []
  }

  function resultFromStats() {
    const params = paramsRef.current
    const stats = statsRef.current
    return {
      ...stats,
      at: Date.now(),
      keyId: keyRef.current,
      changesId: params.changesId,
      barsPerChord: params.barsPerChord,
    }
  }

  function endRound() {
    if (!scoringRef.current) return null
    scoringRef.current = false
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    flushPending()
    const result = resultFromStats()
    const stored = saveRound({
      at: result.at,
      keyId: result.keyId,
      changesId: result.changesId,
      barsPerChord: result.barsPerChord,
      score: result.score,
      accuracy: result.accuracy,
      voiceLead: result.voiceLead,
      notes: result.notes,
    })
    const withBest = {
      ...result,
      best: bestFor(stored, result.keyId, result.changesId, result.barsPerChord),
    }
    setRound(withBest)
    setRemaining(0)
    setPhase('practice')
    onRoundEndRef.current?.(withBest)
    return withBest
  }

  function checkRound() {
    const left = roundEndRef.current - performance.now()
    setRemaining(Math.max(0, Math.ceil(left / 1000)))
    if (left <= 0) endRound()
  }

  const start = useCallback(async () => {
    unlockAudio()
    stopInternal()
    resetStats()
    // A tune preset brings its own progression; otherwise the named one.
    degreesRef.current = paramsRef.current.degrees?.length
      ? paramsRef.current.degrees
      : buildJamDegrees(paramsRef.current.changesId, paramsRef.current.barsPerChord)
    const token = tokenRef.current
    setPhase('countin')
    await playCountIn(paramsRef.current.bpm)
    if (!mountedRef.current || token !== tokenRef.current) return
    startedRef.current = true
    scoringRef.current = true
    roundEndRef.current = performance.now() + paramsRef.current.roundSeconds * 1000
    setRemaining(paramsRef.current.roundSeconds)
    setPhase('scoring')
    beginTransport()
    intervalRef.current = setInterval(checkRound, 100)
  }, [stopInternal, resetStats])

  const stop = useCallback(() => {
    const wasScoring = scoringRef.current
    const result = round || resultFromStats()
    stopInternal()
    setPhase('idle')
    setPosition(null)
    return wasScoring ? result : round
  }, [round, stopInternal])

  function handleNote(pc, midi) {
    if (!scoringRef.current) return
    notesRef.current.push({
      pc,
      midi: Number.isFinite(midi) ? midi : 60 + pc,
      at: performance.now(),
    })
    if (notesRef.current.length > 400) notesRef.current.shift()
    const next = { ...statsRef.current, notes: statsRef.current.notes + 1 }
    statsRef.current = next
    setLive(next)
  }

  useNoteSequence({
    active: phase === 'scoring',
    allowRepeats: true,
    onNote: handleNote,
    onSilence: () => {},
  })

  useEffect(() => {
    if (phase !== 'scoring' && phase !== 'practice') return
    const timer = setInterval(() => {
      setPosition(transportRef.current?.current() || null)
    }, 80)
    return () => clearInterval(timer)
  }, [phase])

  return { phase, live, round, position, remaining, start, runAgain: start, stop }
}
