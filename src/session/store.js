const KEYS = {
  current: 'mpl.session.current',
  queue: 'mpl.session.queue',
  dead: 'mpl.session.dead',
  sound: 'mpl.session.sound',
  serverCache: 'mpl.session.serverCache',
  xp: 'mpl.xp',
}

const QUEUE_CAP = 50
const DEAD_CAP = 20
const CACHE_CAP = 100

export function safeRead(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota/private mode: the in-memory session still works
  }
}

export function loadCurrent() {
  return safeRead(KEYS.current, null)
}
export function saveCurrent(session) {
  safeWrite(KEYS.current, session)
}
export function clearCurrent() {
  try {
    window.localStorage.removeItem(KEYS.current)
  } catch {
    // ignore storage failures
  }
}

export function loadQueue() {
  const queue = safeRead(KEYS.queue, [])
  return Array.isArray(queue) ? queue : []
}
export function saveQueue(queue) {
  safeWrite(KEYS.queue, queue.slice(-QUEUE_CAP))
}
export function enqueueRun(run) {
  saveQueue([...loadQueue(), run])
}
export function removeQueued(id) {
  saveQueue(loadQueue().filter((run) => run.id !== id))
}

export function loadDead() {
  const dead = safeRead(KEYS.dead, [])
  return Array.isArray(dead) ? dead : []
}
export function moveToDead(run) {
  safeWrite(KEYS.dead, [...loadDead().slice(-(DEAD_CAP - 1)), run])
}

export function loadXp() {
  const value = Number(safeRead(KEYS.xp, 0))
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}
export function saveXp(total) {
  const value = Number(total)
  if (Number.isFinite(value)) safeWrite(KEYS.xp, Math.max(0, Math.round(value)))
}

export function loadSound() {
  return safeRead(KEYS.sound, true) !== false
}
export function saveSound(on) {
  safeWrite(KEYS.sound, !!on)
}

function cacheMap() {
  const cache = safeRead(KEYS.serverCache, {})
  return cache && typeof cache === 'object' && !Array.isArray(cache) ? cache : {}
}

export function loadCachedRuns() {
  return Object.values(cacheMap()).sort((a, b) =>
    String(b.startedAt).localeCompare(String(a.startedAt)),
  )
}

export function cacheRuns(runs) {
  const cache = cacheMap()
  for (const run of runs) cache[run.id] = { ...(cache[run.id] || {}), ...run }
  const keep = Object.values(cache)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .slice(0, CACHE_CAP)
  const next = {}
  for (const run of keep) next[run.id] = run
  safeWrite(KEYS.serverCache, next)
}

export function cacheRun(run) {
  cacheRuns([run])
}

export function loadCachedRun(id) {
  return cacheMap()[id] || null
}
