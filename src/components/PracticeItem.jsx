const STATUSES = ['New', 'Good', 'Mastered']

function formatLast(iso) {
  if (!iso) return 'NEVER'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'NEVER'
  const days = Math.floor((Date.now() - then) / 86400000)
  if (days <= 0) return 'TODAY'
  if (days === 1) return 'YESTERDAY'
  return `${days}D AGO`
}

export default function PracticeItem({ item, review, onSetStatus, onDelete }) {
  return (
    <li className={`item${review.needsFocus ? ' item--focus' : review.due ? ' item--due' : ''}`}>
      <div className="item__head">
        <span className="item__name">{item.name}</span>
        <span className={`badge${review.needsFocus ? ' badge--focus' : review.due ? ' badge--due' : ''}`}>
          {review.label}
        </span>
      </div>

      <div className="item__controls">
        <div className="statusgroup" role="group" aria-label={`Status for ${item.name}`}>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`statusbtn${item.status === s ? ' is-active' : ''}`}
              aria-pressed={item.status === s}
              onClick={() => onSetStatus(item.id, s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="item__delete"
          aria-label={`Delete ${item.name}`}
          onClick={() => onDelete(item.id)}
        >
          ✕
        </button>
      </div>

      <div className="item__meta">LAST: {formatLast(item.lastPracticed)}</div>
    </li>
  )
}
