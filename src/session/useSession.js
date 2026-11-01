import { useCallback, useEffect, useRef, useState } from 'react'
import { composeSession } from './compose.js'
import { laDate, seedFor, tonightKey } from './tonight.js'
import { postRun } from './api.js'
import * as store from './store.js'

const STAGES = [
  { id: 'warmup', title: 'WARM-UP' },
  { id: 'ear', title: 'EAR CHECK' },
  { id: 'hook', title: 'HOOK' },
]

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function makeStages(startedAt) {
  return STAGES.map((stage, index) => ({
    id: stage.id,
    position: index,
    attempts: 0,
    misses: 0,
    passed: false,
    startedAt: index === 0 ? startedAt : null,
    finishedAt: null,
  }))
}

export function makeSession(now = Date.now()) {
  const date = laDate(new Date(now))
  const keyId = tonightKey(date)
  const seed = seedFor(date, keyId)
  const startedAt = new Date(now).toISOString()
  return {
    id: newId(),
    date,
    keyId,
    seed,
    status: 'active',
    startedAt,
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    currentStage: 0,
    stages: makeStages(startedAt),
    composition: composeSession({ date, keyId, seed }),
  }
}

function withStage(state, stageId, update) {
  return {
    ...state,
    stages: state.stages.map((stage) => (stage.id === stageId ? update(stage) : stage)),
  }
}

// Pure reducer. The hook writes before it renders, so a refresh cannot lose a
// completed attempt or a finalized run.
export function reduce(state, action) {
  if (!state) return state
  switch (action.type) {
    case 'attempt':
      return withStage(state, action.stageId, (stage) => ({
        ...stage,
        attempts: stage.attempts + 1,
        misses: stage.misses + (action.miss ? 1 : 0),
      }))
    case 'advance': {
      if (state.status !== 'active') return state
      const now = new Date(action.now).toISOString()
      const index = state.currentStage
      return {
        ...state,
        currentStage: Math.min(index + 1, state.stages.length - 1),
        stages: state.stages.map((stage, i) => {
          if (i === index) {
            return {
              ...stage,
              passed: action.passed ?? stage.passed,
              finishedAt: stage.finishedAt || now,
            }
          }
          if (i === index + 1) return { ...stage, startedAt: stage.startedAt || now }
          return stage
        }),
      }
    }
    case 'pause':
      if (state.status !== 'active' || state.pausedAt) return state
      return { ...state, pausedAt: new Date(action.now).toISOString() }
    case 'resume':
      if (state.status !== 'active' || !state.pausedAt) return state
      return {
        ...state,
        pausedAt: null,
        pausedMs: state.pausedMs + Math.max(0, action.now - Date.parse(state.pausedAt)),
      }
    case 'finish': {
      if (state.status !== 'active') return state
      const now = action.now
      const endedAt = new Date(now).toISOString()
      const pausedMs = state.pausedAt
        ? state.pausedMs + Math.max(0, now - Date.parse(state.pausedAt))
        : state.pausedMs
      return {
        ...state,
        status: action.status || 'done',
        endedAt,
        pausedAt: null,
        pausedMs,
        durationMs: Math.max(0, now - Date.parse(state.startedAt) - pausedMs),
        stages: state.stages.map((stage) =>
          !stage.finishedAt ? { ...stage, finishedAt: endedAt } : stage,
        ),
      }
    }
    default:
      return state
  }
}

export function toPayload(session) {
  if (!session) return null
  return {
    id: session.id,
    date: session.date,
    keyId: session.keyId,
    seed: session.seed,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs || 0,
    attempts: session.stages.reduce((sum, stage) => sum + stage.attempts, 0),
    misses: session.stages.reduce((sum, stage) => sum + stage.misses, 0),
    passedStages: session.stages.filter((stage) => stage.passed).length,
    stages: session.stages.map((stage) => ({
      id: stage.id,
      position: stage.position,
      attempts: stage.attempts,
      misses: stage.misses,
      passed: stage.passed,
      startedAt: stage.startedAt,
      finishedAt: stage.finishedAt,
    })),
    payload: {
      source: 'local',
      composition: session.composition,
      stages: session.stages.map((stage) => ({
        id: stage.id,
        position: stage.position,
        attempts: stage.attempts,
        misses: stage.misses,
        passed: stage.passed,
      })),
    },
  }
}

