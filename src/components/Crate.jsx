import { useEffect, useMemo, useState } from 'react'
import { collection, loadCrate, openBox, rarityFor, unopened } from '../session/crate.js'
import { navigate } from '../session/route.js'
import { XpBand } from './Rank.jsx'
import ArtistCard from './ArtistCard.jsx'
import CrateRecord from './CrateRecord.jsx'
import CrateSleeve from './CrateSleeve.jsx'

const RARITIES = ['GRAIL', 'STAPLE', 'DEEP CUT']

function useDebounced(value, delay = 250) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return settled
}

function openRecord(record) {
  navigate(`crate/${encodeURIComponent(record.id)}`)
}

function CratePage({ rank }) {
  const [state, setState] = useState(() => loadCrate())
  const [reveal, setReveal] = useState(null)
  const [query, setQuery] = useState('')
  const [artist, setArtist] = useState('all')
  const [era, setEra] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const settled = useDebounced(query)
  const needle = settled.trim().toLowerCase()

  const rows = useMemo(() => collection(state), [state])
  const left = unopened(rank.level, state)
  const artists = []
  const eras = []
  const seenArtists = new Set()
  const seenEras = new Set()
  for (const row of rows) {
    if (row.artist && !seenArtists.has(row.artist.id)) {
      seenArtists.add(row.artist.id)
      artists.push(row.artist)
    }
    const rowEra = row.record?.era || row.artist?.era
    if (rowEra && !seenEras.has(rowEra)) {
      seenEras.add(rowEra)
      eras.push(rowEra)
    }
  }
  artists.sort((a, b) => a.name.localeCompare(b.name))
  eras.sort((a, b) => a.localeCompare(b))

  const filtered = rows.filter((row) => {
    const rowEra = row.record?.era || row.artist?.era
    if (artist !== 'all' && row.record?.artistId !== artist && row.artist?.id !== artist) {
      return false
    }
    if (era !== 'all' && rowEra !== era) return false
    if (rarity !== 'all' && row.rarity !== rarity) return false
    if (needle) {
      const haystack = `${row.record?.album || ''} ${row.record?.artist || ''} ${row.artist?.name || ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
  const filteredRecords = filtered.filter((row) => row.record)

  const cards = []
  const seenCards = new Set()
  for (const row of filtered) {
    if (!row.hasArtistCard || !row.artist || seenCards.has(row.artist.id)) continue
    seenCards.add(row.artist.id)
    cards.push(row)
  }

  const suggestions =
    needle && suggestOpen
      ? [...new Set(rows.flatMap((row) => [row.record?.album, row.record?.artist, row.artist?.name]))]
          .filter(Boolean)
          .filter((text) => text.toLowerCase().includes(needle))
          .slice(0, 6)
      : []

  function handleOpen() {
    const box = openBox(rank.level)
    if (!box) return
    setState(loadCrate())
    setQuery('')
    setArtist('all')
    setEra('all')
    setRarity('all')
    setReveal({ ...box, rarity: rarityFor(box.record ? box.record.rating : box.artist?.maxRating) })
  }

  function pickSuggestion(text) {
    setQuery(text)
    setSuggestOpen(false)
  }

  return (
    <section className="crate" aria-labelledby="crate-title">
      <div className="crate__head">
        <div>
          <h2 className="crate__title" id="crate-title">
            THE CRATE
          </h2>
          <p className="crate__intro">
            Every level drops one box: a record or an artist card.
          </p>
        </div>
        <div className="crate__rank">
          <span className="crate__lv">LV {rank.level}</span>
          <strong>{rank.title}</strong>
          <span>{rank.totalXp} XP</span>
        </div>
      </div>
      <XpBand rank={rank} />

      {reveal ? (
        <div className="cratereveal" aria-live="polite">
          <div className="cratereveal__head">
            <span className="cratereveal__kicker">BOX OPEN · LV {reveal.level}</span>
            <span className="cratereveal__kind">
              {reveal.kind === 'artist' ? 'ARTIST CARD' : 'RECORD'}
            </span>
            <span
              className={`rarity rarity--${reveal.rarity.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {reveal.rarity}
            </span>
          </div>
          <div className={`cratereveal__body${reveal.record && reveal.artist ? '' : ' is-single'}`}>
            {reveal.record ? (
              <div className="cratereveal__sleeve">
                <CrateSleeve record={reveal.record} size="reveal" onOpen={openRecord} />
              </div>
            ) : null}
            {reveal.artist ? (
              <ArtistCard artist={reveal.artist} rarity={reveal.rarity} level={reveal.level} />
            ) : null}
          </div>
          <div className="cratereveal__foot">
            <span className="cratereveal__next">
              {left > 0
                ? `${left} MORE BOX${left === 1 ? '' : 'ES'} WAITING`
                : 'THAT WAS THE LAST BOX'}
            </span>
            <button type="button" className="btn" onClick={() => setReveal(null)}>
              FILE IT
            </button>
          </div>
        </div>
      ) : (
        <div className={`cratebox${left > 0 ? '' : ' is-empty'}`}>
          <span className="cratebox__mark" aria-hidden="true">
            <span className="cratebox__lid" />
            <span className="cratebox__seam" />
          </span>
          <div className="cratebox__copy">
            <span className="cratebox__label">
              {left > 0 ? `${left} BOX${left === 1 ? '' : 'ES'} WAITING` : 'NO BOXES WAITING'}
            </span>
            <p>
              {left > 0
                ? 'A record or an artist card inside.'
                : 'Finish a session to earn the next box.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn--signal"
            disabled={left === 0}
            onClick={handleOpen}
          >
            OPEN LV {rank.level} BOX
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="emptyblock crate__empty">No records yet. Level up to earn a box.</div>
      ) : (
        <>
          <div className="crate__filters">
            <div className="crate__filter">
              <label className="crate__label" htmlFor="crate-search">
                SEARCH
              </label>
              <div className="crate__search">
                <input
                  id="crate-search"
                  className="crate__input"
                  type="search"
                  value={query}
                  placeholder="ALBUM OR ARTIST"
                  autoComplete="off"
                  aria-controls="crate-suggestions"
                  aria-expanded={suggestions.length > 0}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSuggestOpen(true)
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={() => setSuggestOpen(false)}
                />
                {suggestions.length > 0 ? (
                  <ul className="crate__suggest" id="crate-suggestions">
                    {suggestions.map((text) => (
                      <li key={text}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => pickSuggestion(text)}
                        >
                          {text}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="crate__filter">
              <label className="crate__label" htmlFor="crate-artist">
                ARTIST
              </label>
              <select
                id="crate-artist"
                className="select"
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
              >
                <option value="all">ALL ARTISTS</option>
                {artists.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="crate__filter">
              <label className="crate__label" htmlFor="crate-era">
                ERA
              </label>
              <select
                id="crate-era"
                className="select"
                value={era}
                onChange={(event) => setEra(event.target.value)}
              >
                <option value="all">ALL ERAS</option>
                {eras.map((name) => (
                  <option value={name} key={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filterrow" role="group" aria-label="Filter by rarity">
            <button
              type="button"
              className={`chipbtn${rarity === 'all' ? ' is-active' : ''}`}
              aria-pressed={rarity === 'all'}
              onClick={() => setRarity('all')}
            >
              ALL
            </button>
            {RARITIES.map((name) => (
              <button
                type="button"
                key={name}
                className={`chipbtn${rarity === name ? ' is-active' : ''}`}
                aria-pressed={rarity === name}
                onClick={() => setRarity(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="emptyblock crate__empty">
              NO RECORDS YET. LEVEL UP TO EARN A BOX.
            </div>
          ) : filtered.length === 0 ? (
            <div className="emptyblock crate__empty">
              NO RECORDS MATCH THESE FILTERS.
              <button
                type="button"
                className="linkbtn"
                onClick={() => {
                  setQuery('')
                  setArtist('all')
                  setEra('all')
                  setRarity('all')
                }}
              >
                CLEAR FILTERS
              </button>
            </div>
          ) : (
            <>
              <section className="shelf" aria-labelledby="shelf-records">
                <div className="shelf__head">
                  <h3 className="shelf__title" id="shelf-records">
                    RECORDS
                  </h3>
                  <span className="shelf__meta">
                    {filteredRecords.length} OF {rows.filter((row) => row.record).length}
                  </span>
                </div>
                <div className="shelf__records">
                  {filteredRecords.map((row) => (
                    <CrateSleeve
                      key={row.record.id}
                      record={row.record}
                      onOpen={openRecord}
                      size="shelf"
                    />
                  ))}
                </div>
              </section>

              <section className="shelf" aria-labelledby="shelf-artists">
                <div className="shelf__head">
                  <h3 className="shelf__title" id="shelf-artists">
                    ARTISTS
                  </h3>
                  <span className="shelf__meta">
                    {cards.length} OF {artists.length}
                  </span>
                </div>
                <div className="shelf__artists">
                  {cards.map((row) => (
                    <ArtistCard
                      key={row.artist.id}
                      artist={row.artist}
                      rarity={row.rarity}
                      level={row.level}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </section>
  )
}

export default function Crate({ rank, recordId }) {
  if (recordId) return <CrateRecord id={recordId} onBack={() => navigate('crate')} />
  return <CratePage rank={rank} />
}
