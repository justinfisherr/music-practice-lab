import { foundationById, loadFoundations } from '../data/foundations.js'

// A quiet bridge from a card or jam back to the foundation that teaches it.
// Nothing is blocked: the lesson is recommended, not required.
export default function FoundationLink({ id, label = 'LEARN THIS FIRST' }) {
  const lesson = foundationById(id)
  if (!lesson) return null
  const learned = loadFoundations().includes(id)

  return (
    <a className="foundationlink" href={`#lessons?foundation=${id}`}>
      <span className="foundationlink__label">
        {label} · {lesson.title}
      </span>
      <span className={`foundationlink__tag${learned ? ' is-learned' : ''}`}>
        {learned ? 'LEARNED' : 'OPEN'}
      </span>
    </a>
  )
}
