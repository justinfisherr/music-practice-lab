import { useRef, useState } from 'react'
import { keyDisplay } from '../data/scales.js'
import SetWarmup from './SetWarmup.jsx'
import SetCard from './SetCard.jsx'
import JamStage from './JamStage.jsx'

export default function SetRun({ practice, onFinished, disabled }) {
  const { session, recordAttempt, recordDetail, advanceStage, goToStage, finish } = practice
  const completingRef = useRef(false)
  const [reviewReturn, setReviewReturn] = useState(null)
  const stages = session.composition?.stages || []
  const current = session.currentStage
  const stage = stages[current]

  function openStage(index) {
    if (index === current) return
    setReviewReturn(current)
    goToStage(index)
  }

  function leaveReview() {
    if (reviewReturn == null) return
    const back = reviewReturn
    setReviewReturn(null)
    goToStage(back)
  }

  function finishCard(detail) {
    if (!stage) return
    if (reviewReturn != null) {
      leaveReview()
      return
    }
    recordDetail(stage.id, detail)
    advanceStage(detail.passed === true)
    if (current >= stages.length - 1) complete()
  }

  function finishJam(detail) {
    if (!stage) return
    if (reviewReturn != null) {
      leaveReview()
      return
    }
    recordDetail('jam', detail)
    advanceStage(detail?.passed !== false)
    complete()
  }

  function complete() {
    if (completingRef.current) return
    completingRef.current = true
    finish()
    onFinished()
  }

  return (
    <div className="run">
      <aside className="runrail" aria-label="The set">
        <span className="runrail__label">THE SET</span>
        <ol className="runrail__list">
          {stages.map((entry, index) => {
            const live = index === current
            const passed = session.stages[index]?.passed === true
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`runrail__item${live ? ' is-current' : ''}${passed ? ' is-passed' : ''}`}
                  aria-current={live ? 'step' : undefined}
                  onClick={() => openStage(index)}
                  disabled={live}
                >
                  <span className="runrail__num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="runrail__body">
                    <span className="runrail__type">
                      {entry.id === 'jam' ? 'CHANGES' : entry.id.replaceAll('_', ' ').toUpperCase()}
                    </span>
                    <span className="runrail__title">{entry.title}</span>
                    <span className="runrail__teach">
                      {entry.id === 'warmup'
                        ? 'SCALE LAB · EAR · CHORDS · TURNAROUND'
                        : entry.id === 'jam'
                          ? '30 SECONDS · PLAY THE CHANGES'
                          : entry.detail?.howTo || 'TAUGHT CARD'}
                    </span>
                  </span>
                  <span className="runrail__status">
                    {live ? 'UP NOW' : passed ? 'REPLAY' : 'OPEN'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </aside>

      <div className="run__main">
        <div className="setmeta">
          <span className="setmeta__key">{keyDisplay(session.keyId)} MAJOR</span>
          <span className="setmeta__copy">
            {reviewReturn != null ? 'REPLAYING A PASSED PART' : 'THE SET · SCALE LAB · 30-SECOND CHANGES'}
          </span>
          {reviewReturn != null ? (
            <button type="button" className="linkbtn" onClick={leaveReview}>
              BACK TO THE SET
            </button>
          ) : null}
        </div>

        {stage?.id === 'warmup' ? (
          <SetWarmup
            key="warmup"
            session={session}
            recordAttempt={recordAttempt}
            disabled={disabled}
            onDone={(detail) => {
              if (reviewReturn != null) {
                leaveReview()
                return
              }
              recordDetail('warmup', detail)
              advanceStage(true)
            }}
          />
        ) : stage?.id === 'jam' ? (
          <JamStage
            key="jam"
            session={session}
            stageId="jam"
            recordAttempt={recordAttempt}
            disabled={disabled}
            onDone={finishJam}
          />
        ) : stage ? (
          <SetCard
            key={stage.id}
            session={session}
            stageId={stage.id}
            recordAttempt={recordAttempt}
            disabled={disabled}
            onDone={finishCard}
          />
        ) : (
          <div className="emptyblock">SET DATA MISSING. LEAVE AND START AGAIN.</div>
        )}
      </div>
    </div>
  )
}
