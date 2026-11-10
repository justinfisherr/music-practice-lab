import vinyls from '../src/data/vinyls.json' with { type: 'json' }
import artists from '../src/data/artists.json' with { type: 'json' }

// The crate catalog is the jazz dataset, bundled. Six album spellings slug to
// the same id; keep the higher-rated copy so a purchase is always unique. The
// server picks the box, so the client and the ledger can never disagree.
const recordMap = new Map()
for (const record of vinyls) {
  if (!record?.id) continue
  const prev = recordMap.get(record.id)
  if (!prev || (record.rating ?? 0) > (prev.rating ?? 0)) recordMap.set(record.id, record)
}

const artistMap = new Map(artists.filter((artist) => artist?.id).map((artist) => [artist.id, artist]))

export const RECORD_IDS = [...recordMap.keys()]
export const ARTIST_IDS = [...artistMap.keys()]

const RECORD_ID_SET = new Set(RECORD_IDS)
const ARTIST_ID_SET = new Set(ARTIST_IDS)

export function isRecordId(id) {
  return typeof id === 'string' && RECORD_ID_SET.has(id)
}

export function isArtistId(id) {
  return typeof id === 'string' && ARTIST_ID_SET.has(id)
}

function cleanLevel(value) {
  const level = Math.round(Number(value))
  return Number.isFinite(level) ? Math.min(10, Math.max(1, level)) : 1
}

function pickedIndex(length, random) {
  if (typeof random === 'function') {
    return Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
  }
  return Math.floor(Math.random() * length)
}

// One box from whatever is unowned: a record or an artist card, never both.
// Both pools empty means nothing to give.
export function pickCrateItem({ ownedRecords = [], ownedArtists = [], random = null } = {}) {
  const haveRecords = new Set(ownedRecords)
  const haveArtists = new Set(ownedArtists)
  const recordPool = RECORD_IDS.filter((id) => !haveRecords.has(id))
  const artistPool = ARTIST_IDS.filter((id) => !haveArtists.has(id))
  if (!recordPool.length && !artistPool.length) return null

  const kind =
    recordPool.length && (!artistPool.length || pickedIndex(2, random) === 0) ? 'record' : 'artist'
  const recordId = kind === 'record' ? recordPool[pickedIndex(recordPool.length, random)] : null
  const artistId = kind === 'artist' ? artistPool[pickedIndex(artistPool.length, random)] : null
  return { kind, recordId, artistId }
}

// Rows the client kept in localStorage before the server owned the crate. Bad
// rows are dropped, and a record or artist already seen is dropped too.
export function cleanImportRows(rows) {
  if (!Array.isArray(rows)) return []
  const seenRecords = new Set()
  const seenArtists = new Set()
  const clean = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const recordId = isRecordId(row.recordId) ? row.recordId : null
    const artistId = isArtistId(row.artistId) ? row.artistId : null
    if (!recordId && !artistId) continue
    const keepRecord = Boolean(recordId && !seenRecords.has(recordId))
    const keepArtist = Boolean(artistId && !seenArtists.has(artistId))
    if (!keepRecord && !keepArtist) continue
    if (keepRecord) seenRecords.add(recordId)
    if (keepArtist) seenArtists.add(artistId)
    clean.push({
      level: cleanLevel(row.level),
      kind: keepRecord && keepArtist ? 'both' : keepRecord ? 'record' : 'artist',
      recordId: keepRecord ? recordId : null,
      artistId: keepArtist ? artistId : null,
      at: typeof row.at === 'string' ? row.at : null,
    })
  }
  return clean
}
