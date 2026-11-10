import pg from 'pg'
import { deriveXp } from '../lib/xp.js'
import { MODULE_IDS } from '../lib/modules.js'
import { CARD_STAGE_IDS, LEGACY_STAGE_IDS } from '../lib/cards.js'

// Public, no-account session log. Auth is intentionally absent; the write
// surface is protected by a CORS allowlist, strict shape validation, a 32KB
// body cap, a limit cap, and a best-effort in-memory per-IP rate limit. Vercel
// cold starts reset the rate map, so it is a speed bump, not a wall.
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
// v3 module ids are lowercased module types; v2 used warmup/ear/hook. The
// allowlist is the contract with the client composer, not a regex.
const MODULE_ID_SET = new Set(MODULE_IDS)
const CARD_STAGE_ID_SET = new Set([...CARD_STAGE_IDS, ...LEGACY_STAGE_IDS])
const STAGE_IDS = new Set(['warmup', 'ear', 'hook', 'jam', ...MODULE_IDS, ...CARD_STAGE_ID_SET])
const SCOPES = new Set(['session', 'lesson', 'open'])
const KINDS = new Set(['graded', 'manual', 'arcade'])
const MAX_BODY = 32 * 1024
const MAX_PAYLOAD = 16 * 1024
const MAX_DURATION = 4 * 60 * 60 * 1000
const RATE_WINDOW = 60_000
const RATE_LIMIT = 60

const pools = new Map()
const hits = new Map()

class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

function db() {
  if (pools.has('vault')) return pools.get('vault')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  })
  pools.set('vault', pool)
  return pool
}

let schemaPromise = null

export async function ensure() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = db()
      await pool.query('CREATE SCHEMA IF NOT EXISTS practice')
      await pool.query(`CREATE TABLE IF NOT EXISTS practice.sessions (
        id text PRIMARY KEY,
        session_date date NOT NULL,
        key_id text NOT NULL,
        seed integer NOT NULL,
        status text NOT NULL CHECK (status IN ('done','abandoned')),
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms BETWEEN 0 AND 14400000),
        attempts integer NOT NULL DEFAULT 0,
        misses integer NOT NULL DEFAULT 0,
        passed_stages integer NOT NULL DEFAULT 0,
        payload jsonb NOT NULL,
        client text NOT NULL DEFAULT 'web',
        created_at timestamptz NOT NULL DEFAULT now()
      )`)
      await pool.query(
        'CREATE INDEX IF NOT EXISTS practice_sessions_date_idx ON practice.sessions (session_date DESC, started_at DESC)',
      )
      await pool.query(
        'CREATE INDEX IF NOT EXISTS practice_sessions_key_date_idx ON practice.sessions (key_id, session_date DESC)',
      )
      await pool.query(
        'ALTER TABLE practice.sessions ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0',
      )
      await pool.query(
        'ALTER TABLE practice.sessions ADD COLUMN IF NOT EXISTS module_count integer NOT NULL DEFAULT 0',
      )
      await pool.query(`DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'practice_sessions_xp_check'
          ) THEN
            ALTER TABLE practice.sessions
              ADD CONSTRAINT practice_sessions_xp_check CHECK (xp BETWEEN 0 AND 1000) NOT VALID;
          END IF;
        END $$`)
      await pool.query('ALTER TABLE practice.sessions VALIDATE CONSTRAINT practice_sessions_xp_check')
      await pool.query(
        "ALTER TABLE practice.sessions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'graded'",
      )
      await pool.query(`DO $$
        BEGIN
          PERFORM pg_advisory_xact_lock(20261109);
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conname = 'practice_sessions_kind_check'
               AND conrelid = 'practice.sessions'::regclass
               AND pg_get_constraintdef(oid) LIKE '%arcade%'
          ) THEN
            ALTER TABLE practice.sessions
              DROP CONSTRAINT IF EXISTS practice_sessions_kind_check;
            ALTER TABLE practice.sessions
              ADD CONSTRAINT practice_sessions_kind_check
              CHECK (kind IN ('graded','manual','arcade')) NOT VALID;
          END IF;
        END $$`)
      await pool.query('ALTER TABLE practice.sessions VALIDATE CONSTRAINT practice_sessions_kind_check')
    })().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

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

