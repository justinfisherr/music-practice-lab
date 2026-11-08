import { useEffect, useState } from 'react'
import { LESSONS, TIER_FILTERS, TIER_NAMES } from '../data/lessons.js'
import {
  FOUNDATIONS,
  foundationById,
  loadFoundations,
  markFoundation,
} from '../data/foundations.js'
import FoundationPlayer from './FoundationPlayer.jsx'

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Lessons({ type, foundation, onTry }) {
  const [tier, setTier] = useState('all')
  const [openId, setOpenId] = useState(() => (foundationById(foundation) ? foundation : null))
  const [learned, setLearned] = useState(() => loadFoundations())
  const cards = tier === 'all' ? LESSONS : LESSONS.filter((lesson) => lesson.tier === tier)

  useEffect(() => {
    if (!type) return
    const card = document.getElementById(`lesson-${type}`)
    card?.scrollIntoView({
      block: 'center',
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }, [type])

  // A foundation deep link opens that lesson and brings it into view.
  useEffect(() => {
    if (!foundationById(foundation)) return
    setOpenId(foundation)
    const timer = setTimeout(() => {
      document.getElementById(`foundation-${foundation}`)?.scrollIntoView({
        block: 'center',
        behavior: reducedMotion() ? 'auto' : 'smooth',
      })
    }, 40)
    return () => clearTimeout(timer)
  }, [foundation])

  function handleLearned(id) {
    setLearned((current) => {
      if (current.includes(id)) return current
      const stored = markFoundation(id)
      return stored.includes(id) ? stored : [...current, id]
    })
  }

  return (
    <div className="lessons">
      <section className="foundations" aria-labelledby="foundations-title">
        <div className="foundations__head">
          <div>
            <h2 className="foundations__title" id="foundations-title">
              FOUNDATIONS
            </h2>
            <p className="foundations__intro">
              The recommended on-ramp. Ten short lessons, in order. Learn the word, hear it, play
              it, then answer three checks.
            </p>
          </div>
          <span className="foundations__count">{FOUNDATIONS.length} LESSONS</span>
        </div>

        <div className="foundations__grid">
          {FOUNDATIONS.map((lesson) => {
            const isOpen = openId === lesson.id
            const isLearned = learned.includes(lesson.id)
            return (
              <article
                className={`foundation${isOpen ? ' is-open' : ''}${isLearned ? ' is-learned' : ''}`}
                id={`foundation-${lesson.id}`}
                key={lesson.id}
              >
                <button
                  type="button"
                  className="foundation__head"
                  aria-expanded={isOpen}
                  aria-controls={`foundation-body-${lesson.id}`}
                  onClick={() => setOpenId(isOpen ? null : lesson.id)}
                >
                  <span className="foundation__copy">
                    <span className="foundation__top">
                      <span className={`foundation__tag${isLearned ? ' is-learned' : ''}`}>
                        {isLearned ? 'LEARNED' : '2 MIN'}
                      </span>
                      <span className="foundation__num">{lesson.id.replaceAll('-', ' ')}</span>
                    </span>
                    <span className="foundation__title">{lesson.title}</span>
                    <span className="foundation__blurb">{lesson.blurb}</span>
                  </span>
                  <span className="foundation__cta">{isOpen ? 'CLOSE' : 'OPEN'}</span>
                </button>

                {isOpen ? (
                  <div className="foundation__body" id={`foundation-body-${lesson.id}`}>
                    <FoundationPlayer
                      key={lesson.id}
                      lesson={lesson}
                      learned={isLearned}
                      onLearned={handleLearned}
                    />
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="lessons__drills" aria-labelledby="drills-title">
        <div className="lessons__head">
          <h2 className="lessons__title" id="drills-title">
            DRILLS
          </h2>
          <p className="lessons__intro">
            Ten short cards. One idea and one task each. Try it in today&apos;s key. The
            foundations above are the on-ramp; nothing here is gated.
          </p>
        </div>

        <div
          className="filterrow lessons__filters"
          role="group"
          aria-label="Filter lessons by tier"
        >
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
                <button
                  type="button"
                  className="btn btn--signal"
                  onClick={() => onTry(lesson.type)}
                >
                  TRY IT
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
