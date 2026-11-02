import { MODULE_SPECS, MODULE_TYPES } from '../../lib/modules.js'
import { resolveTargets } from './modules.js'

// Lessons are the module catalog, one card per type, ordered easy to hard. The
// sentence and meta are derived so the library cannot drift from what a session
// actually asks the player to do.
export const TIER_NAMES = { 1: 'SHAPE', 2: 'FUNCTION', 3: 'VOICE LEADING' }

export const TIER_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 1, label: 'TIER 1 · SHAPE' },
  { id: 2, label: 'TIER 2 · FUNCTION' },
  { id: 3, label: 'TIER 3 · VOICE LEADING' },
]

function countMeta(type) {
  const spec = MODULE_SPECS[type]
  const targets = resolveTargets(type, 'C', 1)
  const count = targets.reduce((sum, target) => sum + target.pcs.length, 0)
  return `${spec.grading === 'set' ? 'SET' : 'ORDERED'} · ${count} NOTES`
}

export const LESSONS = MODULE_TYPES.map((type) => {
  const spec = MODULE_SPECS[type]
  return {
    type,
    title: spec.title,
    tier: spec.tier,
    lesson: spec.teach,
    meta: countMeta(type),
    estSec: spec.estSec,
  }
}).sort((a, b) => a.tier - b.tier || MODULE_TYPES.indexOf(a.type) - MODULE_TYPES.indexOf(b.type))