function write(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Vary', 'Origin')
  res.end(JSON.stringify(body))
}

function cors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function tooLarge() {
  return new HttpError(413, 'too_large')
}

function invalid() {
  return new HttpError(400, 'invalid_body')
}

async function body(req) {
  if (req.body && typeof req.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_BODY) throw tooLarge()
    return req.body
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > MAX_BODY) throw tooLarge()
    try {
      return JSON.parse(req.body)
    } catch {
      throw invalid()
    }
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw tooLarge()
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw invalid()
  }
}

function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]
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

function isoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function isoTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function intBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

// SEVENTH HOUSE's payload is its own contract: the run is client-side and the
// row's chord counts come from `chords`, so a graded row can never pass here.
function validateArcade(input, sessionDate, scope) {
  const payload = input.payload
  if (payload.version !== 5) throw invalid()
  if (payload.source !== 'arcade') throw invalid()
  if (payload.mode !== 'seventh-house') throw invalid()
  if (!KEY_IDS.has(payload.keyId) || payload.keyId !== input.keyId) throw invalid()
  if (!Number.isInteger(payload.seed) || payload.seed !== input.seed) throw invalid()
  if (payload.goal !== 14) throw invalid()
  if (!intBetween(payload.cleared, 0, 14)) throw invalid()
  if (typeof payload.complete !== 'boolean' || payload.complete !== (payload.cleared === 14)) {
    throw invalid()
  }
  if (!intBetween(payload.accuracy, 0, 100)) throw invalid()
  if (!payload.cues || typeof payload.cues !== 'object' || Array.isArray(payload.cues)) {
    throw invalid()
  }
  for (const value of Object.values(payload.cues)) {
    if (!Number.isInteger(value) || value < 0) throw invalid()
  }
  if (!payload.chords || typeof payload.chords !== 'object' || Array.isArray(payload.chords)) {
    throw invalid()
  }
  if (Object.keys(payload.chords).length !== 7) throw invalid()

  const chords = {}
  let attempts = 0
  let misses = 0
  for (let degree = 1; degree <= 7; degree++) {
    const entry = payload.chords[degree]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw invalid()
    if (!intBetween(entry.correct, 0, 2)) throw invalid()
    if (!Number.isInteger(entry.missed) || entry.missed < 0 || entry.missed > 999) throw invalid()
    chords[degree] = { correct: entry.correct, missed: entry.missed }
    attempts += entry.correct + entry.missed
    misses += entry.missed
  }

  const elapsed = Date.parse(input.endedAt) - Date.parse(input.startedAt)
  const durationMs = Math.min(
    MAX_DURATION,
    Math.max(0, intBetween(input.durationMs, 0, MAX_DURATION) ? input.durationMs : elapsed),
  )

  return {
    ...input,
    kind: 'arcade',
    scope,
    sessionDate,
    attempts,
    misses,
    passedStages: 0,
    durationMs,
    moduleCount: 0,
    moduleTypes: [],
    payload: { ...payload, chords },
  }
}

