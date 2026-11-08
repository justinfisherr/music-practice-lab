import { artistFor, rarityFor, recordById } from '../session/crate.js'
import CrateSleeve from './CrateSleeve.jsx'

export default function CrateRecord({ id, onBack }) {
  const record = recordById(id)
  if (!record) {
    return (
      <section className="detail">
        <button type="button" className="linkbtn cratedetail__back" onClick={onBack}>
          BACK TO CRATE
        </button>
        <div className="emptyblock crate__empty">THAT SLEEVE IS NOT IN THIS CRATE.</div>
      </section>
    )
  }

  const artist = artistFor(record)
  const rarity = rarityFor(record.rating)
  const spotify = record.spotifyId
    ? `https://open.spotify.com/track/${encodeURIComponent(record.spotifyId)}`
    : null

  return (
    <section className="detail cratedetail" aria-labelledby="cratedetail-title">
      <button type="button" className="linkbtn cratedetail__back" onClick={onBack}>
        BACK TO CRATE
      </button>

      <div className="cratedetail__head">
        <CrateSleeve record={record} size="detail" />
        <div className="cratedetail__copy">
          <div className="cratedetail__stamprow">
            <span className={`rarity rarity--${rarity.toLowerCase().replace(/\s+/g, '-')}`}>
              {rarity}
            </span>
            <span className="cratedetail__era">{record.era || 'era unknown'}</span>
          </div>
          <h2 className="cratedetail__title" id="cratedetail-title">
            {record.album}
          </h2>
          <p className="cratedetail__artist">{record.artist}</p>
          <p className="cratedetail__meta">
            {[record.year || 'undated', record.label || 'label unknown'].join(' · ')}
          </p>

          <dl className="cratedetail__scores">
            <div>
              <dt>YOUR RATING</dt>
              <dd>{record.rating != null ? `${record.rating}/10` : '—'}</dd>
            </div>
            <div>
              <dt>TRACK YOU RATED</dt>
              <dd>{record.track || '—'}</dd>
            </div>
            <div>
              <dt>TRACK RATING</dt>
              <dd>{record.trackRating != null ? `${record.trackRating}/10` : '—'}</dd>
            </div>
          </dl>

          {spotify ? (
            <a className="btn cratedetail__spotify" href={spotify} target="_blank" rel="noreferrer">
              OPEN ON SPOTIFY
            </a>
          ) : (
            <span className="cratedetail__none">NO SPOTIFY TRACK ON FILE.</span>
          )}

          {record.subgenres?.length ? (
            <div className="cratedetail__tags" aria-label="Subgenres">
              {record.subgenres.map((tag) => (
                <span className="chipbtn cratedetail__tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {record.notes ? (
        <section className="cratedetail__sheet" aria-label="Your notes">
          <span className="cratedetail__label">YOUR NOTES</span>
          <p>{record.notes}</p>
        </section>
      ) : null}

      {record.favoriteMoments ? (
        <section className="cratedetail__sheet" aria-label="Favorite moments">
          <span className="cratedetail__label">FAVORITE MOMENTS</span>
          <p>{record.favoriteMoments}</p>
        </section>
      ) : null}

      {record.notableQualities?.length ? (
        <section className="cratedetail__sheet" aria-label="Why it is here">
          <span className="cratedetail__label">WHY IT IS HERE</span>
          <p>{record.notableQualities[0]}</p>
        </section>
      ) : null}

      <div className="cratedetail__foot">
        <span>{artist ? `ARTIST · ${artist.name}` : 'ARTIST UNKNOWN'}</span>
        <span>FILED IN THE CRATE</span>
      </div>
    </section>
  )
}
