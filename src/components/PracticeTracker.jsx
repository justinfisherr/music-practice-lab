import { useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import PracticeItem from './PracticeItem.jsx'

const DAY = 86400000

// Days until the next review, per status.
const INTERVALS = { New: 1, Good: 3, Mastered: 7 }

const SEED_NAMES = [
  'ii–V–I',
  'ii–V–i minor',
  'Turnaround',
  'Intervals',
  'Up and down C ii–V–I',
  'Diminished 7th chords',
]

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Seed items start due immediately so you see what to practice on first open.
function seedItems() {
  const now = new Date().toISOString()
  return SEED_NAMES.map((name) => ({
    id: newId(),
    name,
    status: 'New',
    lastPracticed: null,
    nextReview: now,
  }))
}

// Pure: derive due-ness / focus label from an item at the current time.
function deriveReview(item, now) {
  const next = item.nextReview ? Date.parse(item.nextReview) : now
  const diff = next - now
  const due = diff <= 0
  const daysOverdue = Math.floor(-diff / DAY)
  const needsFocus = due && daysOverdue >= 1

  let label
  if (!due) {
    const daysLeft = Math.max(1, Math.ceil(diff / DAY))
    label = `DUE IN ${daysLeft}D`
  } else if (daysOverdue >= 1) {
    label = `NEEDS FOCUS · ${daysOverdue}D LATE`
  } else {
    label = 'DUE NOW'
  }
  return { due, needsFocus, label, sortKey: next }
}

export default function PracticeTracker() {
  const [items, setItems] = useLocalStorage('mpl.practice.items', seedItems)
  const [draft, setDraft] = useState('')

  const now = Date.now()

  // Sorting by nextReview ascending floats the most-overdue items to the top,
  // then due-now, then whatever's scheduled soonest.
  const rows = useMemo(() => {
    return items
      .map((item) => ({ item, review: deriveReview(item, now) }))
      .sort((a, b) => a.review.sortKey - b.review.sortKey)
  }, [items, now])

  const dueCount = rows.filter((r) => r.review.due).length

  function setStatus(id, status) {
    const stamp = Date.now()
    const nextReview = new Date(stamp + INTERVALS[status] * DAY).toISOString()
    const lastPracticed = new Date(stamp).toISOString()
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status, lastPracticed, nextReview } : it)),
    )
  }

  function addItem(e) {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    setItems((prev) => [
      ...prev,
      { id: newId(), name, status: 'New', lastPracticed: null, nextReview: new Date().toISOString() },
    ])
    setDraft('')
  }

  function deleteItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  return (
    <section className="tracker">
      <div className="tracker__bar">
        <span className="tracker__count">
          {dueCount} / {items.length} DUE
        </span>
      </div>

      <form className="addbar" onSubmit={addItem}>
        <input
          className="addbar__input"
          type="text"
          value={draft}
          placeholder="NEW EXERCISE…"
          aria-label="New exercise name"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn--add">
          ADD
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="empty">NO EXERCISES. ADD ONE ABOVE.</p>
      ) : (
        <ul className="itemlist">
          {rows.map(({ item, review }) => (
            <PracticeItem
              key={item.id}
              item={item}
              review={review}
              onSetStatus={setStatus}
              onDelete={deleteItem}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
