import fs from 'node:fs'
import path from 'node:path'

const SRC = process.env.CRATE_SOURCE || path.join(process.env.HOME, 'claude-metrics', 'training-data.json')
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'data')
const tracks = JSON.parse(fs.readFileSync(SRC, 'utf8'))

const slug = (value) =>
  String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : [])
const uniq = (values) => [...new Set(values.filter(Boolean))]
const avg = (values) => {
  const nums = values.filter((v) => Number.isFinite(v))
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0
}
const JUNK = /(unknown|untitled|test|smoke|knowone|dummy)/i
const clean = (track) =>
  track?.artist &&
  track?.album &&
  !JUNK.test(track.artist) &&
  !JUNK.test(track.album) &&
  !JUNK.test(track.title || '')

const yearOf = (track) => (Number.isFinite(Number(track.year)) ? Number(track.year) : null)
const ratingOf = (track) => (Number.isFinite(Number(track.rating)) ? Number(track.rating) : null)

const byAlbum = new Map()
const byArtist = new Map()

for (const track of tracks) {
  if (!clean(track)) continue
  const year = yearOf(track)
  const rating = ratingOf(track)
  const albumKey = `${track.artist}|||${track.album}`
  if (!byAlbum.has(albumKey)) {
    byAlbum.set(albumKey, {
      id: `${slug(track.artist)}--${slug(track.album)}`,
      artistId: slug(track.artist),
      artist: track.artist,
      album: track.album,
      year,
      label: track.label || null,
      rating,
      track: track.title || null,
      trackRating: rating,
      spotifyId: track.spotify_id || null,
      era: track.era || null,
      subgenres: uniq(list(track.subgenres)),
      notableQualities: uniq(list(track.notable_qualities)),
      notes: track.notes || null,
      favoriteMoments: track.favorite_moments || null,
      coverQuery: `${track.artist} ${track.album}`,
    })
  } else {
    const record = byAlbum.get(albumKey)
    if (rating != null && (record.rating == null || rating > record.rating)) {
      record.rating = rating
      record.track = track.title || record.track
      record.trackRating = rating
      record.spotifyId = track.spotify_id || record.spotifyId
    }
    record.subgenres = uniq([...record.subgenres, ...list(track.subgenres)])
    record.notableQualities = uniq([...record.notableQualities, ...list(track.notable_qualities)]).slice(0, 6)
    record.notes = record.notes || track.notes || null
    record.favoriteMoments = record.favoriteMoments || track.favorite_moments || null
  }

  if (!byArtist.has(track.artist)) {
    byArtist.set(track.artist, { name: track.artist, tracks: [], albums: new Map() })
  }
  const artist = byArtist.get(track.artist)
  artist.tracks.push(track)
  const album = artist.albums.get(track.album) || { album: track.album, year, rating: null }
  if (year) album.year = album.year || year
  if (rating != null && (album.rating == null || rating > album.rating)) album.rating = rating
  artist.albums.set(track.album, album)
}

const records = [...byAlbum.values()]
  .filter((record) => record.rating != null)
  .sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album))

const artists = [...byArtist.values()]
  .map(({ name, tracks: items, albums }) => {
    const years = items.map(yearOf).filter(Boolean)
    const ratings = items.map(ratingOf).filter((n) => n != null)
    const albumRows = [...albums.values()].filter((a) => a.rating != null)
    const favorite = albumRows.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null
    return {
      id: slug(name),
      name,
      albums: albumRows
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 8)
        .map((a) => ({ album: a.album, year: a.year, rating: a.rating })),
      albumCount: albumRows.length,
      tracksHeard: items.length,
      avgRating: avg(ratings),
      maxRating: ratings.length ? Math.max(...ratings) : null,
      favoriteAlbum: favorite?.album || null,
      years: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null,
      instruments: uniq(items.map((t) => t.primary_instrument)),
      keyPlayers: uniq(items.flatMap((t) => list(t.key_players))).slice(0, 10),
      notableQualities: uniq(items.flatMap((t) => list(t.notable_qualities))).slice(0, 8),
      notes: items.find((t) => t.notes)?.notes || null,
      favoriteMoments: items.find((t) => t.favorite_moments)?.favorite_moments || null,
      era: items.find((t) => t.era)?.era || null,
      imageQuery: name,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'vinyls.json'), JSON.stringify(records, null, 0))
fs.writeFileSync(path.join(OUT, 'artists.json'), JSON.stringify(artists, null, 0))
console.log(JSON.stringify({ records: records.length, artists: artists.length, out: OUT }))
