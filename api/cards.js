import pg from 'pg'
import {
  buildCardMessages,
  fallbackCard,
  fallbackCards,
  fingerprintFor,
  parseCards,
  selectConcepts,
  CARD_CONCEPTS,
  CARD_SPECS,
  CARD_WHY,
  LEGACY_CONCEPTS,
} from '../lib/cards.js'

const DB_CONCEPTS = [...CARD_CONCEPTS, ...LEGACY_CONCEPTS]
const DB_CONCEPT_SQL = DB_CONCEPTS.map((concept) => `'${concept}'`).join(',')

// Card instances for THE SET. One row per concept per key per LA date, keyed by
// a sha256 fingerprint. GET always answers 200 for valid input: a missing key,
// a bad model response, or a dead database falls back to the deterministic card.
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const KEY_IDS = new Set([
  'C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F',
])

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash'
const FETCH_TIMEOUT = 7000
const MAX_POST = 8 * 1024
const RATE_WINDOW = 60_000
const RATE_LIMIT = 40
const hits = new Map()
let pool = null
let schemaPromise = null

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
      await client.query(`CREATE TABLE IF NOT EXISTS practice.cards (
        id text PRIMARY KEY,
        concept text NOT NULL,
        key_id text NOT NULL,
        card_date date NOT NULL,
        title text NOT NULL,
        how_to text NOT NULL,
        params jsonb NOT NULL,
        rationale text NOT NULL,
        source text NOT NULL CHECK (source IN ('llm','fallback')),
        fingerprint text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )`)
      // Idempotent: drop every CHECK that mentions concept (the first v4 table
      // restricted it to two values), then add the pool + legacy check. A DO
      // block catches older constraint names too.
      await client.query(`DO $$
        DECLARE item record;
        BEGIN
          FOR item IN
            SELECT conname FROM pg_constraint
             WHERE conrelid = 'practice.cards'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) ILIKE '%concept%'
          LOOP
            EXECUTE format('ALTER TABLE practice.cards DROP CONSTRAINT %I', item.conname);
          END LOOP;
        END $$`)
      await client.query(
        `ALTER TABLE practice.cards ADD CONSTRAINT practice_cards_concept_check CHECK (concept IN (${DB_CONCEPT_SQL}))`,
      )
      await client.query(
        'CREATE INDEX IF NOT EXISTS practice_cards_key_date_idx ON practice.cards (key_id, card_date DESC)',
      )
      await client.query(
        'CREATE INDEX IF NOT EXISTS practice_cards_concept_date_idx ON practice.cards (concept, card_date DESC)',
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

function rowCard(row) {
  return {
    id: row.id,
    concept: row.concept,
    keyId: row.key_id,
    date: row.card_date,
    title: row.title,
    howTo: row.how_to,
    params: row.params,
    rationale: row.rationale,
    source: row.source,
    fingerprint: row.fingerprint,
  }
}

function responseCard(card) {
  const spec = CARD_SPECS[card.concept] || {}
  return {
    id: card.id,
    concept: card.concept,
    stageId: spec.stageId,
    kind: spec.kind,
    tone: spec.kind === 'land' ? (card.params?.tone ?? spec.tone) : null,
    rule: spec.rule ?? null,
    degrees: Array.isArray(card.params?.degrees) ? card.params.degrees : [],
    keyId: card.keyId,
    date: card.date,
    title: card.title,
    howTo: card.howTo,
    params: card.params,
    rationale: card.rationale,
    why: CARD_WHY[card.concept] || '',
    source: card.source,
    fingerprint: card.fingerprint,
  }
}

function materialize(card, { keyId, date, source }) {
  const fingerprint = fingerprintFor(card.concept, keyId, date)
  return {
    ...card,
    id: fingerprint,
    fingerprint,
    keyId,
    date,
    source,
  }
}

async function storedCards(client, date, keyId, concepts) {
  const fingerprints = concepts.map((concept) => fingerprintFor(concept, keyId, date))
  const { rows } = await client.query(
    `SELECT id, concept, key_id, card_date::text AS card_date, title, how_to,
            params, rationale, source, fingerprint
       FROM practice.cards
      WHERE fingerprint = ANY($1)`,
    [fingerprints],
  )
  return rows.map(rowCard)
}

async function persist(client, cards) {
  for (const card of cards) {
    await client.query(
      `INSERT INTO practice.cards
        (id, concept, key_id, card_date, title, how_to, params, rationale, source, fingerprint)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7::jsonb,$8,$9,$10)
       ON CONFLICT (fingerprint) DO NOTHING`,
      [
        card.id,
        card.concept,
        card.keyId,
        card.date,
        card.title,
        card.howTo,
        JSON.stringify(card.params),
        card.rationale,
        card.source,
        card.fingerprint,
      ],
    )
  }
  const concepts = cards.map((card) => card.concept)
  return storedCards(client, cards[0].date, cards[0].keyId, concepts)
}

async function generate({ date, keyId, concepts }) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 900,
        reasoning: { enabled: false },
        messages: buildCardMessages({ date, keyId, concepts }),
      }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const text = data?.choices?.[0]?.message?.content
    return parseCards(text, concepts)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function sourceOf(cards, stored = false) {
  if (stored) return 'stored'
  const kinds = new Set(cards.map((card) => card.source))
  if (kinds.size === 1) return kinds.has('llm') ? 'llm' : 'fallback'
  return 'mixed'
}

