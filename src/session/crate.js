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

export function loadCrate() {
  const stored = safeRead(CRATE_KEY, null)
  return { opened: cleanOpened(stored?.opened) }
}

export function saveCrate(state) {
  const opened = cleanOpened(state?.opened)
  safeWrite(CRATE_KEY, { opened })
  return { opened }
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

export function unopened(level, state = loadCrate()) {
  return Math.max(0, cleanLevel(level) - cleanOpened(state?.opened).length)
}

function pickedIndex(length, random) {
  if (typeof random === 'function') {
    return Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
  }
  try {
    const buffer = new Uint32Array(1)
    crypto.getRandomValues(buffer)
    return buffer[0] % length
  } catch {
    return Math.floor(Math.random() * length)
  }
}

export function openBox(level, { state = loadCrate(), random = null } = {}) {
  if (unopened(level, state) <= 0) return null
  const recordPool = RECORDS.filter((record) => !ownedIds(state).has(record.id))
  const artistPool = ARTISTS.filter((artist) => !ownedArtistIds(state).has(artist.id))
  if (!recordPool.length && !artistPool.length) return null

  const kind = recordPool.length && (!artistPool.length || pickedIndex(2, random) === 0)
    ? 'record'
    : 'artist'
  const record = kind === 'record' ? recordPool[pickedIndex(recordPool.length, random)] : null
  const artist = kind === 'artist' ? artistPool[pickedIndex(artistPool.length, random)] : null
  const levelValue = cleanLevel(level)
  saveCrate({
    opened: [...state.opened, {
      level: levelValue,
      kind,
      recordId: record?.id || null,
      artistId: artist?.id || null,
      at: new Date().toISOString(),
    }],
  })
  return { kind, record, artist, level: levelValue }
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
