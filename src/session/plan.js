// Client-side LLM plan fetch. Best-effort by design: a slow, missing, or broken
// endpoint always resolves to { source: 'standard' } so START never waits.
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

async function fetchPlan(date, keyId) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const url = `${PLAN_ENDPOINT}?date=${encodeURIComponent(date)}&keyId=${encodeURIComponent(keyId)}`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { source: 'standard' }
    const body = await res.json().catch(() => null)
    if (!body || (body.source !== 'llm' && body.source !== 'standard')) {
      return { source: 'standard' }
    }
    if (
      body.source === 'llm' &&
      (!body.plan ||
        !Array.isArray(body.plan.earDegrees) ||
        !Array.isArray(body.plan.hookDegrees))
    ) {
      return { source: 'standard' }
    }
    return body
  } catch {
    return { source: 'standard' }
  } finally {
    clearTimeout(timer)
  }
}

// Resolves to { source: 'llm', rationale, plan } or { source: 'standard' }.
// Never throws.
export async function getPlan({ date, keyId }) {
  const key = `${date}|${keyId}`
  const cached = memo.get(key)
  if (cached && Date.now() - cached.at < ttlFor(cached.value)) return cached.value
  if (inflight.has(key)) return inflight.get(key)

  const promise = fetchPlan(date, keyId)
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
