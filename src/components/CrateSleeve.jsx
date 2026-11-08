import { useEffect, useState } from 'react'
import { useCover } from '../session/media.js'

// A paper sleeve with a hard frame and the record's one shine. When the cover
// lookup misses, the album title is set into the card stock instead.
export default function CrateSleeve({ record, onOpen, size = 'shelf' }) {
  const url = useCover(record)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [url])

  if (!record) return null

  const body = (
    <>
      <span className="sleeve__frame">
        {url && !broken ? (
          <img
            className="sleeve__art"
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="sleeve__blank">{record.album}</span>
        )}
        <span className="sleeve__ring" aria-hidden="true" />
      </span>
      <span className="sleeve__caption">
        <span className="sleeve__album">{record.album}</span>
        <span className="sleeve__artist">
          {record.artist} · {record.year || 'undated'}
        </span>
      </span>
    </>
  )

  const className = `sleeve sleeve--${size}`
  if (!onOpen) {
    return <div className={className}>{body}</div>
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpen(record)}
      aria-label={`Open ${record.album} by ${record.artist}`}
    >
      {body}
    </button>
  )
}
