import { useState } from 'react'
import { useChangesRound } from '../hooks/useChangesRound.js'
import { buildJamDegrees, chordLabel, PLAY_CHANGES } from '../session/set.js'
import { keyDisplay } from '../data/scales.js'

// FREE PLAY: the same 30-second changes round as the set. The backing loops
// after the bell for practice; the round records to the shared local store.
export default function JamPanel({ keyId }) {
  const [changesId, setChangesId] = useState('turnaround')
  const [barsPerChord, setBarsPerChord] = useState(1)
  const [bpm, setBpm] = useState(84)

  const changes = useChangesRound({
    keyId,
    changesId,
    barsPerChord,
    bpm,
    roundSeconds: 30,
  })

  const busy = changes.phase !== 'idle'
  const position = changes.position
  const chord = position ? chordLabel(keyId, position.degree) : '—'
  const changesName =
    PLAY_CHANGES.find((entry) => entry.id === (changes.round?.changesId || changesId))?.name ||
    'turnaround'
  const preview = buildJamDegrees(changesId, barsPerChord)
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
        <label className="jamfield">
          <span className="jamfield__label">PROGRESSION</span>
          <select
            className="jamfield__select"
            value={changesId}
            onChange={(event) => setChangesId(event.target.value)}
            disabled={busy}
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
            min="70"
            max="100"
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
