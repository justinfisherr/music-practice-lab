import { useEffect, useState } from 'react'
import { useChangesRound } from '../hooks/useChangesRound.js'
import { buildJamDegrees, chordLabel, PLAY_CHANGES, repeatDegrees } from '../session/set.js'
import { keyDisplay } from '../data/scales.js'

// FREE PLAY: the same 30-second changes round as the set. The backing loops
// after the bell for practice; the round records to the shared local store.
// A tune preset (`{id,name,degrees,chords,bpm}`) replaces the named progression:
// `chords` are the tune's literal bars (they win over degrees), and its id is
// the round's save bucket.
export default function JamPanel({
  keyId,
  preset = null,
  autoStartToken = 0,
  onPhaseChange,
  onClearTune,
}) {
  const [manualChangesId, setManualChangesId] = useState('turnaround')
  const [barsPerChord, setBarsPerChord] = useState(1)
  const [bpm, setBpm] = useState(84)

  const changesId = preset ? `tune:${preset.id}` : manualChangesId
  const degrees = preset ? repeatDegrees(preset.degrees, barsPerChord) : null
  const chords = preset?.chords ? repeatDegrees(preset.chords, barsPerChord) : null

  const changes = useChangesRound({
    keyId,
    changesId,
    barsPerChord,
    bpm,
    roundSeconds: 30,
    degrees,
    chords,
  })

  // A tune's tempo can sit outside the manual 70-100 window; the track meets it.
  const tempoFloor = Math.min(70, preset?.bpm ?? 70)
  const tempoCeil = Math.max(100, preset?.bpm ?? 100)

  useEffect(() => {
    if (preset?.bpm) setBpm(preset.bpm)
  }, [preset?.id, preset?.bpm])

  useEffect(() => {
    onPhaseChange?.(changes.phase)
  }, [changes.phase, onPhaseChange])

  const busy = changes.phase !== 'idle'

  // The token is the trigger: re-running on `busy` would start a round every
  // time one ended.
  useEffect(() => {
    if (autoStartToken && !busy) void changes.start()
  }, [autoStartToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const position = changes.position
  const chord = position ? position.label || chordLabel(keyId, position.degree) : '—'
  const changesName = preset
    ? preset.name
    : PLAY_CHANGES.find((entry) => entry.id === (changes.round?.changesId || changesId))?.name ||
      'turnaround'
  const preview = preset ? chords || degrees : buildJamDegrees(changesId, barsPerChord)
  const report = changes.round || changes.live

  return (
    <section className="jampanel" aria-labelledby="jampanel-title">
      <div className="jampanel__head">
        <h2 className="jampanel__title" id="jampanel-title">
          JAM
        </h2>
        <span className="jampanel__meta">FREE PLAY · 30-SECOND CHANGES</span>
      </div>

      <div className="jampanel__controls">
        {preset ? (
          <div className="jamfield">
            <span className="jamfield__label">PROGRESSION</span>
            <div className="jamfield__tune">
              <span className="jamfield__tunename">{preset.name}</span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClearTune}
                disabled={!onClearTune}
              >
                CLEAR TUNE
              </button>
            </div>
          </div>
        ) : (
          <label className="jamfield">
            <span className="jamfield__label">PROGRESSION</span>
            <select
              className="jamfield__select"
              value={manualChangesId}
              onChange={(event) => setManualChangesId(event.target.value)}
              disabled={busy}
            >
              {PLAY_CHANGES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="jamfield">
          <span className="jamfield__label">BARS PER CHORD</span>
          <div className="jamchips">
            {[1, 2, 4].map((count) => (
              <button
                key={count}
                type="button"
                className={`jamchip${barsPerChord === count ? ' is-on' : ''}`}
                aria-pressed={barsPerChord === count}
                onClick={() => setBarsPerChord(count)}
                disabled={busy}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <label className="jamfield jamfield--tempo">
          <span className="jamfield__label">TEMPO · {bpm} BPM</span>
          <input
            type="range"
            className="jamrange"
            min={tempoFloor}
            max={tempoCeil}
            step="1"
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            disabled={busy}
          />
        </label>
      </div>

      <div className="jampanel__stage" aria-live="polite">
        {changes.phase === 'scoring' && position ? (
          <div className="jampanel__live">
            <span className="jampanel__bar">
              {changesName.toUpperCase()} · BAR {position.bar + 1} OF {preview.length} ·{' '}
              {changes.remaining}S LEFT
            </span>
            <span className="jampanel__chord">{chord}</span>
            <span className="jampanel__note">
              SCORE {changes.live.score} · COMBO ×{changes.live.combo} · ACCURACY{' '}
              {changes.live.accuracy}% · {keyDisplay(keyId)} MAJOR
            </span>
          </div>
        ) : changes.phase === 'practice' ? (
          <div className="jampanel__live">
            <span className="jampanel__bar">ROUND OVER · BACKING STILL PLAYING</span>
            <span className="jampanel__chord">{report.score}</span>
            <span className="jampanel__note">
              BEST {report.best ?? report.score} · VOICE LEAD +{report.voiceLead} · ACCURACY{' '}
              {report.accuracy}% · {report.hits} OF {report.changes} CHANGES
            </span>
            <span className="jampanel__note">
              PRACTICE · {position ? `${chord} · BAR ${position.bar + 1}` : 'THE BACKING IS LOOPING'}
            </span>
          </div>
        ) : changes.phase === 'countin' ? (
          <span className="jampanel__countin">GET READY · COUNT IN</span>
        ) : (
          <span className="jampanel__note">
            THIRTY SECONDS OF COMPING AFTER THE COUNT-IN. PRACTICE CONTINUES AFTER THE BELL.
          </span>
        )}
      </div>

      <div className="jampanel__actions">
        {changes.phase === 'scoring' || changes.phase === 'countin' ? (
          <button type="button" className="btn" onClick={changes.stop}>
            STOP
          </button>
        ) : changes.phase === 'practice' ? (
          <>
            <button type="button" className="btn btn--signal" onClick={changes.runAgain}>
              RUN AGAIN · 30S
            </button>
            <button type="button" className="btn" onClick={changes.stop}>
              STOP
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--signal" onClick={changes.start}>
            START 30-SECOND ROUND
          </button>
        )}
      </div>
    </section>
  )
}
