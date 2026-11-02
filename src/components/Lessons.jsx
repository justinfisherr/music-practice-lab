import { useEffect, useState } from 'react'
import { LESSONS, TIER_FILTERS, TIER_NAMES } from '../data/lessons.js'

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Lessons({ type, onTry }) {
  const [tier, setTier] = useState('all')
  const cards = tier === 'all' ? LESSONS : LESSONS.filter((lesson) => lesson.tier === tier)

  useEffect(() => {
    if (!type) return
    const card = document.getElementById(`lesson-${type}`)
    card?.scrollIntoView({
      block: 'center',
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }, [type])

  return (
    <section className="lessons" aria-labelledby="lessons-title">
      <div className="lessons__head">
        <h2 className="lessons__title" id="lessons-title">
          LESSONS
        </h2>
        <p className="lessons__intro">
          Ten short cards. One idea and one task each. Try it in tonight&apos;s key.
        </p>
      </div>

      <div className="filterrow lessons__filters" role="group" aria-label="Filter lessons by tier">
        {TIER_FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={`chipbtn${tier === filter.id ? ' is-active' : ''}`}
            aria-pressed={tier === filter.id}
            onClick={() => setTier(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="lessons__grid">
        {cards.map((lesson) => (
          <article
            className={`lesson${type === lesson.type ? ' is-anchored' : ''}`}
            id={`lesson-${lesson.type}`}
            key={lesson.type}
          >
            <div className="lesson__top">
              <span className="lesson__tier">
                TIER {lesson.tier} · {TIER_NAMES[lesson.tier]}
              </span>
              <span className="lesson__meta">{lesson.meta}</span>
            </div>
            <h3 className="lesson__title">{lesson.title}</h3>
            <p className="lesson__copy">{lesson.lesson}</p>
            <div className="lesson__foot">
              <span className="lesson__est">{lesson.estSec}S</span>
              <button type="button" className="btn btn--signal" onClick={() => onTry(lesson.type)}>
                TRY IT
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
