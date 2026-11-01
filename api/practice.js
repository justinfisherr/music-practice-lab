import pg from 'pg'

const TZ = 'America/Los_Angeles'
const HABIT = 'music_practice'
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const pools = new Map()

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

async function ensure() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = db()
      await pool.query('CREATE SCHEMA IF NOT EXISTS console')
      await pool.query(`CREATE TABLE IF NOT EXISTS console.habit_events (
        habit_key text NOT NULL,
        habit_date date NOT NULL,
        count integer NOT NULL DEFAULT 1,
        source text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (habit_key, habit_date)
      )`)
    })().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function today() {
  return dayFmt.format(new Date())
}

function write(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
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

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
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
    const date = today()

    if (req.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT count, updated_at FROM console.habit_events
          WHERE habit_key = $1 AND habit_date = $2::date`,
        [HABIT, date],
      )
      return write(res, 200, { date, count: rows[0]?.count || 0, updatedAt: rows[0]?.updated_at || null })
    }

    if (req.method === 'POST') {
      const payload = await body(req)
      if (payload.habit && payload.habit !== HABIT) {
        return write(res, 400, { error: 'unknown habit' })
      }
      const amount = Math.min(Math.max(Number.parseInt(payload.count, 10) || 1, 1), 5)
      const { rows } = await pool.query(
        `INSERT INTO console.habit_events (habit_key, habit_date, count, source)
         VALUES ($1, $2::date, $3, 'music-lab')
         ON CONFLICT (habit_key, habit_date) DO UPDATE SET
           count = console.habit_events.count + EXCLUDED.count,
           source = EXCLUDED.source,
           updated_at = now()
         RETURNING habit_date::text AS date, count`,
        [HABIT, date, amount],
      )
      return write(res, 200, { ok: true, ...rows[0] })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return write(res, 405, { error: 'method not allowed' })
  } catch (error) {
    console.error('practice', error)
    return write(res, 500, { error: error.message })
  }
}