async function getCards(date, keyId) {
  const concepts = selectConcepts(date, keyId)
  let client
  let stored = []
  try {
    await ensure()
    client = db()
    stored = await storedCards(client, date, keyId, concepts)
    if (stored.length === concepts.length) {
      return {
        source: 'stored',
        date,
        keyId,
        cards: concepts.map(
          (concept) => stored.find((card) => card.concept === concept),
        ).map(responseCard),
      }
    }
  } catch (error) {
    console.error('cards', error?.message || error)
    return { source: 'fallback', date, keyId, cards: fallbackCards({ keyId, date }).map(responseCard) }
  }

  const have = new Map(stored.map((card) => [card.concept, card]))
  const generated = await generate({ date, keyId, concepts })
  const byConcept = new Map((generated || []).map((card) => [card.concept, card]))
  const cards = concepts.map((concept) => {
    if (have.has(concept)) return have.get(concept)
    const candidate = byConcept.get(concept)
    return candidate
      ? materialize(candidate, { keyId, date, source: 'llm' })
      : fallbackCard(concept, { keyId, date })
  })

  try {
    const rows = await persist(client, cards)
    const map = new Map(rows.map((card) => [card.concept, card]))
    return {
      source: sourceOf(cards),
      date,
      keyId,
      cards: concepts.map((concept) => map.get(concept)).filter(Boolean).map(responseCard),
    }
  } catch (error) {
    console.error('cards persist', error?.message || error)
    return { source: 'fallback', date, keyId, cards: fallbackCards({ keyId, date }).map(responseCard) }
  }
}

// Best-effort persistence for cards the client generated locally. Server copy
// always wins on conflict; ids and fingerprints are recomputed here.
async function postCards(payload) {
  const cards = Array.isArray(payload?.cards) ? payload.cards : [payload]
  if (cards.length === 0 || cards.length > 2) throw new Error('invalid')
  const normalized = []
  for (const card of cards) {
    if (!card || typeof card !== 'object') throw new Error('invalid')
    const concept = card.concept
    if (!DB_CONCEPTS.includes(concept)) throw new Error('invalid')
    const date = card.date ?? payload?.date
    const keyId = card.keyId ?? payload?.keyId
    if (!validDate(date) || !KEY_IDS.has(keyId)) throw new Error('invalid')
    // Force the fallback instance, never trusting client copy or source.
    normalized.push(fallbackCard(concept, { keyId, date }))
  }
  await ensure()
  const client = db()
  const rows = await persist(client, normalized)
  return rows
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET') {
    const date = String(req.query?.date || '')
    const keyId = String(req.query?.keyId || '')
    if (!validDate(date) || !KEY_IDS.has(keyId)) {
      return write(res, 400, { error: 'invalid_input' })
    }
    if (rateLimited(req)) return write(res, 429, { error: 'rate_limited' })
    const body = await getCards(date, keyId)
    return write(res, 200, body)
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
      const rows = await postCards(payload)
      return write(res, 200, {
        ok: true,
        cards: rows.map(responseCard),
      })
    } catch {
      return write(res, 400, { error: 'invalid_body' })
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return write(res, 405, { error: 'method_not_allowed' })
}
