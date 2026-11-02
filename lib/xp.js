// XP for a finished session. Shared by the server (source of truth on insert)
// and the client (summary breakdown), so the two can never disagree.
//
// v2 rows have warmup/ear/hook stages and no tier: they keep the original
// awards. v3 rows carry a tier per module; each passed module earns its tier's
// base plus a first-try bonus. A finished session always gets the completion
// bonus. The total clamps at 1000 either way.

const LEGACY_AWARDS = {
  warmup: { base: 10, firstTry: 5 },
  ear: { base: 20, firstTry: 10 },
  hook: { base: 35, firstTry: 15 },
}
const LEGACY_ORDER = ['warmup', 'ear', 'hook']

const MODULE_AWARDS = {
  1: { base: 10, firstTry: 5 },
  2: { base: 15, firstTry: 8 },
  3: { base: 20, firstTry: 10 },
}

const COMPLETE_BONUS = 15
const MAX_XP = 1000

function firstByStage(stages) {
  const first = new Map()
  for (const stage of Array.isArray(stages) ? stages : []) {
    if (!stage || typeof stage !== 'object' || first.has(stage.id)) continue
    first.set(stage.id, stage)
  }
  return first
}

function moduleMode(first) {
  for (const stage of first.values()) {
    if (Number.isInteger(stage.tier)) return true
  }
  return false
}

function moduleBreakdown(first, status) {
  const modules = []
  let total = 0
  for (const [id, stage] of first) {
    if (!Number.isInteger(stage.tier)) continue
    const award = MODULE_AWARDS[stage.tier] || MODULE_AWARDS[1]
    const xp =
      stage.passed === true
        ? award.base + (stage.attempts === 1 ? award.firstTry : 0)
        : 0
    modules.push({
      id,
      title: stage.title || id,
      tier: stage.tier,
      attempts: stage.attempts ?? 0,
      passed: stage.passed === true,
      xp,
    })
    total += xp
  }
  const complete = status === 'done' ? COMPLETE_BONUS : 0
  total = Math.max(0, Math.min(MAX_XP, total + complete))
  return { modules, complete, total }
}

function legacyBreakdown(first, status) {
  const parts = { warmup: 0, ear: 0, hook: 0, complete: 0 }
  for (const id of LEGACY_ORDER) {
    const stage = first.get(id)
    if (!stage || stage.passed !== true) continue
    parts[id] += LEGACY_AWARDS[id].base
    if (stage.attempts === 1) parts[id] += LEGACY_AWARDS[id].firstTry
  }
  if (status === 'done') parts.complete = COMPLETE_BONUS
  const total = Math.max(
    0,
    Math.min(MAX_XP, parts.warmup + parts.ear + parts.hook + parts.complete),
  )
  return { ...parts, total }
}

export function xpBreakdown(stages, status) {
  const first = firstByStage(stages)
  return moduleMode(first) ? moduleBreakdown(first, status) : legacyBreakdown(first, status)
}

export function deriveXp(stages, status, kind = 'graded') {
  if (kind === 'manual') return 0
  return xpBreakdown(stages, status).total
}
