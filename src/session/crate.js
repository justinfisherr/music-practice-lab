import vinyls from '../data/vinyls.json' with { type: 'json' }
import artists from '../data/artists.json' with { type: 'json' }
import { safeRead, safeWrite } from './store.js'

// The crate catalog is the jazz dataset, bundled. Six album spellings slug to
// the same id; keep the higher-rated copy so a purchase is always unique.
const recordMap = new Map()
for (const record of vinyls) {
  if (!record?.id) continue
  const prev = recordMap.get(record.id)
  if (!prev || (record.rating ?? 0) > (prev.rating ?? 0)) recordMap.set(record.id, record)
}

const artistMap = new Map(artists.map((artist) => [artist.id, artist]))

export const RECORDS = [...recordMap.values()]
export const ARTISTS = artists
export const CRATE_KEY = 'mpl.crate'
export const CRATE_SEED_KEY = 'mpl.crate.seeded'
export const CRATE_ENDPOINT =
  import.meta.env?.VITE_CRATE_ENDPOINT || 'https://music-practice-lab.vercel.app/api/crate'

function cleanLevel(value) {
  const level = Math.round(Number(value))
  return Number.isFinite(level) ? Math.min(10, Math.max(1, level)) : 1
}

function cleanOpened(opened) {
  if (!Array.isArray(opened)) return []
  const seenRecords = new Set()
  const seenArtists = new Set()
  const rows = []
  for (const entry of opened) {
    if (!entry || typeof entry !== 'object') continue
    const hasRecord = typeof entry.recordId === 'string'
    const hasArtist = typeof entry.artistId === 'string'
    if (!hasRecord && !hasArtist) continue
    const record = hasRecord ? recordMap.get(entry.recordId) : null
    const artist = hasArtist ? artistMap.get(entry.artistId) : null
    const keepRecord = Boolean(record && !seenRecords.has(record.id))
    const keepArtist = Boolean(artist && !seenArtists.has(artist.id))
    if (!keepRecord && !keepArtist) continue
    if (keepRecord) seenRecords.add(record.id)
    if (keepArtist) seenArtists.add(artist.id)
    rows.push({
      level: cleanLevel(entry.level),
      kind: keepRecord && keepArtist ? 'both' : keepRecord ? 'record' : 'artist',
      recordId: keepRecord ? record.id : null,
      artistId: keepArtist ? artist.id : null,
      at: typeof entry.at === 'string' ? entry.at : null,
    })
  }
  return rows
}

// The local copy is a mirror of the server. Remote rows win: cleanOpened keeps
// the first sighting of each id, so the server's copy is taken and the local
// mirror only fills the gaps. Unknown ids never survive cleanOpened.
export function mergeOpened(local, remote) {
  return cleanOpened([...cleanOpened(remote), ...cleanOpened(local)])
}

export function loadCrate() {
  const stored = safeRead(CRATE_KEY, null)
  return {
    opened: cleanOpened(stored?.opened),
    unopened: typeof stored?.unopened === 'number' ? stored.unopened : null,
    level: typeof stored?.level === 'number' ? stored.level : null,
  }
}

export function saveCrate(state) {
  const opened = cleanOpened(state?.opened)
  const unopened =
    typeof state?.unopened === 'number' && Number.isFinite(state.unopened)
      ? Math.max(0, Math.round(state.unopened))
      : null
  const level = typeof state?.level === 'number' ? Math.round(state.level) : null
  safeWrite(CRATE_KEY, { opened, unopened, level })
  return { opened, unopened, level }
}

export function ownedIds(state = loadCrate()) {
  return new Set(
    cleanOpened(state?.opened)
      .map((entry) => entry.recordId)
      .filter(Boolean),
  )
}

export function ownedArtistIds(state = loadCrate()) {
  return new Set(
    cleanOpened(state?.opened)
      .map((entry) => entry.artistId)
      .filter(Boolean),
  )
}

// The server knows the level and how many boxes are left; the local formula is
// only a fallback for a device that has never synced.
export function unopened(level, state = loadCrate()) {
  const remote = state?.unopened
  if (typeof remote === 'number' && Number.isFinite(remote)) return Math.max(0, Math.round(remote))
  return Math.max(0, cleanLevel(level) - cleanOpened(state?.opened).length)
}

async function request(options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(CRATE_ENDPOINT, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = new Error(body.error || `HTTP ${res.status}`)
      error.status = res.status
      throw error
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

function newClientKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `crate-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Pull the ledger and fold it into the mirror. Throws when the server is
// unreachable, so the page can say it is showing the last sync.
export async function syncCrate() {
  const body = await request()
  return saveCrate({
    opened: mergeOpened(loadCrate().opened, body.opened),
    unopened: body.unopened,
    level: body.level,
  })
}

// Opening is never faked: the box is picked server-side inside a transaction.
export async function openCrateBox(level) {
  const body = await request({
    method: 'POST',
    body: JSON.stringify({ action: 'open', level: cleanLevel(level), clientKey: newClientKey() }),
  })
  saveCrate({
    opened: mergeOpened(loadCrate().opened, body.opened),
    unopened: body.unopened,
    level: body.level,
  })
  const box = body.box || {}
  return {
    kind: box.kind,
    record: box.recordId ? recordById(box.recordId) : null,
    artist: box.artistId ? artistById(box.artistId) : null,
    level: box.level,
  }
}

// Collections kept on this device before the server owned the crate are sent
// once. The flag is written only after a 2xx, so a failed import retries.
export async function seedCrateOnce() {
  if (safeRead(CRATE_SEED_KEY, false) === true) return
  const opened = cleanOpened(loadCrate().opened)
  if (!opened.length) return
  await request({ method: 'POST', body: JSON.stringify({ action: 'import', rows: opened }) })
  safeWrite(CRATE_SEED_KEY, true)
}

export function rarityFor(rating) {
  const value = Number(rating)
  if (!Number.isFinite(value)) return 'DEEP CUT'
  if (value >= 9) return 'GRAIL'
  if (value >= 8) return 'STAPLE'
  return 'DEEP CUT'
}

export function recordById(id) {
  return recordMap.get(id) || null
}

export function artistById(id) {
  return artistMap.get(id) || null
}

export function artistFor(record) {
  return record ? artistById(record.artistId) : null
}

export function collection(state = loadCrate()) {
  const rows = []
  for (const entry of cleanOpened(state?.opened)) {
    const record = entry.recordId ? recordById(entry.recordId) : null
    const artist = entry.artistId
      ? artistById(entry.artistId)
      : record
        ? artistFor(record)
        : null
    if (!record && !artist) continue
    rows.push({
      ...entry,
      record,
      artist,
      hasArtistCard: Boolean(entry.artistId),
      rarity: record ? rarityFor(record.rating) : rarityFor(artist?.maxRating),
    })
  }
  return rows
}
