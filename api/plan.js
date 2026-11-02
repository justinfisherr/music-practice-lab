import pg from 'pg'
import { buildModuleMessages, parseModulePlan } from '../lib/plan.js'
import { validatePlan } from '../lib/modules.js'
import { seedFor } from '../src/session/tonight.js'
import { resolvePlan } from '../src/data/modules.js'
import { diatonicPcs } from '../src/session/phrases.js'

// LLM-composed drill plan. Generation is best-effort: every failure path is a
// 200 { source: 'standard' }, because a missing plan must never break START.
// Only GET is supported; OPTIONS is CORS.
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const KEY_IDS = new Set([
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'Gb',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
])

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash'
const POSITIVE_TTL = 6 * 60 * 60 * 1000
const NEGATIVE_TTL = 60 * 1000
const MEMO_CAP = 200
const RATE_WINDOW = 60_000
const RATE_LIMIT = 30
const FETCH_TIMEOUT = 6000

const memo = new Map()
const inflight = new Map()
const hits = new Map()
let pool = null

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function today() {
  return dayFmt.format(new Date())
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return false
  const now = today()
  return date >= addDays(now, -2) && date <= addDays(now, 1)
}

function cors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function writePlan(res, body) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Vary', 'Origin')
  // The in-memory memo is the cache. HTTP caching would outlive a deployment
  // and serve an old response shape for the same date/key/variant URL.
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function rateLimited(req) {
  const ip = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
  ).split(',')[0]
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW) {
    hits.set(ip, { start: now, count: 1 })
    if (hits.size > 2000) hits.clear()
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

function remember(key, value) {
  memo.set(key, { value, at: Date.now() })
  if (memo.size > MEMO_CAP) {
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

function getPool() {
  if (pool) return pool
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  return pool
}

// Recent sessions give the model something to vary from. A DB hiccup degrades
// to an empty list; it never fails the request.
async function recentRows() {
  try {
    if (!process.env.DATABASE_URL) return []
    const { rows } = await getPool().query(
      `SELECT key_id, session_date::text AS date, passed_stages, attempts,
              payload->'composition'->'modules' AS modules
         FROM practice.sessions
        WHERE kind = 'graded'
        ORDER BY session_date DESC, started_at DESC
        LIMIT 12`,
    )
    const nights = []
    const seen = new Set()
    for (const row of rows) {
      if (seen.has(row.date)) continue
      seen.add(row.date)
      const modules = Array.isArray(row.modules) ? row.modules : []
      nights.push({
        keyId: row.key_id,
        date: row.date,
        passedStages: row.passed_stages,
        attempts: row.attempts,
        types: modules.map((module) => module?.type).filter(Boolean),
      })
      if (nights.length === 3) break
    }
    return nights
  } catch {
    return []
  }
}

function diatonicPlan(resolved, keyId) {
  const keySet = new Set(diatonicPcs(keyId))
  for (const module of resolved.modules) {
    if (module.type === 'PASSING_DIM') continue
    for (const step of module.steps) {
      if (!step.targetPcs.every((pc) => keySet.has(pc))) return false
    }
  }
  return true
}

function fallback(reason) {
  return { source: 'standard', fallbackReason: reason }
}

async function generate({ date, keyId, variant }) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return fallback('no_api_key')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const recent = await recentRows()
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.9,
        max_tokens: 900,
        // The pinned model reasons by default and would spend the whole budget
        // before emitting JSON; disable reasoning so content arrives.
        reasoning: { enabled: false },
        messages: buildModuleMessages({ date, keyId, variant, recent }),
      }),
    })
    if (!res.ok) {
      console.warn('plan', res.status)
      return fallback('upstream_status')
    }
    const data = await res.json().catch(() => null)
    const text = data?.choices?.[0]?.message?.content
    const parsed = parseModulePlan(text)
    if (!parsed) return fallback('parse')
    const checked = validatePlan(parsed, {
      recent: recent.map((night) => night.types),
    })
    if (!checked.ok) return fallback(checked.error)
    const resolved = resolvePlan({ plan: checked.value, keyId, seed: seedFor(date, keyId) })
    if (!resolved) return fallback('resolve')
    if (!diatonicPlan(resolved, keyId)) return fallback('non_diatonic')
    return {
      source: 'llm',
      rationale: resolved.rationale,
      modules: resolved.modules.map((module) => ({
        type: module.type,
        params: module.params ?? null,
        tier: module.tier,
        skill: module.skill,
        grading: module.grading,
        why: module.why,
        estSec: module.estSec,
        title: module.title,
        teach: module.teach,
        steps: module.steps,
      })),
    }
  } catch (error) {
    console.warn('plan', error?.name === 'AbortError' ? 'timeout' : 'error')
    return fallback(error?.name === 'AbortError' ? 'timeout' : 'error')
  } finally {
    clearTimeout(timer)
  }
}

function standardBody({ date, keyId, variant, reason }) {
  return {
    source: 'standard',
    version: 3,
    date,
    keyId,
    variant,
    rationale: null,
    modules: [],
    fallbackReason: reason,
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(JSON.stringify({ error: 'method_not_allowed' }))
  }

  const date = String(req.query?.date || '')
  const keyId = String(req.query?.keyId || '')
  const rawVariant = String(req.query?.variant || 'tonight')
  const variant = rawVariant === 'bonus' ? 'bonus' : rawVariant === 'tonight' ? 'tonight' : null
  const cacheKey = `${date}|${keyId}|${variant || 'invalid'}`

  // The memo stores the generator's raw value; every path wraps it into the v3
  // envelope so a warm cache can never return the old shape.
  const respond = (value) => {
    if (value.source !== 'llm') {
      return standardBody({
        date,
        keyId,
        variant: variant || rawVariant,
        reason: value.fallbackReason || 'standard',
      })
    }
    return {
      source: 'llm',
      version: 3,
      date,
      keyId,
      variant,
      rationale: value.rationale || null,
      modules: value.modules,
      fallbackReason: null,
    }
  }

  const cached = memo.get(cacheKey)
  if (cached && Date.now() - cached.at < ttlFor(cached.value)) {
    return writePlan(res, respond(cached.value))
  }

  const pending = inflight.get(cacheKey)
  if (pending) {
    return writePlan(res, respond(await pending))
  }

  const request = (async () => {
    try {
      // Invalid input, variant, rate limiting, or a missing key is a standard night.
      if (!validDate(date)) return fallback('bad_date')
      if (!KEY_IDS.has(keyId)) return fallback('bad_key')
      if (!variant) return fallback('bad_variant')
      if (rateLimited(req)) return fallback('rate_limited')
      const value = await generate({ date, keyId, variant })
      remember(cacheKey, value)
      return value
    } catch (error) {
      console.warn('plan', error?.name === 'AbortError' ? 'timeout' : 'error')
      return fallback('error')
    }
  })()

  inflight.set(cacheKey, request)
  const value = await request.finally(() => inflight.delete(cacheKey))

  // v3 is always the module envelope, even when generation failed: the client
  // needs a stable shape.
  return writePlan(res, respond(value))
}
