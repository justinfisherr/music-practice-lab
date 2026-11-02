import { composeModules, resolveModule } from '../data/modules.js'

// Compose the session at START. v3: 3-5 graded modules in one key. A plan is an
// optional LLM suggestion; valid suggestions keep their type/params but every
// catalog field (title, teach, targets) is overwritten locally. START never waits.
export function composeSession({ date, keyId, seed, plan = null, variant = 'tonight' }) {
  const suggested = plan?.modules
  const modules = Array.isArray(suggested) && suggested.length
    ? suggested.map((module) =>
        resolveModule({ type: module.type, params: module.params, keyId, seed }),
      )
    : composeModules({ seed, keyId, variant })
  return {
    version: 3,
    date,
    keyId,
    seed,
    variant,
    source: plan && Array.isArray(plan.modules) && plan.modules.length ? 'llm' : 'local',
    rationale: typeof plan?.rationale === 'string' ? plan.rationale : null,
    modules,
  }
}
