// Client-side LLM plan fetch. Best-effort by design: a slow, missing, or broken
// endpoint always resolves to { source: 'standard' } so START never waits.
// v3 asks for a module list; v2 asked for ear/hook degrees. Both shapes are
// validated here before they reach the composer.
import { validatePlan } from '../../lib/modules.js'

export const PLAN_ENDPOINT =
  import.meta.env.VITE_PLAN_ENDPOINT || 'https://music-practice-lab.vercel.app/api/plan'

const TIMEOUT = 1600
const POSITIVE_TTL = 6 * 60 * 60 * 1000
const NEGATIVE_TTL = 15 * 60 * 1000
const CAP = 20

const memo = new Map()
const inflight = new Map()

function remember(key, value) {
  memo.set(key, { value, at: Date.now() })
  if (memo.size > CAP) {
    let oldestKey = null
    let oldestAt = Infinity
    for (const [k, entry] of memo) {
      if (entry.at < oldestAt) {
        oldestAt = entry.at
        oldestKey = k
      }
    }
    if (oldestKey) memo.delete(oldestKey)
  }
}

function ttlFor(value) {
  return value?.source === 'llm' ? POSITIVE_TTL : NEGATIVE_TTL
}

function accept(body, version) {
  if (!body || (body.source !== 'llm' && body.source !== 'standard')) return null
  if (body.source !== 'llm') return body
  if (version === 3) {
    if (!Array.isArray(body.modules)) return null
    if (body.source === 'llm' && !validatePlan({ rationale: body.rationale, modules: body.modules }).ok) {
      return null
    }
    return body
  }
  if (!body.plan || !Array.isArray(body.plan.earDegrees) || !Array.isArray(body.plan.hookDegrees)) {
    return null
  }
  return body
}

async function fetchPlan(date, keyId, version, variant) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const url = `${PLAN_ENDPOINT}?date=${encodeURIComponent(date)}&keyId=${encodeURIComponent(keyId)}&version=${version}&variant=${encodeURIComponent(variant)}`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { source: 'standard' }
    const body = await res.json().catch(() => null)
    return accept(body, version) ?? { source: 'standard' }
  } catch {
    return { source: 'standard' }
  } finally {
    clearTimeout(timer)
  }
}

// Resolves to { source: 'llm', rationale, plan } or { source: 'standard' }.
// Never throws.
export async function getPlan({ date, keyId, version = 3, variant = 'tonight' }) {
  const key = `${date}|${keyId}|v${version}|${variant}`
  const cached = memo.get(key)
  if (cached && Date.now() - cached.at < ttlFor(cached.value)) return cached.value
  if (inflight.has(key)) return inflight.get(key)

  const promise = fetchPlan(date, keyId, version, variant)
    .then((value) => {
      remember(key, value)
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, promise)
  return promise
}
