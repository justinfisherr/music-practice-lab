import { CARD_STAGE_IDS, LEGACY_STAGE_IDS } from './cards.js'

// XP for a finished session. Shared by the server (source of truth on insert)
// and the client (summary breakdown), so the two can never disagree.
//
// v2 rows have warmup/ear/hook stages and no tier: they keep the original
// awards. v3 rows carry a tier per module; each passed module earns its tier's
// base plus a first-try bonus. A completed session-scope run gets the completion
// bonus. The total clamps at 1000 either way.

const LEGACY_AWARDS = {
  warmup: { base: 10, firstTry: 5 },
  ear: { base: 20, firstTry: 10 },
  hook: { base: 35, firstTry: 15 },
}
const LEGACY_ORDER = ['warmup', 'ear', 'hook']

const MODULE_AWARDS = {
  1: { base: 10, firstTry: 5 },
  2: { base: 15, firstTry: 5 },
  3: { base: 20, firstTry: 5 },
}

const COMPLETE_BONUS = 15
const MAX_XP = 1000

// SEVENTH HOUSE has no stages to grade, so it pays one flat award for a
// completed house. An abandoned run pays nothing.
export const ARCADE_XP = 35

export function arcadeXp(status) {
  return status === 'done' ? ARCADE_XP : 0
}

// v4 THE SET now pays the Scale Lab warm-up + the 30-second changes round.
// First-try totals 50: 15 warm-up + 20 changes + 15 complete. Card stage ids
// stay in the award table so old stored card sets keep their original XP.
const SET_STAGE_IDS = new Set([...CARD_STAGE_IDS, ...LEGACY_STAGE_IDS, 'jam'])
const SET_AWARDS = {
  warmup: { base: 10, firstTry: 5 },
  card: { base: 15, firstTry: 5 },
  jam: { base: 15, firstTry: 5 },
}

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

function moduleBreakdown(first, status, scope) {
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
  const complete = status === 'done' && scope === 'session' ? COMPLETE_BONUS : 0
  total = Math.max(0, Math.min(MAX_XP, total + complete))
  return { modules, complete, total }
}

function isSet(first) {
  // A v4 set always has the warm-up plus a card stage. Requiring the warm-up
  // keeps a v3 lesson/module whose id collides with a card stage (guide_tones)
  // from being paid as a set.
  if (!first.has('warmup')) return false
  for (const id of first.keys()) {
    if (SET_STAGE_IDS.has(id)) return true
  }
  return false
}

function setBreakdown(first, status, scope) {
  const modules = []
  let total = 0
  for (const [id, stage] of first) {
    if (id !== 'warmup' && !SET_STAGE_IDS.has(id)) continue
    const award =
      id === 'warmup' ? SET_AWARDS.warmup : id === 'jam' ? SET_AWARDS.jam : SET_AWARDS.card
    const xp =
      stage.passed === true ? award.base + (stage.attempts === 1 ? award.firstTry : 0) : 0
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
  const complete = status === 'done' && scope === 'session' ? COMPLETE_BONUS : 0
  total = Math.max(0, Math.min(MAX_XP, total + complete))
  return { modules, complete, total }
}

function legacyBreakdown(first, status, scope) {
  const parts = { warmup: 0, ear: 0, hook: 0, complete: 0 }
  for (const id of LEGACY_ORDER) {
    const stage = first.get(id)
    if (!stage || stage.passed !== true) continue
    parts[id] += LEGACY_AWARDS[id].base
    if (stage.attempts === 1) parts[id] += LEGACY_AWARDS[id].firstTry
  }
  if (status === 'done' && scope === 'session') parts.complete = COMPLETE_BONUS
  const total = Math.max(
    0,
    Math.min(MAX_XP, parts.warmup + parts.ear + parts.hook + parts.complete),
  )
  return { ...parts, total }
}

export function xpBreakdown(stages, status, scope = 'session') {
  const first = firstByStage(stages)
  if (isSet(first)) return setBreakdown(first, status, scope)
  return moduleMode(first)
    ? moduleBreakdown(first, status, scope)
    : legacyBreakdown(first, status, scope)
}

export function deriveXp(stages, status, kind = 'graded', scope = 'session') {
  // Checked before the stage walk: an empty-stages done row would otherwise
  // fall through to the graded completion bonus.
  if (kind === 'arcade') return arcadeXp(status)
  if (kind === 'manual') return 0
  return xpBreakdown(stages, status, scope).total
}
