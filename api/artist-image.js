// Artist portrait and blurb for the trading cards. Wikipedia's summary endpoint
// first, iTunes artist art as the fallback. Public, no key, never an error body.
const ALLOWED = new Set([
  'https://music-practice-lab.vercel.app',
  'https://justinfisherr.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
])

const TIMEOUT = 6000
const CACHE = 'public, s-maxage=604800, stale-while-revalidate=86400'
const UA = 'BrutalistMusicLab/1.0 (https://music-practice-lab.vercel.app)'

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

async function wikipedia(name, signal) {
  const title = encodeURIComponent(name.replace(/ /g, '_'))
  const upstream = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!upstream.ok) return null
  const body = await upstream.json().catch(() => null)
  if (!body) return null
  return {
    url: body.thumbnail?.source || body.originalimage?.source || null,
    extract: body.type === 'disambiguation' ? null : body.extract || null,
    page: body.content_urls?.desktop?.page || null,
  }
}

async function itunesArt(name, signal) {
  const params = new URLSearchParams({ term: name, entity: 'musicArtist', media: 'music', limit: '1' })
  const upstream = await fetch(`https://itunes.apple.com/search?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!upstream.ok) return null
  const body = await upstream.json().catch(() => null)
  const artwork = body?.results?.[0]?.artworkUrl100
  return artwork ? String(artwork).replace(/\d+x\d+bb/, '600x600bb') : null
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
    return res.end(JSON.stringify({ url: null, extract: null, page: null }))
  }

  const name = String(query(req).name || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  if (!name) return send(res, { url: null, extract: null, page: null })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const wiki = await wikipedia(name, controller.signal).catch(() => null)
    if (wiki?.url) return send(res, wiki)
    const fallback = await itunesArt(name, controller.signal).catch(() => null)
    return send(res, {
      url: fallback,
      extract: wiki?.extract || null,
      page: wiki?.page || null,
    })
  } catch {
    return send(res, { url: null, extract: null, page: null })
  } finally {
    clearTimeout(timer)
  }
}
