// What Spotify is playing right now, for FREE PLAY. Always 200 with a stable
// shape: a missing token, a dead network, or a paused app is a normal state on
// the panel, never an error status.
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const NOW_URL = 'https://api.spotify.com/v1/me/player/currently-playing'
const RATE_WINDOW = 60_000
const RATE_LIMIT = 30
const FETCH_TIMEOUT = 4000

const hits = new Map()

// One access token per warm lambda. Spotify access tokens last an hour; refresh
// a minute early so a request never races the expiry.
let cached = null

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
  // The panel is a live reading; a cached one would be a lie.
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

function state(body) {
  return {
    connected: false,
    playing: false,
    fetchedAt: Date.now(),
    reason: null,
    track: null,
    ...body,
  }
}

async function accessToken({ id, secret, refresh }) {
  if (cached && cached.expiresAt - Date.now() > 60_000) return { token: cached.value }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.access_token) {
      console.warn('now-playing token', res.status)
      cached = null
      return { reason: 'auth' }
    }
    // A rotation warning, never the value: the dashboard copy is what a
    // redeploy needs, and a logged token is a leaked token.
    if (data.refresh_token && data.refresh_token !== refresh) {
      console.warn('spotify refresh token rotated')
    }
    const expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000
    cached = { value: data.access_token, expiresAt }
    return { token: data.access_token }
  } catch (error) {
    console.warn('now-playing token', error?.name === 'AbortError' ? 'timeout' : 'error')
    return { reason: 'auth' }
  } finally {
    clearTimeout(timer)
  }
}

function art(images) {
  if (!Array.isArray(images) || !images.length) return null
  const usable = images.filter((image) => typeof image?.url === 'string')
  if (!usable.length) return null
  const small = usable
    .filter((image) => Number.isFinite(image.width) && image.width <= 300)
    .sort((a, b) => b.width - a.width)[0]
  if (small) return small.url
  return [...usable].sort((a, b) => (a.width || 0) - (b.width || 0))[0].url
}

function track(item, progressMs) {
  return {
    id: String(item.id || ''),
    title: String(item.name || ''),
    artist: Array.isArray(item.artists)
      ? item.artists.map((entry) => entry?.name).filter(Boolean).join(', ')
      : '',
    album: String(item.album?.name || ''),
    art: art(item.album?.images),
    url: String(item.external_urls?.spotify || ''),
    progressMs: Number.isFinite(progressMs) ? progressMs : 0,
    durationMs: Number.isFinite(item.duration_ms) ? item.duration_ms : 0,
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

  const id = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN
  if (!id || !secret || !refresh) return writeJson(res, state({ reason: 'no_token' }))

  if (rateLimited(req)) return writeJson(res, state({ connected: true, reason: 'rate_limited' }))

  const auth = await accessToken({ id, secret, refresh })
  if (!auth.token) return writeJson(res, state({ reason: auth.reason || 'auth' }))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res2 = await fetch(`${NOW_URL}?additional_types=track`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${auth.token}` },
    })

    if (res2.status === 204) {
      return writeJson(res, state({ connected: true, reason: 'idle' }))
    }
    if (res2.status === 401) {
      // Expired between the check and the call: drop it and let the next poll
      // mint a fresh one.
      cached = null
      return writeJson(res, state({ reason: 'auth' }))
    }
    if (!res2.ok) {
      console.warn('now-playing', res2.status)
      return writeJson(res, state({ connected: true, reason: 'spotify_status' }))
    }

    const data = await res2.json().catch(() => null)
    const item = data?.item
    // A podcast or an ad is not a tune; it reads as nothing playing.
    if (!item || item.type !== 'track' || !item.id) {
      return writeJson(res, state({ connected: true, reason: 'idle' }))
    }
    return writeJson(
      res,
      state({
        connected: true,
        playing: Boolean(data.is_playing),
        reason: null,
        track: track(item, data.progress_ms),
      }),
    )
  } catch (error) {
    console.warn('now-playing', error?.name === 'AbortError' ? 'timeout' : 'error')
    return writeJson(res, state({ connected: true, reason: 'spotify_status' }))
  } finally {
    clearTimeout(timer)
  }
}
