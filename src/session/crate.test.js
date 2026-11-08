import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CRATE_KEY,
  RECORDS,
  artistFor,
  collection,
  loadCrate,
  openBox,
  ownedIds,
  rarityFor,
  recordById,
  saveCrate,
  unopened,
} from './crate.js'

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

test('level 1 opens one box with either a record or an artist card', () => {
  reset()
  const first = openBox(1, { random: () => 0 })
  assert.ok(first)
  assert.equal(first.kind, 'record')
  assert.equal(first.record.id, RECORDS[0].id)
  assert.equal(first.artist, null)
  assert.equal(first.level, 1)

  const stored = loadCrate()
  assert.equal(stored.opened.length, 1)
  assert.equal(stored.opened[0].recordId, RECORDS[0].id)
  assert.equal(stored.opened[0].artistId, null)
  assert.ok(ownedIds(stored).has(RECORDS[0].id))

  assert.equal(openBox(1, { random: () => 0 }), null)
  assert.equal(JSON.parse(globalThis.window.localStorage.getItem(CRATE_KEY)).opened.length, 1)
})

test('an artist box stores only the artist card', () => {
  reset()
  const box = openBox(1, { random: () => 0.99 })
  assert.ok(box)
  assert.equal(box.kind, 'artist')
  assert.equal(box.record, null)
  assert.ok(box.artist?.id)

  const stored = loadCrate()
  assert.equal(stored.opened[0].recordId, null)
  assert.equal(stored.opened[0].artistId, box.artist.id)
  const rows = collection(stored)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].record, null)
  assert.equal(rows[0].artist.id, box.artist.id)
  assert.equal(rows[0].hasArtistCard, true)
})

test('ten boxes at level 10 never duplicate a record', () => {
  reset()
  assert.equal(unopened(10), 10)
  const ids = new Set()
  for (let i = 0; i < 10; i++) {
    const box = openBox(10, { random: () => 0 })
    assert.ok(box)
    assert.equal(ids.has(box.record.id), false)
    ids.add(box.record.id)
  }
  assert.equal(ids.size, 10)
  assert.equal(loadCrate().opened.length, 10)
  assert.equal(openBox(10, { random: () => 0 }), null)
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
})

test('record and artist lookups resolve', () => {
  reset()
  const record = recordById('cannonball-adderley--somethin-else')
  assert.ok(record)
  assert.equal(record.rating, 10)
  assert.equal(artistFor(record).id, record.artistId)
  assert.equal(recordById('missing'), null)
})