export function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid()
  if (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(input.id)) throw invalid()
  if (!isoDate(input.date)) throw invalid()
  if (input.date > addDays(today(), 1)) throw invalid()
  if (!KEY_IDS.has(input.keyId)) throw invalid()
  if (!Number.isInteger(input.seed)) throw invalid()
  if (input.status !== 'done' && input.status !== 'abandoned') throw invalid()
  const kind = input.kind ?? 'graded'
  if (!KINDS.has(kind)) throw invalid()
  if (!isoTime(input.startedAt) || !isoTime(input.endedAt)) throw invalid()
  const start = Date.parse(input.startedAt)
  const end = Date.parse(input.endedAt)
  if (start > end || end - start > 24 * 60 * 60 * 1000) throw invalid()
  if (!Array.isArray(input.stages) || input.stages.length > 6) throw invalid()
  const sessionDate = dayFmt.format(new Date(start))
  const v3 =
    input.payload?.version === 3 ||
    input.payload?.composition?.version === 3 ||
    input.stages.some((stage) => stage?.id !== 'ear' && MODULE_ID_SET.has(stage?.id))

  let stageDuration = 0
  for (const stage of input.stages) {
    if (!stage || typeof stage !== 'object') throw invalid()
    if (typeof stage.id !== 'string' || !STAGE_IDS.has(stage.id)) throw invalid()
    if (stage.tier != null && ![1, 2, 3].includes(stage.tier)) throw invalid()
    if (v3 && MODULE_ID_SET.has(stage.id) && !intBetween(stage.tier, 1, 3)) throw invalid()
    if (CARD_STAGE_ID_SET.has(stage.id) && stage.tier !== 3) throw invalid()
    if (stage.id === 'jam' && stage.tier !== 3) throw invalid()
    if (!intBetween(stage.position, 0, 5)) throw invalid()
    if (!intBetween(stage.attempts, 0, 500)) throw invalid()
    if (!intBetween(stage.misses, 0, 1000)) throw invalid()
    if (typeof stage.passed !== 'boolean') throw invalid()
    if (stage.startedAt != null && !isoTime(stage.startedAt)) throw invalid()
    if (stage.finishedAt != null && !isoTime(stage.finishedAt)) throw invalid()
    if (stage.startedAt != null && stage.finishedAt != null) {
      const stageStart = Date.parse(stage.startedAt)
      const stageEnd = Date.parse(stage.finishedAt)
      if (stageStart > stageEnd) throw invalid()
      stageDuration += stageEnd - stageStart
    }
  }

  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw invalid()
  }
  const scope = input.payload.scope ?? (kind === 'manual' ? 'open' : 'session')
  if (!SCOPES.has(scope)) throw invalid()
  if (Buffer.byteLength(JSON.stringify(input.payload)) > MAX_PAYLOAD) throw tooLarge()
  if (kind === 'arcade') return validateArcade(input, sessionDate, scope)

  const attempts = input.stages.reduce((sum, stage) => sum + stage.attempts, 0)
  const misses = input.stages.reduce((sum, stage) => sum + stage.misses, 0)
  const passedStages = input.stages.filter((stage) => stage.passed).length
  const elapsed = end - start
  const rawDuration = stageDuration > 0 ? stageDuration : elapsed
  const durationMs = Math.min(MAX_DURATION, Math.max(0, rawDuration))
  const plannedModules = Array.isArray(input.payload?.composition?.modules)
    ? input.payload.composition.modules
    : Array.isArray(input.payload?.modules)
      ? input.payload.modules
      : []
  const moduleCount = Math.max(
    0,
    Math.min(
      5,
      Number.isInteger(input.moduleCount)
        ? input.moduleCount
        : plannedModules.length || input.stages.length,
    ),
  )
  const moduleTypes = plannedModules.map((module) => module?.type).filter((type) => typeof type === 'string')

  return {
    ...input,
    kind,
    scope,
    sessionDate,
    attempts,
    misses,
    passedStages,
    durationMs,
    moduleCount,
    moduleTypes,
  }
}

function summary(row) {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind || 'graded',
    focus: row.focus || null,
    scope: row.scope || (row.kind === 'manual' ? 'open' : 'session'),
    keyId: row.key_id,
    seed: row.seed,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    attempts: row.attempts,
    misses: row.misses,
    passedStages: row.passed_stages,
    moduleCount: row.module_count ?? 0,
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    moduleTypes: Array.isArray(row.module_types)
      ? row.module_types.map((module) => module?.type).filter((type) => typeof type === 'string')
      : [],
    xp: row.xp,
  }
}

