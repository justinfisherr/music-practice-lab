import { useEffect, useRef, useState } from 'react'
import { useChangesRound } from '../hooks/useChangesRound.js'
import { keyDisplay } from '../data/scales.js'
import { buildJamDegrees, chordLabel, PLAY_CHANGES } from '../session/set.js'
import FoundationLink from './FoundationLink.jsx'
import PointsPops, { usePointPops } from './PointsPops.jsx'

export default function JamStage({ session, stageId, onDone, disabled, recordAttempt }) {
  const keyId = session.keyId
  const detail = session.composition.stages.find((entry) => entry.id === 'jam')?.detail || {}
  const initialChangesId = PLAY_CHANGES.some((entry) => entry.id === detail.changesId)
    ? detail.changesId
    : 'turnaround'
  const initialBarsPerChord = [1, 2, 4].includes(detail.barsPerChord) ? detail.barsPerChord : 1
  const bpm = detail.bpm || 84
  const roundSeconds = detail.roundSeconds || 30

  const [changesId, setChangesId] = useState(initialChangesId)
  const [barsPerChord, setBarsPerChord] = useState(initialBarsPerChord)
  const attemptedRef = useRef(false)
  const { pops, pop } = usePointPops()
  const lastScoreRef = useRef(0)

  const changes = useChangesRound({
    keyId,
    changesId,
    barsPerChord,
    bpm,
    roundSeconds,
    onRoundEnd: () => {
      if (attemptedRef.current) return
      attemptedRef.current = true
      recordAttempt(stageId, false)
    },
  })

  // Points land at each change; the popup shows the delta.
  useEffect(() => {
    const score = changes.live.score || 0
    const delta = score - lastScoreRef.current
    lastScoreRef.current = score
    if (delta > 0) pop(delta)
  }, [changes.live.score, pop])

  useEffect(() => {
    if (!disabled) return
    if (changes.phase !== 'scoring' && changes.phase !== 'countin') return
    changes.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, changes.phase])

  function finishStage() {
    const result = changes.stop()
    if (!result) return
    if (!attemptedRef.current) {
      attemptedRef.current = true
      recordAttempt(stageId, (result.hits || 0) === 0)
    }
    onDone({ kind: 'jam', title: 'CHANGES', ...result, passed: (result.changes || 0) > 0 })
  }

  function skipStage() {
    changes.stop()
    onDone({
      kind: 'jam',
      title: 'CHANGES',
      passed: false,
      skipped: true,
      score: 0,
      best: 0,
      accuracy: 0,
      voiceLead: 0,
      notes: 0,
      hits: 0,
      changes: 0,
      bestCombo: 0,
      changesId,
      barsPerChord,
    })
  }

  const position = changes.position
  const chord = position ? chordLabel(keyId, position.degree) : '—'
  const changesName =
    PLAY_CHANGES.find((entry) => entry.id === (changes.round?.changesId || changesId))?.name ||
    'turnaround'
  const preview = buildJamDegrees(changesId, barsPerChord)
  const totalBars = preview.length
  const report = changes.round || changes.live

  return (
    <div className="stagecard jamstage">
      <div className="stagehead">
        <span className="stagehead__eyebrow">
          STAGE 2 OF 2 · {keyDisplay(keyId)} MAJOR · CHANGES
        </span>
        <h2 className="stagehead__title">CHANGES</h2>
        <p className="stagehead__copy">
          {changes.phase === 'idle'
            ? 'Thirty seconds of comping after the count-in. The chord at each change scores; close voicings pay a voice-leading bonus.'
            : changes.phase === 'practice'
              ? 'The round is in the books. The backing keeps looping so you can keep practicing.'
              : 'Comp the changes. The bell stops scoring at thirty seconds, not the music.'}
        </p>
      </div>

      {changes.phase === 'idle' ? (
        <>
          <div className="jamintrorule">
            <span className="jamintrorule__label">30-SECOND ROUND · {bpm} BPM</span>
            <label className="jamfield">
              <span className="jamfield__label">PROGRESSION</span>
              <select
                className="jamfield__select"
                value={changesId}
                onChange={(event) => setChangesId(event.target.value)}
                disabled={disabled}
              >
                {PLAY_CHANGES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="jamfield">
              <span className="jamfield__label">BARS PER CHORD</span>
              <div className="jamchips">
                {[1, 2, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`jamchip${barsPerChord === count ? ' is-on' : ''}`}
                    onClick={() => setBarsPerChord(count)}
                    aria-pressed={barsPerChord === count}
                    disabled={disabled}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <p className="jamintrorule__copy">
              {preview.map((degree) => chordLabel(keyId, degree)).join(' · ')} · {preview.length} BARS
            </p>
            <p className="jamintrorule__copy">
              Correct chord at the change is the base. Timing near the change and small voice
              movements add. Missed changes reset the combo.
            </p>
          </div>
          <div className="stagefoot">
            <button
              type="button"
              className="btn btn--signal"
              onClick={changes.start}
              disabled={disabled}
            >
              START 30-SECOND ROUND
            </button>
            <button type="button" className="btn btn--ghost" onClick={skipStage} disabled={disabled}>
              SKIP CHANGES
            </button>
          </div>
          <FoundationLink id="play-the-changes" />
        </>
      ) : null}

      {changes.phase === 'countin' ? (
        <p className="countin" aria-live="polite">
          GET READY · COUNT IN
        </p>
      ) : null}

      {changes.phase === 'scoring' && position ? (
        <>
          <div className="jambar">
            <span className="jambar__meta">
              {changesName.toUpperCase()} · BAR {position.bar + 1} OF {totalBars} · {changes.remaining}S LEFT
            </span>
            <span className="jambar__chord">{chord}</span>
            <span className="jambar__beat">
              BEAT {position.beat + 1} · {barsPerChord} BAR{barsPerChord === 1 ? '' : 'S'} PER CHORD
            </span>
          </div>

          <div className="jamchanges" aria-label="The changes">
            {preview.map((degree, index) => (
              <span
                key={`${index}-${degree}`}
                className={`jamchanges__bar${index === position.bar ? ' is-current' : ''}`}
              >
                {chordLabel(keyId, degree)}
              </span>
            ))}
          </div>

          <div className="rapid">
            <PointsPops pops={pops} />
            <div className="rapid__score">
              <span className="rapid__label">SCORE</span>
              <span className="rapid__value">{changes.live.score}</span>
            </div>
            <div className="rapid__combo">
              <span className="rapid__label">COMBO</span>
              <span className="rapid__value">×{changes.live.combo}</span>
            </div>
            <div className="rapid__count">
              <span className="rapid__label">ACCURACY</span>
              <span className="rapid__value">{changes.live.accuracy}%</span>
            </div>
          </div>

          <p className="jamflash is-live" aria-live="polite">
            SCORING · {changes.remaining} SECONDS
          </p>

          <div className="stagefoot">
            <button type="button" className="btn" onClick={finishStage}>
              STOP &amp; FINISH
            </button>
          </div>
          <p className="hintline">
            {changes.live.hits} OF {changes.live.changes} CHANGES · VOICE LEAD +{changes.live.voiceLead}
          </p>
        </>
      ) : null}

      {changes.phase === 'practice' ? (
        <>
          <div className="verdictline verdictline--ok">ROUND OVER · BACKING STILL PLAYING</div>
          <div className="rapid">
            <div className="rapid__score">
              <span className="rapid__label">SCORE</span>
              <span className="rapid__value">{report.score}</span>
            </div>
            <div className="rapid__combo">
              <span className="rapid__label">BEST</span>
              <span className="rapid__value">{report.best ?? report.score}</span>
            </div>
            <div className="rapid__count">
              <span className="rapid__label">ACCURACY</span>
              <span className="rapid__value">{report.accuracy}%</span>
            </div>
          </div>
          <div className="setreport">
            <div className="setreport__block">
              <span className="setreport__label">CHANGES REPORT</span>
              <div className="setreport__rows">
                <span>
                  VOICE LEAD · <strong>+{report.voiceLead}</strong>
                </span>
                <span>
                  CHANGES · <strong>{report.hits} OF {report.changes}</strong>
                </span>
                <span>
                  NOTES · <strong>{report.notes}</strong>
                </span>
              </div>
            </div>
          </div>
          {position ? (
            <p className="hintline">
              PRACTICE · {chord} · BAR {position.bar + 1} · THE ROUND IS NOT SCORING.
            </p>
          ) : null}
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={changes.runAgain}>
              RUN AGAIN · 30S
            </button>
            <button type="button" className="btn" onClick={finishStage}>
              STOP
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
