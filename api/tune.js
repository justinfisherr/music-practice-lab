// A tune's key, tempo and changes for the FREE PLAY chord grid. Key and tempo
// are measured (ReccoBeats); the changes are charted by the model. Every
// failure path is a 200 with a null it can render, never an error status.
import { buildTuneMessages, noteName, parseTune } from '../lib/tune.js'

const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const FEATURES_URL = 'https://api.reccobeats.com/v1/audio-features'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash'
const ID_PATTERN = /^[A-Za-z0-9]{22}$/
const POSITIVE_TTL = 6 * 60 * 60 * 1000
const NEGATIVE_TTL = 90 * 1000
const FEATURES_TTL = 6 * 60 * 60 * 1000
const MEMO_CAP = 200
const RATE_WINDOW = 60_000
const RATE_LIMIT = 30
const FEATURES_TIMEOUT = 1500
const MODEL_TIMEOUT = 5500

const memo = new Map()
const featuresMemo = new Map()
const inflight = new Map()
const hits = new Map()

function cors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function writeJson(res, body) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Vary', 'Origin')
  // The memo is the cache: an HTTP cache would outlive a deployment and serve
  // an old response shape for the same id.
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

function remember(map, key, value) {
  map.set(key, { value, at: Date.now() })
  if (map.size <= MEMO_CAP) return
  let oldestKey = null
  let oldestAt = Infinity
  for (const [k, entry] of map) {
    if (entry.at < oldestAt) {
      oldestAt = entry.at
      oldestKey = k
    }
  }
  if (oldestKey) map.delete(oldestKey)
}

const ttlFor = (value) => (value.changes ? POSITIVE_TTL : NEGATIVE_TTL)

function int(value) {
  const number = typeof value === 'string' ? Number(value) : value
  return Number.isInteger(number) ? number : null
}

// ReccoBeats silently omits ids it does not know and still answers 200, so a
// missing entry is a normal miss, not a failure.
async function features(id) {
  const cached = featuresMemo.get(id)
  if (cached && Date.now() - cached.at < FEATURES_TTL) return cached.value

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FEATURES_TIMEOUT)
  try {
    const res = await fetch(`${FEATURES_URL}?ids=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn('tune features', res.status)
      return null
    }
    const data = await res.json().catch(() => null)
    const rows = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
    // Its `id` is ReccoBeats' own uuid, so the track is matched on the link.
    // One id was asked for: a lone row is that track.
    const row = rows.find((entry) => String(entry?.href || '').includes(id)) || rows[0]
    if (!row) return null

    const keyPc = int(row.key)
    const mode = row.mode === 1 || row.mode === 'major' ? 'major' : row.mode === 0 || row.mode === 'minor' ? 'minor' : null
    // The tempo is a float (135.128); the panel says BPM as a whole number.
    const rawTempo = typeof row.tempo === 'string' ? Number(row.tempo) : row.tempo
    const bpm = Number.isFinite(rawTempo) ? Math.round(rawTempo) : null
    const value = {
      keyPc: keyPc != null && keyPc >= 0 && keyPc <= 11 ? keyPc : null,
      mode,
      bpm: bpm != null && bpm >= 40 && bpm <= 300 ? bpm : null,
    }
    // Only a hit is worth six hours; a miss is retried on the next request.
    if (value.keyPc != null || value.bpm != null) remember(featuresMemo, id, value)
    return value
  } catch (error) {
    console.warn('tune features', error?.name === 'AbortError' ? 'timeout' : 'error')
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function chart({ title, artist, album, keyHint, tempoHint }) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { reason: 'no_api_key' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT)
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 600,
        // The pinned model reasons by default and would spend the budget
        // before emitting JSON.
        reasoning: { enabled: false },
        response_format: { type: 'json_object' },
        messages: buildTuneMessages({ title, artist, album, keyHint, tempoHint }),
      }),
    })
    if (!res.ok) {
      console.warn('tune', res.status)
      return { reason: 'upstream_status' }
    }
    const data = await res.json().catch(() => null)
    const parsed = parseTune(data?.choices?.[0]?.message?.content)
    if (!parsed) return { reason: 'parse' }
    return { parsed }
  } catch (error) {
    console.warn('tune', error?.name === 'AbortError' ? 'timeout' : 'error')
    return { reason: error?.name === 'AbortError' ? 'timeout' : 'error' }
  } finally {
    clearTimeout(timer)
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

  const id = String(req.query?.id || '')
  const write = (value) =>
    writeJson(res, {
      id,
      key: value.key ?? null,
      tempo: value.tempo ?? null,
      changes: value.changes ?? null,
      reason: value.reason || null,
    })

  // Nothing outbound for an id that cannot be one.
  if (!ID_PATTERN.test(id)) return write({ reason: 'bad_id' })
  if (rateLimited(req)) return write({ reason: 'error' })

  const cached = memo.get(id)
  if (cached && Date.now() - cached.at < ttlFor(cached.value)) return write(cached.value)

  const pending = inflight.get(id)
  if (pending) return write(await pending)

  const request = (async () => {
    try {
      const title = String(req.query?.title || '')
      const artist = String(req.query?.artist || '')
      const album = String(req.query?.album || '')
      const audio = await features(id)
      const charted = await chart({
        title,
        artist,
        album,
        keyHint: audio?.keyPc != null && audio?.mode ? noteName(audio.keyPc) : null,
        tempoHint: audio?.bpm ?? null,
      })

      const parsed = charted.parsed || null
      const changes = parsed ? { known: parsed.known, chords: parsed.chords } : null
      const key = audio?.keyPc != null && audio?.mode
        ? { pc: audio.keyPc, mode: audio.mode, source: 'audio' }
        : parsed?.key
          ? { ...parsed.key, source: 'model' }
          : null
      const tempo = audio?.bpm != null
        ? { bpm: audio.bpm, source: 'audio' }
        : parsed?.tempo != null
          ? { bpm: parsed.tempo, source: 'model' }
          : null

      const value = {
        key,
        tempo,
        changes,
        // With a chart but no key at all, the audio had no key and the model
        // did not guess one; otherwise the reason is the model's failure.
        reason: changes ? (key ? null : 'no_features') : charted.reason || 'error',
      }
      remember(memo, id, value)
      return value
    } catch (error) {
      console.warn('tune', error?.name === 'AbortError' ? 'timeout' : 'error')
      return { reason: 'error' }
    }
  })()

  inflight.set(id, request)
  const value = await request.finally(() => inflight.delete(id))
  return write(value)
}
