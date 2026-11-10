import pg from 'pg'
import { levelFor } from '../lib/rank.js'
import {
  cleanImportRows,
  pickCrateItem,
} from '../lib/crate.js'

// The crate is server-owned: one box per level, one record or artist per box,
// and the pick is made inside a transaction so two tabs cannot buy the same
// record. Same protections as the session log: a CORS allowlist, strict shape
// validation, an 8KB body cap, and a best-effort per-IP rate limit.
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const MAX_POST = 8 * 1024
const RATE_WINDOW = 60_000
const RATE_LIMIT = 60
const MAX_IMPORT = 20
const LOCK_KEY = 20261110
const hits = new Map()
let pool = null
let schemaPromise = null

function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  }
  return pool
}

function ensure() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const client = db()
      await client.query('CREATE SCHEMA IF NOT EXISTS practice')
      await client.query(`CREATE TABLE IF NOT EXISTS practice.crate_opens (
        id bigserial PRIMARY KEY,
        level integer NOT NULL CHECK (level BETWEEN 1 AND 10),
        kind text NOT NULL CHECK (kind IN ('record','artist','both')),
        record_id text,
        artist_id text,
        client_key text,
        source text NOT NULL DEFAULT 'app' CHECK (source IN ('app','import')),
        opened_at timestamptz NOT NULL DEFAULT now(),
        CHECK (record_id IS NOT NULL OR artist_id IS NOT NULL)
      )`)
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS practice_crate_opens_record_idx
           ON practice.crate_opens (record_id) WHERE record_id IS NOT NULL`,
      )
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS practice_crate_opens_artist_idx
           ON practice.crate_opens (artist_id) WHERE artist_id IS NOT NULL`,
      )
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS practice_crate_opens_key_idx
           ON practice.crate_opens (client_key) WHERE client_key IS NOT NULL`,
      )
      await client.query(
        'CREATE INDEX IF NOT EXISTS practice_crate_opens_at_idx ON practice.crate_opens (opened_at)',
      )
    })().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
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

async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_POST) throw new Error('too_large')
    return req.body
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > MAX_POST) throw new Error('too_large')
    return JSON.parse(req.body)
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_POST) throw new Error('too_large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const OPEN_COLUMNS = `level, kind, record_id, artist_id, source, opened_at`

function rowBox(row) {
  return {
    level: row.level,
    kind: row.kind,
    recordId: row.record_id,
    artistId: row.artist_id,
    at: row.opened_at instanceof Date ? row.opened_at.toISOString() : row.opened_at,
  }
}

async function openedRows(client) {
  const { rows } = await client.query(
    `SELECT ${OPEN_COLUMNS} FROM practice.crate_opens ORDER BY opened_at, id`,
  )
  return rows.map(rowBox)
}

async function totalXpFor(client) {
  const { rows } = await client.query(
    'SELECT COALESCE(SUM(xp), 0)::int AS total FROM practice.sessions',
  )
  return rows[0]?.total ?? 0
}

function stateOf(opened, totalXp) {
  const level = levelFor(totalXp)
  return { opened, level, totalXp, unopened: Math.max(0, level - opened.length) }
}

function validLevel(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10
}

function validKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value)
}

class Reject extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

async function openBox({ level, clientKey }) {
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    // One crate writer at a time: the unowned pools are read and written here.
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    const totalXp = await totalXpFor(client)
    const earned = levelFor(totalXp)
    if (level > earned) throw new Reject('level_ahead')
    const before = await openedRows(client)
    if (before.length >= earned) throw new Reject('no_boxes')
    const item = pickCrateItem({
      ownedRecords: before.map((row) => row.recordId).filter(Boolean),
      ownedArtists: before.map((row) => row.artistId).filter(Boolean),
    })
    if (!item) throw new Reject('no_boxes')

    const inserted = await client.query(
      `INSERT INTO practice.crate_opens (level, kind, record_id, artist_id, client_key, source)
       VALUES ($1,$2,$3,$4,$5,'app')
       ON CONFLICT (client_key) WHERE client_key IS NOT NULL DO NOTHING
       RETURNING ${OPEN_COLUMNS}`,
      [level, item.kind, item.recordId, item.artistId, clientKey],
    )

    let box = inserted.rows.length ? rowBox(inserted.rows[0]) : null
    let duplicate = false
    if (!box) {
      // A retry of the same client key: answer with the row that already won.
      const existing = await client.query(
        `SELECT ${OPEN_COLUMNS} FROM practice.crate_opens WHERE client_key = $1`,
        [clientKey],
      )
      box = existing.rows.length ? rowBox(existing.rows[0]) : null
      duplicate = Boolean(box)
      if (!box) throw new Reject('no_boxes')
    }

    const after = await openedRows(client)
    await client.query('COMMIT')
    return { box, duplicate, ...stateOf(after, totalXp) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function importRows(rows) {
  const clean = cleanImportRows(rows).slice(0, MAX_IMPORT)
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    let imported = 0
    for (const row of clean) {
      const { rowCount } = await client.query(
        `INSERT INTO practice.crate_opens (level, kind, record_id, artist_id, source, opened_at)
         VALUES ($1,$2,$3,$4,'import', COALESCE($5::timestamptz, now()))
         ON CONFLICT DO NOTHING`,
        [row.level, row.kind, row.recordId, row.artistId, row.at],
      )
      imported += rowCount
    }
    const opened = await openedRows(client)
    const totalXp = await totalXpFor(client)
    await client.query('COMMIT')
    return { imported, skipped: clean.length - imported, ...stateOf(opened, totalXp) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET') {
    if (rateLimited(req)) return write(res, 429, { error: 'rate_limited' })
    try {
      await ensure()
      const client = db()
      const opened = await openedRows(client)
      const totalXp = await totalXpFor(client)
      return write(res, 200, stateOf(opened, totalXp))
    } catch (error) {
      console.error('crate', error?.message || error)
      return write(res, 503, { error: 'crate_unavailable' })
    }
  }

  if (req.method === 'POST') {
    if (rateLimited(req)) return write(res, 429, { error: 'rate_limited' })
    let payload
    try {
      payload = await readBody(req)
    } catch {
      return write(res, 400, { error: 'invalid_body' })
    }
    try {
      if (payload?.action === 'open') {
        if (!validLevel(payload.level) || !validKey(payload.clientKey)) {
          return write(res, 400, { error: 'invalid_body' })
        }
        await ensure()
        const body = await openBox({ level: payload.level, clientKey: payload.clientKey })
        return write(res, 200, body)
      }
      if (payload?.action === 'import') {
        if (!Array.isArray(payload.rows)) return write(res, 400, { error: 'invalid_body' })
        await ensure()
        return write(res, 200, await importRows(payload.rows))
      }
      return write(res, 400, { error: 'invalid_action' })
    } catch (error) {
      if (error instanceof Reject) return write(res, 409, { error: error.code })
      console.error('crate', error?.message || error)
      return write(res, 500, { error: 'crate_failed' })
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return write(res, 405, { error: 'method_not_allowed' })
}
