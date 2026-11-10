// Rank ladder. The XP floors and levelFor live in lib/rank.js so the server can
// derive a level from the session ledger; this module keeps the client titles.
import { LEVELS, levelFor } from '../../lib/rank.js'

export { LEVELS, levelFor }

export const TITLES = [
  'OPENING ACT',
  'OPENING ACT',
  'SIDE PLAYER',
  'SIDE PLAYER',
  'SESSION PLAYER',
  'SESSION PLAYER',
  'HEADLINER',
  'HEADLINER',
  'BANDLEADER',
  'BANDLEADER',
]

export function titleFor(level) {
  const index = Math.min(TITLES.length, Math.max(1, level)) - 1
  return TITLES[index]
}

export function describe(xp) {
  const value = Number.isFinite(xp) ? Math.max(0, xp) : 0
  const level = levelFor(value)
  const floor = LEVELS[level - 1]
  const max = level >= LEVELS.length
  const next = max ? null : LEVELS[level]
  const toNext = max ? 0 : Math.max(0, next - value)
  const pct = max ? 100 : Math.round(((value - floor) / (next - floor)) * 100)
  return {
    level,
    title: titleFor(level),
    floor,
    next,
    toNext,
    pct: Math.max(0, Math.min(100, pct)),
  }
}
