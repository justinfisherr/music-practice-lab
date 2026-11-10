import { useEffect, useRef, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { useTouchInput } from '../hooks/useTouchInput.js'
import { isPhone } from '../session/device.js'
import { keyDisplay } from '../data/scales.js'
import Wheel from './Wheel.jsx'
import { HouseMark } from './House.jsx'
import { loadBonus } from '../session/wheel.js'
import { daysSinceEpoch, laDate, lastSevenRuns, seedFor, tonightKey } from '../session/tonight.js'
import { getRuns } from '../session/api.js'
import { getPlan } from '../session/plan.js'
import { RankLine, XpBand } from './Rank.jsx'
import { SKINS } from '../session/skin.js'
import { unlockAudio } from '../session/audio.js'
import * as store from '../session/store.js'

const MANUAL_FOCUS = ['FREE PLAY', 'LESSONS', 'DRILLS', 'LISTENING']

function runLabel(run) {
  if (run.kind === 'arcade') return `SEVENTH HOUSE · ${keyDisplay(run.keyId)}`
  if (run.scope === 'lesson') return 'LESSON'
  if (run.kind === 'manual') return run.focus || 'OPEN'
  return `${keyDisplay(run.keyId)} MAJOR`
}

export default function SessionTab({
  session,
  onStart,
  onStartSet,
  onStartManual,
  onResume,
  onReview,
  onOpenLedger,
  onOpenRun,
  onOpenWardrobe,
  onOpenArcade,
  rank,
  onTotalXp,
}) {
  const midi = useMidiContext()
  const { touch } = useTouchInput()
  // A phone (coarse pointer, no hover) opens SEVENTH HOUSE; every other device
  // keeps the graded set. Decided at click time, never at render.
  const phone = isPhone()
  const date = laDate()
  const tonight = tonightKey(date)
  const [variant, setVariant] = useState('tonight')
  const [bonusKey, setBonusKey] = useState(() => {
    const stored = loadBonus(date)
    return stored && stored !== tonight ? stored : null
  })
  const keyId = variant === 'bonus' && bonusKey ? bonusKey : tonight
  const seed = seedFor(date, keyId)
  const [runs, setRuns] = useState(() => store.loadCachedRuns())
  const [plan, setPlan] = useState(null)
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

  // The local fallback list renders immediately; the plan chip upgrades in
  // place if the LLM answers. Once START fires, late plans are ignored.
  useEffect(() => {
    let live = true
    setPlan(null)
    getPlan({ date, keyId, variant })
      .then((result) => {
        if (!live || startedRef.current) return
        setPlan(result)
      })
      .catch(() => {
        // Classic rollback keeps the local modules.
      })
    return () => {
      live = false
    }
  }, [date, keyId, variant])

  const week = lastSevenRuns(runs, date)
  const minutes = Math.round(week.reduce((sum, run) => sum + (run.durationMs || 0), 0) / 60000)
  const modules = week.reduce(
    (sum, run) =>
      sum + (run.kind === 'manual' || run.kind === 'arcade' ? 0 : run.moduleCount || 3),
    0,
  )
  const passed = week.reduce((sum, run) => sum + (run.passedStages || 0), 0)
  const passRate = modules ? Math.round((passed / modules) * 100) : 0
  const recent = runs.slice(0, 3)

  const manualActive = session?.kind === 'manual' && session.status === 'active'
  const sessionActive = session?.status === 'active'

  function startSession(planOverride = null, keyOverride = keyId, variantOverride = variant) {
    unlockAudio()
    startedRef.current = true
    onStart(planOverride, keyOverride, variantOverride)
  }

  function startSet(keyOverride = keyId) {
    unlockAudio()
    startedRef.current = true
    onStartSet(keyOverride)
  }

  let action
  let gradedResume = null
  if (phone) {
    // On a phone the primary action is always SEVENTH HOUSE. An in-progress
    // graded run is kept, but demoted to a secondary row below it.
    action = (
      <button
        type="button"
        className="btn btn--huge btn--signal"
        onClick={() => onOpenArcade(keyId)}
      >
        START SEVENTH HOUSE{variant === 'bonus' ? ` · ${keyDisplay(keyId)}` : ''}
      </button>
    )
    gradedResume =
      sessionActive && session?.kind !== 'manual' ? (
        <button
          type="button"
          className="btn btn--house-resume"
          onClick={() => {
            unlockAudio()
            onResume()
          }}
        >
          RESUME GRADED SESSION
        </button>
      ) : null
  } else if (manualActive) {
    action = null
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
  } else if (!midi.connected && !touch) {
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
  } else {
    action = (
      <button type="button" className="btn btn--huge btn--signal" onClick={() => startSet()}>
        START {variant === 'bonus' ? 'BONUS' : 'TODAY'}
      </button>
    )
  }

  return (
    <section className="session" aria-labelledby="tonight-title">
      <div className={`desk${phone ? ' desk--house' : ''}`}>
        <aside className="desk__wheel">
          <div className="tonight">
            <p className="tonight__kicker">TODAY · {date} · LOS ANGELES</p>
            <h2 className="tonight__key" id="tonight-title">
              {keyDisplay(keyId)} MAJOR
            </h2>
            <p className="tonight__meta">
              KEY {String((((daysSinceEpoch(date) % 12) + 12) % 12) + 1).padStart(2, '0')} OF 12 ·
              SEED {seed}
            </p>
          </div>

          {phone ? (
            <div className="desk__start">
              {action}
              {gradedResume}
            </div>
          ) : null}

          <Wheel
            date={date}
            tonightKey={tonight}
            activeKey={keyId}
            bonusKey={bonusKey}
            variant={variant}
            activeNotes={midi.activeNotes}
            onBonus={(key) => {
              setBonusKey(key)
              if (variant !== 'bonus') setVariant('bonus')
            }}
            onTonight={() => setVariant('tonight')}
            phone={phone}
            onStartBonus={(key) => {
              unlockAudio()
              startedRef.current = true
              if (phone) {
                onOpenArcade(key)
                return
              }
              startSession(
                variant === 'bonus' && plan?.source === 'llm' ? plan : null,
                key,
                'bonus',
              )
            }}
          />
        </aside>

        <div className="desk__main">
          <div className="mission">
            <div className="mission__top">
              <p className="planchip planchip--ready">
                {phone
                  ? `${variant === 'bonus' ? 'BONUS' : 'TONIGHT'} · SEVENTH HOUSE`
                  : `${variant === 'bonus' ? 'BONUS' : 'TODAY'} · THE SET`}
              </p>
              {phone ? <HouseMark size={20} /> : null}
            </div>

            {phone ? null : (
              <div className="whymodules">
                <span className="whymodules__label">WHY THE SET</span>
                <p className="whymodules__copy">
                  One warm-up, four rooms. Three homes on the keyboard, four notes by ear, six
                  seventh chords in order, then a progression that loops while you comp it. The bar
                  is the clock: a clean chord fills that bar and a bass note off the root pays extra.
                </p>
              </div>
            )}

            {phone ? (
              <ol className="houseplan" aria-label="Seventh House">
                <li className="houseplan__row">
                  <span className="houseplan__num">01</span>
                  <span>SEVEN CHORDS · BUILT FROM THE NAME</span>
                </li>
                <li className="houseplan__row">
                  <span className="houseplan__num">02</span>
                  <span>SINGLE NOTES BETWEEN</span>
                </li>
                <li className="houseplan__row">
                  <span className="houseplan__num">03</span>
                  <span>TWICE EACH · 14 CLEAR</span>
                </li>
              </ol>
            ) : (
              <ol className="stagepreview" aria-label="The set">
                <li className="stagepreview__row">
                  <span className="stagepreview__num">01</span>
                  <span>
                    <span className="stagepreview__type">WARM-UP</span>
                    <span className="stagepreview__title">
                      SCALE LAB · EAR · CHORDS · PROGRESSIONS
                    </span>
                    <span className="stagepreview__copy">
                      Three homes on one keyboard — major, relative minor, blues — then four notes
                      by ear, six seventh chords in order, and a progression that loops while the
                      bar keeps the clock. Finish whenever you like.
                    </span>
                  </span>
                  <span className="stagepreview__tag">T2 · SET</span>
                </li>
              </ol>
            )}

            <div className="mission__actions">
              {phone ? null : action}
              {!phone && !sessionActive && midi.supported && midi.connected ? (
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => startSession(plan?.source === 'llm' ? plan : null)}
                >
                  CLASSIC SESSION
                </button>
              ) : null}
              {session?.status && session.status !== 'active' ? (
                <button type="button" className="btn btn--ghost" onClick={onReview}>
                  REVIEW LAST SESSION
                </button>
              ) : null}
            </div>

            {!phone && touch ? (
              <p className="mission__gate">
                No keyboard needed. The pad plays every graded stage.
                <span className="mission__gate-sub">A keyboard is faster if you have one.</span>
                {midi.supported ? (
                  <button
                    type="button"
                    className="linkbtn mission__keyboard"
                    onClick={midi.connect}
                    disabled={midi.status === 'requesting'}
                  >
                    {midi.status === 'requesting' ? 'REQUESTING MIDI…' : 'USE A KEYBOARD INSTEAD'}
                  </button>
                ) : null}
              </p>
            ) : !phone && !midi.connected ? (
              <p className="mission__gate">
                No keyboard detected yet. Use the CONNECT control above, then start.
              </p>
            ) : null}

            {phone || touch ? (
              <p className="inputchip">INPUT · TOUCH</p>
            ) : midi.supported && midi.status === 'ready' ? (
              <div className="mission__midi">
                <label className="mission__midi-label" htmlFor="session-midi-input">
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
                <span
                  className={`dot ${midi.connected ? 'dot--on' : 'dot--off'}`}
                  aria-hidden="true"
                />
                <span className="mission__midi-status">
                  {midi.connected ? 'CONNECTED' : 'NO INPUT'}
                </span>
              </div>
            ) : null}

            {!sessionActive ? (
              <details className="manualstart">
                <summary className="manualstart__summary">OPEN SESSION · FOCUS</summary>
                <div className="manualstart__body">
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
              </details>
            ) : null}
          </div>
        </div>

        <aside className="desk__rail" aria-label="Practice rail">
          <div className="rail__rank">
            <RankLine rank={rank} />
            {rank ? <XpBand rank={rank} /> : null}
            <span className="rail__label rail__label--wardrobe">WARDROBE</span>
            <div className="rail__swatches">
              {SKINS.map((skin) => (
                <button
                  type="button"
                  className="rail__swatch"
                  key={skin.id}
                  data-skin={skin.id}
                  aria-label={`Open wardrobe · ${skin.label}`}
                  onClick={onOpenWardrobe}
                />
              ))}
            </div>
          </div>

          <div className="rail__block">
            <span className="rail__label">LAST 3 SESSIONS</span>
            {recent.length ? (
              <ul className="rail__runs">
                {recent.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      className="rail__run"
                      onClick={() => onOpenRun(run.id)}
                    >
                      <span className="rail__run-date">{run.date}</span>
                      <span className="rail__run-label">{runLabel(run)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rail__empty">NO RUNS YET.</p>
            )}
          </div>

          <div className="rail__block">
            <span className="rail__label">7 NIGHTS</span>
            <div className="rail__nums">
              <div className="rail__num">
                <span className="rail__num-value">{week.length}</span>
                <span className="rail__num-label">SESSIONS</span>
              </div>
              <div className="rail__num">
                <span className="rail__num-value">{minutes}</span>
                <span className="rail__num-label">MINUTES</span>
              </div>
              <div className="rail__num">
                <span className="rail__num-value">{passRate}%</span>
                <span className="rail__num-label">PASSED</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="queuebar">
        <span>{runs.length} SESSIONS IN THE LEDGER</span>
        <span className="queuebar__house">SEVENTH HOUSE IS A PHONE SESSION.</span>
        <button type="button" className="linkbtn" onClick={onOpenLedger}>
          OPEN LEDGER
        </button>
        <button type="button" className="linkbtn" onClick={() => onOpenArcade(keyId)}>
          SEVENTH HOUSE
        </button>
      </div>
    </section>
  )
}
