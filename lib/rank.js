// Rank ladder. XP floors for L1..L10; the last level has no next. Shared by
// the client rank and the crate endpoint, which derives the level itself.
export const LEVELS = [0, 120, 300, 560, 900, 1320, 1840, 2460, 3180, 4000]

export function levelFor(xp) {
  const value = Number.isFinite(xp) ? Math.max(0, xp) : 0
  let level = 1
  for (let i = 0; i < LEVELS.length; i++) {
    if (value >= LEVELS[i]) level = i + 1
  }
  return level
}
