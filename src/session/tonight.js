import { MAJOR_KEYS } from '../data/scales.js'

export const LA_TZ = 'America/Los_Angeles'

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: LA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// LA-local calendar date (YYYY-MM-DD). The session key rotates at local
// midnight, not UTC midnight.
export function laDate(now = new Date()) {
  return dateFmt.format(now)
}

export function daysSinceEpoch(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function tonightKey(dateStr = laDate()) {
  const index = ((daysSinceEpoch(dateStr) % 12) + 12) % 12
  return MAJOR_KEYS[index].id
}

// FNV-1a, kept deterministic so the same night always composes the same drill.
export function fnv1a(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function seedFor(dateStr, keyId) {
  // Postgres integer is signed 32-bit; keep the FNV bits while staying in range.
  return fnv1a(`${dateStr}|${keyId}`) | 0
}

// Runs inside the current LA week, newest first. Used by the desk rail and the
// ledger side column so both read the same seven nights.
export function lastSevenRuns(runs, dateStr = laDate()) {
  const today = daysSinceEpoch(dateStr)
  return (Array.isArray(runs) ? runs : []).filter((run) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date || '')) return false
    const age = today - daysSinceEpoch(run.date)
    return age >= 0 && age < 7
  })
}
