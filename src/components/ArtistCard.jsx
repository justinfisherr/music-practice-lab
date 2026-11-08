import { useEffect, useState } from 'react'
import { useArtistImage } from '../session/media.js'

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function rarityClass(rarity) {
  return `rarity--${String(rarity || 'DEEP CUT').toLowerCase().replace(/\s+/g, '-')}`
}

// Front is the portrait and the stamp; back is the career sheet. The whole card
// is one flip target, so keyboard and touch get the same affordance.
export default function ArtistCard({ artist, rarity = 'DEEP CUT', level = 1 }) {
  const [flipped, setFlipped] = useState(false)
  const [broken, setBroken] = useState(false)
  const media = useArtistImage(artist)

  useEffect(() => {
    setBroken(false)
  }, [media?.url])

  if (!artist) return null

  const toggle = () => setFlipped((value) => !value)
  const fact = artist.notableQualities?.[0] || artist.notes || null
  const albums = Array.isArray(artist.albums) ? artist.albums : []
  const players = Array.isArray(artist.keyPlayers) ? artist.keyPlayers : []

  return (
    <div
      className={`artistcard ${rarityClass(rarity)}${flipped ? ' is-flipped' : ''}`}
      data-flipped={flipped}
      onClick={toggle}
    >
      <div className="artistcard__inner">
        <div className="artistcard__face artistcard__front" aria-hidden={flipped}>
          <span className="artistcard__photo">
            {media?.url && !broken ? (
              <img
                src={media.url}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setBroken(true)}
              />
            ) : (
              <span className="artistcard__mono" aria-hidden="true">
                {initials(artist.name)}
              </span>
            )}
            <span className={`artistcard__stamp ${rarityClass(rarity)}`}>{rarity}</span>
          </span>
          <span className="artistcard__body">
            <span className="artistcard__collected">COLLECTED · LV {level}</span>
            <span className="artistcard__name">{artist.name}</span>
            <span className="artistcard__line">
              {artist.instruments?.length ? artist.instruments.join(' · ') : 'instrument unknown'}
            </span>
            <span className="artistcard__line">
              {artist.era || 'era unknown'}
              {artist.years ? ` · ${artist.years}` : ''}
            </span>
          </span>
          <button
            type="button"
            className="artistcard__hint artistcard__flip"
            tabIndex={flipped ? -1 : 0}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
          >
            FLIP TO CAREER
          </button>
        </div>

        <div className="artistcard__face artistcard__back" aria-hidden={!flipped}>
          <span className="artistcard__collected">COLLECTED · LV {level}</span>
          <span className="artistcard__name">{artist.name}</span>

          <section className="artistcard__sheet" aria-label="Your stats">
            <span className="artistcard__label">YOUR STATS</span>
            <dl className="artistcard__stats">
              <div>
                <dt>ALBUMS</dt>
                <dd>{artist.albumCount ?? '—'}</dd>
              </div>
              <div>
                <dt>TRACKS HEARD</dt>
                <dd>{artist.tracksHeard ?? '—'}</dd>
              </div>
              <div>
                <dt>AVG RATING</dt>
                <dd>{artist.avgRating ?? '—'}</dd>
              </div>
              <div>
                <dt>MAX RATING</dt>
                <dd>{artist.maxRating ?? '—'}</dd>
              </div>
              <div>
                <dt>YEARS</dt>
                <dd>{artist.years || '—'}</dd>
              </div>
              <div>
                <dt>FAVORITE</dt>
                <dd>{artist.favoriteAlbum || '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="artistcard__sheet" aria-label="Discography">
            <span className="artistcard__label">DISCOGRAPHY</span>
            {albums.length ? (
              <ol className="artistcard__albums">
                {albums.map((album) => (
                  <li key={`${album.album}-${album.year}`}>
                    <span className="artistcard__album">{album.album}</span>
                    <span className="artistcard__year">{album.year || '—'}</span>
                    <span className="artistcard__score">{album.rating ?? '—'}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="artistcard__copy">No albums on record.</p>
            )}
          </section>

          {players.length ? (
            <section className="artistcard__sheet" aria-label="Played with">
              <span className="artistcard__label">PLAYED WITH</span>
              <p className="artistcard__copy">{players.join(' · ')}</p>
            </section>
          ) : null}

          {fact || media?.extract ? (
            <section className="artistcard__sheet" aria-label="Did you know">
              <span className="artistcard__label">DID YOU KNOW</span>
              {fact ? <p className="artistcard__copy">{fact}</p> : null}
              {media?.extract ? <p className="artistcard__copy">{media.extract}</p> : null}
            </section>
          ) : null}

          <span className="artistcard__credit">
            {media?.page ? (
              <a
                href={media.page}
                target="_blank"
                rel="noreferrer"
                tabIndex={flipped ? 0 : -1}
                onClick={(event) => event.stopPropagation()}
              >
                WIKIPEDIA
              </a>
            ) : media?.url ? (
              'PHOTO · ITUNES'
            ) : (
              'NO PHOTO ON FILE'
            )}
          </span>
          <button
            type="button"
            className="artistcard__hint artistcard__flip"
            tabIndex={flipped ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
          >
            FLIP TO PORTRAIT
          </button>
        </div>
      </div>
    </div>
  )
}
