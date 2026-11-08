// Album art for THE CRATE. Public, no key. Every failure is a 200 with a null
// url so a shelf can fall back to its printed sleeve without an error state.
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const TIMEOUT = 6000
const CACHE = 'public, s-maxage=604800, stale-while-revalidate=86400'

function cors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function send(res, body) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', CACHE)
  // Vercel keeps CDN TTLs on its own header and exposes only `public` to the
  // browser for function responses.
  res.setHeader('Vercel-CDN-Cache-Control', CACHE)
  res.end(JSON.stringify(body))
}

function query(req) {
  if (req.query && typeof req.query === 'object') return req.query
  try {
    return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ url: null }))
  }

  const { artist, album } = query(req)
  const term = `${String(artist || '').trim()} ${String(album || '').trim()}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  if (!term) return send(res, { url: null })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const params = new URLSearchParams({
      term,
      entity: 'album',
      media: 'music',
      limit: '1',
    })
    const upstream = await fetch(`https://itunes.apple.com/search?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!upstream.ok) return send(res, { url: null })
    const body = await upstream.json().catch(() => null)
    const artwork = body?.results?.[0]?.artworkUrl100
    const url = artwork ? String(artwork).replace('100x100bb', '600x600bb') : null
    return send(res, { url })
  } catch {
    return send(res, { url: null })
  } finally {
    clearTimeout(timer)
  }
}