async function totalXp(pool) {
  const { rows } = await pool.query(
    'SELECT COALESCE(SUM(xp),0)::int AS total FROM practice.sessions',
  )
  return rows[0]?.total ?? 0
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  try {
    await ensure()
    const pool = db()

    if (req.method === 'GET') {
      const id = req.query?.id
      if (id) {
        const { rows } = await pool.query(
          `SELECT id, session_date::text AS date, key_id, seed, status, started_at,
                  ended_at, duration_ms, attempts, misses, passed_stages, xp, kind,
                  module_count, payload->>'focus' AS focus, payload->>'scope' AS scope,
                  payload->>'accuracy' AS accuracy,
                  COALESCE(payload#>'{composition,modules}', payload#>'{composition,stages}') AS module_types, payload
             FROM practice.sessions WHERE id = $1`,
          [String(id)],
        )
        if (!rows.length) {
          res.statusCode = 404
          return write(res, 404, { error: 'not_found' })
        }
        return write(res, 200, { session: { ...summary(rows[0]), payload: rows[0].payload } })
      }

      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 40))
      const key = req.query?.key
      const before = req.query?.before
      if (key != null && !KEY_IDS.has(String(key))) throw invalid()
      if (before != null && !isoDate(String(before))) throw invalid()

      const params = []
      const where = []
      if (key != null) {
        params.push(String(key))
        where.push(`key_id = $${params.length}`)
      }
      if (before != null) {
        params.push(String(before))
        where.push(`session_date < $${params.length}::date`)
      }
      params.push(limit + 1)
      const { rows } = await pool.query(
        `SELECT id, session_date::text AS date, key_id, seed, status, started_at,
                ended_at, duration_ms, attempts, misses, passed_stages, xp, kind,
                module_count, payload->>'focus' AS focus, payload->>'scope' AS scope,
                payload->>'accuracy' AS accuracy,
                COALESCE(payload#>'{composition,modules}', payload#>'{composition,stages}') AS module_types
           FROM practice.sessions
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY session_date DESC, started_at DESC
          LIMIT $${params.length}`,
        params,
      )
      return write(res, 200, {
        sessions: rows.slice(0, limit).map(summary),
        hasMore: rows.length > limit,
        meta: { totalXp: await totalXp(pool) },
      })
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id
      if (typeof id !== 'string' || !id || id.length > 200) throw invalid()
      const { rowCount } = await pool.query('DELETE FROM practice.sessions WHERE id = $1', [id])
      if (!rowCount) return write(res, 404, { error: 'not_found' })
      return write(res, 200, { deleted: id, meta: { totalXp: await totalXp(pool) } })
    }

    if (req.method === 'POST') {
      if (rateLimited(req)) return write(res, 429, { error: 'rate_limited' })
      const input = validate(await body(req))
      const xp = deriveXp(
        input.stages,
        input.status,
        input.kind,
        input.scope,
        input.payload?.cleared,
      )
      const { rows } = await pool.query(
        `INSERT INTO practice.sessions
          (id, session_date, key_id, seed, status, started_at, ended_at, duration_ms,
           attempts, misses, passed_stages, xp, module_count, payload, client, kind)
         VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,'web',$15)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          input.id,
          input.sessionDate,
          input.keyId,
          input.seed,
          input.status,
          input.startedAt,
          input.endedAt,
          input.durationMs,
          input.attempts,
          input.misses,
          input.passedStages,
          xp,
          input.moduleCount,
          JSON.stringify(input.payload),
          input.kind,
        ],
      )
      if (!rows.length) {
        return write(res, 200, {
          ok: true,
          duplicate: true,
          id: input.id,
          totalXp: await totalXp(pool),
        })
      }
      return write(res, 200, {
        ok: true,
        id: input.id,
        duplicate: false,
        date: input.sessionDate,
        kind: input.kind,
        durationMs: input.durationMs,
        xp,
        moduleCount: input.moduleCount,
        totalXp: await totalXp(pool),
      })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return write(res, 405, { error: 'method_not_allowed' })
  } catch (error) {
    if (error instanceof HttpError) return write(res, error.status, { error: error.code })
    console.error('sessions', error)
    return write(res, 500, { error: 'internal_error' })
  }
}
