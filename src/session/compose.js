import { composeModules, resolveModule, resolvePlan } from '../data/modules.js'
import { diatonicPcs, earPhrase } from './phrases.js'
import { RAPID_COUNT, rapidPrompts } from './set.js'
import { keyById, relativeMinor } from '../data/scales.js'

// Compose the session at START. v3: 3-5 graded modules in one key. A plan is an
// optional LLM suggestion; valid suggestions keep their type/params but every
// catalog field (title, teach, steps) is overwritten locally. START never waits.
export function composeSession({ date, keyId, seed, plan = null, variant = 'tonight' }) {
  const resolved =
    plan && Array.isArray(plan.modules) && plan.modules.length
      ? resolvePlan({ plan, keyId, seed })
      : null
  const modules = resolved?.modules?.length
    ? resolved.modules
    : composeModules({ seed, keyId, variant })
  return {
    version: 3,
    date,
    keyId,
    seed,
    variant,
    source: resolved ? 'llm' : 'local',
    rationale: resolved?.rationale ?? null,
    modules,
  }
}

// One-module lesson drill. It runs through the same engine but pays module XP
// only: lesson scope has no completion bonus.
export function composeLesson({ date, keyId, seed, type }) {
  const module = resolveModule({ type, keyId, seed })
  if (!module) return null
  return {
    version: 3,
    date,
    keyId,
    seed,
    variant: 'lesson',
    source: 'local',
    rationale: null,
    modules: [module],
  }
}

// v4 THE SET: one stage. The Scale Lab warm-up (three homes, ear, ordered
// chords, progressions) is the whole set; it finishes the run itself.
export function composeSet({ date, keyId, seed }) {
  const key = keyById(keyId)
  const warmup = {
    id: 'warmup',
    type: 'warmup',
    title: 'WARM-UP',
    tier: 2,
    detail: {
      scale: { pcs: [...diatonicPcs(keyId), key.tonic], notes: [...key.scale, key.scale[0]] },
      minor: relativeMinor(keyId),
      ear: { pcs: earPhrase(seed, keyId) },
      rapid: { prompts: rapidPrompts(seed, keyId, RAPID_COUNT) },
    },
  }

  return {
    version: 4,
    variant: 'set',
    date,
    keyId,
    seed,
    source: 'local',
    stages: [warmup],
  }
}
