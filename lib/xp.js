// XP for a finished session. Shared by the server (source of truth on insert)
// and the client (summary breakdown), so the two can never disagree.
const AWARDS = {
  warmup: { base: 10, firstTry: 5 },
  ear: { base: 20, firstTry: 10 },
  hook: { base: 35, firstTry: 15 },
}
const ORDER = ['warmup', 'ear', 'hook']
const COMPLETE_BONUS = 15
const MAX_XP = 1000

// stages: [{ id, attempts, passed }]. Only the first occurrence of each stage
// id counts, and only when it was passed.
export function xpBreakdown(stages, status) {
  const first = new Map()
  for (const stage of Array.isArray(stages) ? stages : []) {
    if (!stage || typeof stage !== 'object' || first.has(stage.id)) continue
    first.set(stage.id, stage)
  }

  const parts = { warmup: 0, ear: 0, hook: 0, complete: 0 }
  for (const id of ORDER) {
    const stage = first.get(id)
    if (!stage || stage.passed !== true) continue
    parts[id] += AWARDS[id].base
    if (stage.attempts === 1) parts[id] += AWARDS[id].firstTry
  }
  if (status === 'done') parts.complete = COMPLETE_BONUS

  const total = Math.max(
    0,
    Math.min(MAX_XP, parts.warmup + parts.ear + parts.hook + parts.complete),
  )
  return { ...parts, total }
}

export function deriveXp(stages, status, kind = 'graded') {
  if (kind === 'manual') return 0
  return xpBreakdown(stages, status).total
}