function initialSync() {
  return {
    pending: store.loadQueue().length,
    dead: store.loadDead().length,
    syncing: false,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastError: null,
  }
}

export function useSession() {
  const [session, setSession] = useState(() => store.loadCurrent())
  const stateRef = useRef(session)
  const [sync, setSync] = useState(initialSync)
  const flushing = useRef(false)

  const commit = useCallback((next) => {
    stateRef.current = next
    if (next) store.saveCurrent(next)
    else store.clearCurrent()
    setSession(next)
  }, [])

  const dispatch = useCallback(
    (action) => {
      const next = reduce(stateRef.current, action)
      if (next === stateRef.current) return stateRef.current
      commit(next)
      return next
    },
    [commit],
  )

  const flushQueue = useCallback(async () => {
    if (flushing.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSync((prev) => ({ ...prev, online: false }))
      return
    }
    flushing.current = true
    setSync((prev) => ({ ...prev, syncing: true }))
    try {
      for (;;) {
        const queue = store.loadQueue()
        if (!queue.length) break
        const run = queue[0]
        try {
          const result = await postRun(run)
          store.removeQueued(run.id)
          store.cacheRun({ ...run, server: result })
          setSync((prev) => ({
            ...prev,
            pending: store.loadQueue().length,
            dead: store.loadDead().length,
            lastError: null,
          }))
        } catch (error) {
          // A bad row is dead-lettered. A network/5xx/429 failure keeps the
          // row queued so the next mount/online/finalize can retry it.
          if (error.status >= 400 && error.status < 500 && error.status !== 429) {
            store.moveToDead(run)
            store.removeQueued(run.id)
            setSync((prev) => ({
              ...prev,
              pending: store.loadQueue().length,
              dead: store.loadDead().length,
              lastError: error.message,
            }))
            continue
          }
          setSync((prev) => ({ ...prev, lastError: error.message }))
          break
        }
      }
    } finally {
      flushing.current = false
      setSync((prev) => ({
        ...prev,
        syncing: false,
        pending: store.loadQueue().length,
        dead: store.loadDead().length,
        online: typeof navigator === 'undefined' ? true : navigator.onLine,
      }))
    }
  }, [])

  const start = useCallback(() => {
    const next = makeSession()
    commit(next)
    return next
  }, [commit])

  const recordAttempt = useCallback(
    (stageId, miss = false) => dispatch({ type: 'attempt', stageId, miss }),
    [dispatch],
  )

  const advanceStage = useCallback(
    (passed = true) => dispatch({ type: 'advance', now: Date.now(), passed }),
    [dispatch],
  )

  const pause = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [dispatch])
  const resume = useCallback(() => dispatch({ type: 'resume', now: Date.now() }), [dispatch])

  const finalize = useCallback(
    (status) => {
      const current = stateRef.current
      if (!current || current.status !== 'active') return current
      const final = dispatch({ type: 'finish', now: Date.now(), status })
      store.enqueueRun(toPayload(final))
      setSync((prev) => ({ ...prev, pending: store.loadQueue().length }))
      flushQueue()
      return final
    },
    [dispatch, flushQueue],
  )

  const finish = useCallback(() => finalize('done'), [finalize])
  const abandon = useCallback(() => finalize('abandoned'), [finalize])

  const reset = useCallback(() => {
    commit(null)
  }, [commit])

  useEffect(() => {
    flushQueue()
    const onOnline = () => flushQueue()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flushQueue])

  // Hidden tabs do not accumulate practice time.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause()
      else resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause, resume])

  return {
    session,
    start,
    recordAttempt,
    advanceStage,
    finish,
    abandon,
    reset,
    pause,
    resume,
    flushQueue,
    syncState: sync,
  }
}
