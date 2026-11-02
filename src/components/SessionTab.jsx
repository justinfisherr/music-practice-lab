import { useEffect, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { keyDisplay } from '../data/scales.js'
import { composeModules } from '../data/modules.js'
import { nextKey } from '../session/wheel.js'
import Wheel from './Wheel.jsx'
import { daysSinceEpoch, laDate, seedFor, tonightKey } from '../session/tonight.js'
import { getRuns } from '../session/api.js'
import { getPlan } from '../session/plan.js'
import { RankLine } from './Rank.jsx'
import { unlockAudio } from '../session/audio.js'
import * as store from '../session/store.js'

const MANUAL_FOCUS = ['FREE PLAY', 'LESSONS', 'DRILLS', 'LISTENING']

function lastSeven(runs) {
  const today = daysSinceEpoch(laDate())
  return runs.filter((run) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date || '')) return false
    const age = today - daysSinceEpoch(run.date)
    return age >= 0 && age < 7
  })
}

function PlanChip({ state, plan, variant }) {
  const label = variant === 'bonus' ? 'BONUS' : 'TONIGHT'
  if (state === 'composing') {
    return <p className="planchip planchip--waiting">{label} · COMPOSING…</p>
  }
  if (state === 'composed' && plan?.source === 'llm') {
    return (
      <p className="planchip planchip--ready">
        {label} · COMPOSED
        {plan.rationale ? <span className="planchip__why">{plan.rationale}</span> : null}
      </p>
    )
  }
  return <p className="planchip">{label} · STANDARD</p>
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
  const tonight = tonightKey(date)
  const [selectedKey, setSelectedKey] = useState(tonight)
  const [variant, setVariant] = useState('tonight')
  const keyId = variant === 'bonus' ? nextKey(tonight) : selectedKey
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
    getPlan({ date, keyId, variant })
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
  }, [date, keyId, variant])

  const previewModules = plan?.modules?.length
    ? plan.modules
    : composeModules({ seed, keyId, variant })
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
          onStart(plan?.source === 'llm' ? plan : null, keyId, variant)
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
          {keyDisplay(keyId)} MAJOR
        </h2>
        <p className="tonight__meta">
          KEY {String((((daysSinceEpoch(date) % 12) + 12) % 12) + 1).padStart(2, '0')} OF 12 · SEED{' '}
          {seed}
        </p>
        <RankLine rank={rank} />
        <div className="variantchips" role="group" aria-label="Session variant">
          <button
            type="button"
            className={`chipbtn${variant === 'tonight' ? ' is-active' : ''}`}
            aria-pressed={variant === 'tonight'}
            onClick={() => {
              if (sessionActive) return
              setVariant('tonight')
              setSelectedKey(tonight)
              setPlanState('composing')
            }}
          >
            TONIGHT
          </button>
          <button
            type="button"
            className={`chipbtn${variant === 'bonus' ? ' is-active' : ''}`}
            aria-pressed={variant === 'bonus'}
            onClick={() => {
              if (sessionActive) return
              setVariant('bonus')
              setSelectedKey(nextKey(tonight))
              setPlanState('composing')
            }}
          >
            BONUS
          </button>
        </div>
        <PlanChip state={planState} plan={plan} variant={variant} />
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

      <div className="desk">
        <aside className="desk__wheel">
          <Wheel
            keyId={keyId}
            bonusKey={nextKey(keyId)}
            disabled={sessionActive}
            onSelect={(id) => {
              if (sessionActive) return
              setVariant('tonight')
              setSelectedKey(id)
              setPlanState('composing')
            }}
          />
        </aside>
        <div className="desk__main">
          <ol className="stagepreview" aria-label="Session modules">
        {previewModules.map((module, index) => (
          <li className="stagepreview__row" key={`${module.type}-${index}`}>
            <span className="stagepreview__num">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <span className="stagepreview__title">{module.title}</span>
              <span className="stagepreview__copy">{module.teach}</span>
            </span>
            <span className="stagepreview__tag">
              T{module.tier} · {module.estSec}S
            </span>
          </li>
            ))}
          </ol>
        </div>
      </div>

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
