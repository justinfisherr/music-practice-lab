import { useEffect, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { keyById } from '../data/scales.js'
import { daysSinceEpoch, laDate, seedFor, tonightKey } from '../session/tonight.js'
import { getRuns } from '../session/api.js'
import { unlockAudio } from '../session/audio.js'
import * as store from '../session/store.js'

const PREVIEW = [
  {
    id: 'warmup',
    title: 'WARM-UP',
    copy: 'Hear the scale, play the seven diatonic triads, land the V chord.',
  },
  {
    id: 'ear',
    title: 'EAR CHECK',
    copy: 'Hear four notes. Play them back. Two misses and the hook opens.',
  },
  {
    id: 'hook',
    title: 'HOOK',
    copy: 'Six notes across two bars. Play it once, clean, and the night is logged.',
  },
]

function lastSeven(runs) {
  const today = daysSinceEpoch(laDate())
  return runs.filter((run) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date || '')) return false
    const age = today - daysSinceEpoch(run.date)
    return age >= 0 && age < 7
  })
}

export default function SessionTab({ session, onStart, onResume, onReview, onOpenLedger }) {
  const midi = useMidiContext()
  const date = laDate()
  const keyId = tonightKey(date)
  const key = keyById(keyId)
  const seed = seedFor(date, keyId)
  const [runs, setRuns] = useState(() => store.loadCachedRuns())

  useEffect(() => {
    let live = true
    getRuns({ limit: 100 })
      .then((body) => {
        if (!live || !Array.isArray(body.sessions)) return
        store.cacheRuns(body.sessions)
        setRuns(body.sessions)
      })
      .catch(() => {
        // Cached runs stay on screen when the ledger is unreachable.
      })
    return () => {
      live = false
    }
  }, [])

  const week = lastSeven(runs)
  const minutes = Math.round(week.reduce((sum, run) => sum + (run.durationMs || 0), 0) / 60000)
  const stages = week.length * 3
  const passed = week.reduce((sum, run) => sum + (run.passedStages || 0), 0)
  const passRate = stages ? Math.round((passed / stages) * 100) : 0

  let action
  if (!midi.supported) {
    action = null
  } else if (!midi.connected) {
    action = (
      <button type="button" className="btn btn--huge" disabled>
        CONNECT A KEYBOARD TO BEGIN
      </button>
    )
  } else if (session?.status === 'active') {
    action = (
      <button
        type="button"
        className="btn btn--huge btn--signal"
        onClick={() => {
          unlockAudio()
          onResume()
        }}
      >
        RESUME SESSION
      </button>
    )
  } else {
    action = (
      <button
        type="button"
        className="btn btn--huge btn--signal"
        onClick={() => {
          unlockAudio()
          onStart()
        }}
      >
        START TONIGHT
      </button>
    )
  }

  return (
    <section className="session" aria-labelledby="tonight-title">
      <div className="tonight">
        <p className="tonight__kicker">TONIGHT · {date} · LOS ANGELES</p>
        <h2 className="tonight__key" id="tonight-title">
          {key.label} MAJOR
        </h2>
        <p className="tonight__meta">
          KEY {String((((daysSinceEpoch(date) % 12) + 12) % 12) + 1).padStart(2, '0')} OF 12 · SEED{' '}
          {seed}
        </p>
        <div className="tonight__actions">
          {action}
          {session?.status && session.status !== 'active' ? (
            <button type="button" className="btn btn--ghost" onClick={onReview}>
              REVIEW LAST SESSION
            </button>
          ) : null}
        </div>

        {!midi.supported ? (
          <p className="tonight__gate">
            GRADED STAGES NEED A DESKTOP + MIDI KEYBOARD. On a phone the ledger is read-only.{' '}
            <button type="button" className="linkbtn" onClick={onOpenLedger}>
              OPEN THE LEDGER
            </button>
          </p>
        ) : !midi.connected ? (
          <p className="tonight__gate">
            No keyboard detected yet. Use the CONNECT control above, then start.
          </p>
        ) : null}
      </div>

      <ol className="stagepreview" aria-label="Session stages">
        {PREVIEW.map((stage, index) => (
          <li className="stagepreview__row" key={stage.id}>
            <span className="stagepreview__num">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <span className="stagepreview__title">{stage.title}</span>
              <span className="stagepreview__copy">{stage.copy}</span>
            </span>
            <span className="stagepreview__tag">
              {stage.id === 'warmup' ? '8 CHORDS' : stage.id === 'ear' ? '4 NOTES' : '6 NOTES'}
            </span>
          </li>
        ))}
      </ol>

      <div className="strip" aria-label="Last seven nights">
        <div className="strip__cell">
          <span className="strip__value">{week.length}</span>
          <span className="strip__label">SESSIONS · 7 NIGHTS</span>
        </div>
        <div className="strip__cell">
          <span className="strip__value">{minutes}</span>
          <span className="strip__label">MINUTES · 7 NIGHTS</span>
        </div>
        <div className="strip__cell">
          <span className="strip__value">{passRate}%</span>
          <span className="strip__label">STAGES PASSED</span>
        </div>
      </div>

      <div className="queuebar">
        <span>{runs.length} SESSIONS IN THE LEDGER</span>
        <button type="button" className="linkbtn" onClick={onOpenLedger}>
          OPEN LEDGER
        </button>
      </div>
    </section>
  )
}
