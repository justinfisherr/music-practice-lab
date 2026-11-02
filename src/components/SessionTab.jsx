import { useEffect, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { keyById } from '../data/scales.js'
import { daysSinceEpoch, laDate, seedFor, tonightKey } from '../session/tonight.js'
import { getRuns } from '../session/api.js'
import { getPlan } from '../session/plan.js'
import { RankLine } from './Rank.jsx'
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

const MANUAL_FOCUS = ['FREE PLAY', 'LESSONS', 'DRILLS', 'LISTENING']

function lastSeven(runs) {
  const today = daysSinceEpoch(laDate())
  return runs.filter((run) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date || '')) return false
    const age = today - daysSinceEpoch(run.date)
    return age >= 0 && age < 7
  })
}

function PlanChip({ state, plan }) {
  if (state === 'composing') {
    return <p className="planchip planchip--waiting">TONIGHT · COMPOSING…</p>
  }
  if (state === 'composed' && plan?.source === 'llm') {
    return (
      <p className="planchip planchip--ready">
        TONIGHT · COMPOSED
        {plan.rationale ? <span className="planchip__why">{plan.rationale}</span> : null}
      </p>
    )
  }
  return <p className="planchip">TONIGHT · STANDARD</p>
}

export default function SessionTab({
  session,
  onStart,
  onStartManual,
  onResume,
  onReview,
  onOpenLedger,
  rank,
  onTotalXp,
}) {
  const midi = useMidiContext()
  const date = laDate()
  const keyId = tonightKey(date)
  const key = keyById(keyId)
  const seed = seedFor(date, keyId)
  const [runs, setRuns] = useState(() => store.loadCachedRuns())
  const [plan, setPlan] = useState(null)
  const [planState, setPlanState] = useState('composing')
  const [manualFocus, setManualFocus] = useState('FREE PLAY')
  const startedRef = useRef(false)

  // No auto-connect: requestMIDIAccess needs the click as its user gesture, and
  // an ungestured call can hang in 'requesting' and leave the button disabled.
  useEffect(() => {
    let live = true
    getRuns({ limit: 100 })
      .then((body) => {
        if (!live) return
        if (Number.isFinite(body?.meta?.totalXp)) onTotalXp?.(body.meta.totalXp)
        if (!Array.isArray(body.sessions)) return
        store.cacheRuns(body.sessions)
        setRuns(body.sessions)
      })
      .catch(() => {
        // Cached runs stay on screen when the ledger is unreachable.
      })
    return () => {
      live = false
    }
  }, [onTotalXp])

  useEffect(() => {
    let live = true
    getPlan({ date, keyId })
      .then((result) => {
        if (!live || startedRef.current) return
        setPlan(result)
        setPlanState(result?.source === 'llm' ? 'composed' : 'standard')
      })
      .catch(() => {
        if (live && !startedRef.current) setPlanState('standard')
      })
    return () => {
      live = false
    }
  }, [date, keyId])

  const week = lastSeven(runs)
  const minutes = Math.round(week.reduce((sum, run) => sum + (run.durationMs || 0), 0) / 60000)
  const stages = week.length * 3
  const passed = week.reduce((sum, run) => sum + (run.passedStages || 0), 0)
  const passRate = stages ? Math.round((passed / stages) * 100) : 0

  const manualActive = session?.kind === 'manual' && session.status === 'active'
  const sessionActive = session?.status === 'active'

  let action
  if (manualActive || !midi.supported) {
    action = null
  } else if (!midi.connected) {
    action = (
      <button
        type="button"
        className="btn btn--huge btn--signal"
        onClick={midi.connect}
        disabled={midi.status === 'requesting'}
      >
        {midi.status === 'requesting' ? 'REQUESTING MIDI…' : 'CONNECT MIDI KEYBOARD'}
      </button>
    )
  } else if (sessionActive) {
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
          startedRef.current = true
          onStart(plan?.source === 'llm' ? plan : null)
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
        <RankLine rank={rank} />
        <PlanChip state={planState} plan={plan} />
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

        {midi.supported && midi.status === 'ready' ? (
          <div className="tonight__midi">
            <label className="tonight__midi-label" htmlFor="session-midi-input">
              INPUT
            </label>
            <select
              id="session-midi-input"
              className="select"
              value={midi.selectedInputId || ''}
              onChange={(e) => midi.selectInput(e.target.value)}
            >
              {midi.inputs.length === 0 && <option value="">— none detected —</option>}
              {midi.inputs.map((input) => (
                <option key={input.id} value={input.id}>
                  {input.name}
                </option>
              ))}
            </select>
            <span className={`dot ${midi.connected ? 'dot--on' : 'dot--off'}`} aria-hidden="true" />
            <span className="tonight__midi-status">
              {midi.connected ? 'CONNECTED' : 'NO INPUT'}
            </span>
          </div>
        ) : null}

        {!sessionActive ? (
          <div className="manualstart">
            <p className="manualstart__label">OPEN SESSION · FOCUS</p>
            <div className="manualstart__chips" role="group" aria-label="Open session focus">
              {MANUAL_FOCUS.map((focus) => (
                <button
                  key={focus}
                  type="button"
                  className={`chipbtn${manualFocus === focus ? ' is-active' : ''}`}
                  aria-pressed={manualFocus === focus}
                  onClick={() => setManualFocus(focus)}
                >
                  {focus}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                unlockAudio()
                onStartManual(manualFocus)
              }}
            >
              START AN OPEN SESSION
            </button>
          </div>
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
