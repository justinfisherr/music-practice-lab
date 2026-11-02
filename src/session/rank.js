// Rank ladder. XP floors for L1..L10; the last level has no next.
export const LEVELS = [0, 120, 300, 560, 900, 1320, 1840, 2460, 3180, 4000]

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

export function levelFor(xp) {
  const value = Number.isFinite(xp) ? Math.max(0, xp) : 0
  let level = 1
  for (let i = 0; i < LEVELS.length; i++) {
    if (value >= LEVELS[i]) level = i + 1
  }
  return level
}

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
