import { useRef } from 'react'
import { keyDisplay } from '../data/scales.js'
import SetWarmup from './SetWarmup.jsx'

// THE SET is one stage: the Scale Lab warm-up runs lab → ear → chords →
// progressions and finishes the run itself.
export default function SetRun({ practice, onFinished, disabled }) {
  const { session, recordAttempt, recordDetail, advanceStage, finish } = practice
  const completingRef = useRef(false)
  const stages = session.composition?.stages || []
  const stage = stages[session.currentStage]

  function complete() {
    if (completingRef.current) return
    completingRef.current = true
    finish()
    onFinished()
  }

  function finishSet(detail) {
    recordDetail('warmup', detail)
    advanceStage(detail?.passed !== false)
    complete()
  }

  // A set queued by the two-stage build cannot be finished here.
  if (stages.some((entry) => entry.id === 'jam')) {
    return (
      <div className="emptyblock">THIS SET IS FROM AN OLDER BUILD. LEAVE AND START AGAIN.</div>
    )
  }

  return (
    <div className="run run--solo">
      <div className="run__main">
        <div className="setmeta">
          <span className="setmeta__key">{keyDisplay(session.keyId)} MAJOR</span>
          <span className="setmeta__copy">THE SET · SCALE LAB · EAR · CHORDS · PROGRESSIONS</span>
        </div>

        {stage?.id === 'warmup' ? (
          <SetWarmup
            key="warmup"
            session={session}
            recordAttempt={recordAttempt}
            disabled={disabled}
            onDone={finishSet}
          />
        ) : (
          <div className="emptyblock">SET DATA MISSING. LEAVE AND START AGAIN.</div>
        )}
      </div>
    </div>
  )
}
