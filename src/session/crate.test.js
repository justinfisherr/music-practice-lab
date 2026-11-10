import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CRATE_KEY,
  RECORDS,
  artistFor,
  collection,
  loadCrate,
  mergeOpened,
  ownedIds,
  rarityFor,
  recordById,
  saveCrate,
  unopened,
} from './crate.js'
import {
  ARTIST_IDS,
  RECORD_IDS,
  cleanImportRows,
  pickCrateItem,
} from '../../lib/crate.js'

function reset() {
  const data = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
  }
  return data
}

test('rarity thresholds land on GRAIL, STAPLE, and DEEP CUT', () => {
  assert.equal(rarityFor(10), 'GRAIL')
  assert.equal(rarityFor(9), 'GRAIL')
  assert.equal(rarityFor(8.5), 'STAPLE')
  assert.equal(rarityFor(7.75), 'DEEP CUT')
  assert.equal(rarityFor(null), 'DEEP CUT')
})

test('unopened is level minus opened, never below zero', () => {
  reset()
  assert.equal(unopened(1), 1)
  saveCrate({
    opened: [
      { level: 1, recordId: RECORDS[0].id, artistId: RECORDS[0].artistId, at: 'x' },
      { level: 2, recordId: RECORDS[1].id, artistId: RECORDS[1].artistId, at: 'x' },
    ],
  })
  assert.equal(unopened(4), 2)
  assert.equal(unopened(2), 0)
})

test('unopened prefers the number the server sent', () => {
  reset()
  assert.equal(unopened(4, { opened: [], unopened: 2 }), 2)
  assert.equal(unopened(4, { opened: [], unopened: 0 }), 0)
  assert.equal(unopened(4, { opened: [], unopened: null }), 4)
})

test('mergeOpened keeps the server row and lets the mirror fill the gaps', () => {
  reset()
  const a = RECORDS[0]
  const b = RECORDS[1]
  const merged = mergeOpened(
    [
      { level: 1, recordId: a.id, at: '2026-01-01T00:00:00.000Z' },
      { level: 2, recordId: b.id, at: '2026-01-02T00:00:00.000Z' },
      { level: 3, recordId: 'not-a-record', at: '2026-01-03T00:00:00.000Z' },
    ],
    [{ level: 1, recordId: a.id, at: '2026-02-01T00:00:00.000Z' }],
  )
  assert.deepEqual(
    merged.map((entry) => entry.recordId),
    [a.id, b.id],
  )
  assert.equal(merged[0].at, '2026-02-01T00:00:00.000Z')
})

test('mergeOpened dedupes the same id on both sides', () => {
  reset()
  const a = RECORDS[0]
  const row = { level: 1, recordId: a.id, at: '2026-01-01T00:00:00.000Z' }
  assert.equal(mergeOpened([row], [row]).length, 1)
  assert.equal(mergeOpened([row, row], []).length, 1)
})

test('stored rows survive a reload and drop unknown or duplicate ids', () => {
  reset()
  const a = RECORDS[0]
  const b = RECORDS[1]
  globalThis.window.localStorage.setItem(
    CRATE_KEY,
    JSON.stringify({
      opened: [
        { level: 1, recordId: a.id, artistId: a.artistId, at: 'a' },
        { level: 2, recordId: a.id, artistId: a.artistId, at: 'b' },
        { level: 3, recordId: 'not-a-record', artistId: 'nope', at: 'c' },
        { level: 4, recordId: b.id, artistId: b.artistId, at: 'd' },
      ],
    }),
  )
  const stored = loadCrate()
  assert.deepEqual(stored.opened.map((entry) => entry.recordId), [a.id, b.id])
  const rows = collection(stored)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].record.id, a.id)
  assert.equal(rows[0].artist.id, a.artistId)
  assert.equal(rows[0].rarity, rarityFor(a.rating))
  assert.ok(ownedIds(stored).has(a.id))
})

test('record and artist lookups resolve', () => {
  reset()
  const record = recordById('cannonball-adderley--somethin-else')
  assert.ok(record)
  assert.equal(record.rating, 10)
  assert.equal(artistFor(record).id, record.artistId)
  assert.equal(recordById('missing'), null)
})

test('the server never picks a record or artist the crate already owns', () => {
  const ownedRecords = RECORD_IDS.slice(0, 25)
  const ownedArtists = ARTIST_IDS.slice(0, 5)
  for (const random of [() => 0, () => 0.5, () => 0.99]) {
    const item = pickCrateItem({ ownedRecords, ownedArtists, random })
    assert.ok(item)
    assert.equal(ownedRecords.includes(item.recordId), false)
    assert.equal(ownedArtists.includes(item.artistId), false)
    assert.equal(Boolean(item.recordId) && Boolean(item.artistId), false)
  }
  assert.equal(pickCrateItem({ ownedRecords, ownedArtists, random: () => 0 }).kind, 'record')
  assert.equal(pickCrateItem({ ownedRecords, ownedArtists, random: () => 0.99 }).kind, 'artist')
})

test('an emptied crate has nothing left to pick', () => {
  assert.equal(pickCrateItem({ ownedRecords: RECORD_IDS, ownedArtists: ARTIST_IDS }), null)
})

test('import rows are validated, clamped, and deduped', () => {
  const rows = cleanImportRows([
    { level: 99, recordId: RECORD_IDS[0], at: '2026-01-01T00:00:00.000Z' },
    { level: 1, recordId: RECORD_IDS[0] },
    { level: 2, recordId: 'not-a-record' },
    null,
    { level: 3, artistId: ARTIST_IDS[0] },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].recordId, RECORD_IDS[0])
  assert.equal(rows[0].level, 10)
  assert.equal(rows[0].kind, 'record')
  assert.equal(rows[1].artistId, ARTIST_IDS[0])
  assert.equal(rows[1].kind, 'artist')
  assert.deepEqual(cleanImportRows('nope'), [])
})
