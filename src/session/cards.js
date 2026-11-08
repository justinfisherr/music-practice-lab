import { fallbackCards } from '../../lib/cards.js'
import { safeRead, safeWrite } from './store.js'

// Client card fetch. START never waits: this module always resolves to a usable
// card list, never throws, and writes the local fallback to the API in the
// background. A late response is the caller's problem to ignore.
export const CARDS_ENDPOINT =
  import.meta.env.VITE_CARDS_ENDPOINT || 'https://music-practice-lab.vercel.app/api/cards'

const TIMEOUT = 6000
const POSITIVE_TTL = 6 * 60 * 60 * 1000
const NEGATIVE_TTL = 15 * 60 * 1000
const CAP = 20
const PREFIX = 'mpl.cards.'

function cacheKey(date, keyId) {
  return `${PREFIX}${date}.${keyId}`
}

function cacheFresh(entry) {
  if (!entry || !Array.isArray(entry.cards)) return false
  const ttl = entry.negative ? NEGATIVE_TTL : POSITIVE_TTL
  return Date.now() - Number(entry.at || 0) < ttl
}

function sweep() {
  try {
    const keys = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(PREFIX)) keys.push(key)
    }
    if (keys.length <= CAP) return
    keys.sort()
    for (const key of keys.slice(0, keys.length - CAP)) window.localStorage.removeItem(key)
  } catch {
    // storage unavailable
  }
}

function remember(key, value, negative) {
  safeWrite(key, { at: Date.now(), negative, cards: value.cards })
  sweep()
}

function accept(body, date, keyId) {
  if (!body || !Array.isArray(body.cards) || body.cards.length !== 2) return null
  const cards = body.cards.filter(
    (card) =>
      card &&
      typeof card.concept === 'string' &&
      typeof card.title === 'string' &&
      typeof card.howTo === 'string' &&
      typeof card.rationale === 'string' &&
      card.params &&
      Array.isArray(card.params.degrees),
  )
  if (cards.length !== 2) return null
  return {
    source: body.source || 'stored',
    date: body.date || date,
    keyId: body.keyId || keyId,
    cards,
  }
}

function persist(cards) {
  try {
    fetch(CARDS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // best effort only
  }
}

function local(date, keyId) {
  const cards = fallbackCards({ keyId, date })
  return { source: 'fallback', date, keyId, cards }
}

export async function getCards({ date, keyId }) {
  const key = cacheKey(date, keyId)
  const cached = safeRead(key, null)
  if (cacheFresh(cached)) {
    return { source: cached.negative ? 'fallback' : 'stored', date, keyId, cards: cached.cards }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const url = `${CARDS_ENDPOINT}?date=${encodeURIComponent(date)}&keyId=${encodeURIComponent(keyId)}`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json().catch(() => null)
    const value = accept(body, date, keyId)
    if (!value) throw new Error('bad_body')
    remember(key, value, value.source === 'fallback')
    return value
  } catch {
    const value = local(date, keyId)
    remember(key, value, true)
    persist(value.cards)
    return value
  } finally {
    clearTimeout(timer)
  }
}
