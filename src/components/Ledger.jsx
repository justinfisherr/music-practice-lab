import { useEffect, useState } from 'react'
import { MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import { getRuns } from '../session/api.js'
import { lastSevenRuns } from '../session/tonight.js'
import { changesStats, loadRounds } from '../session/changes.js'
import { PLAY_CHANGES } from '../session/set.js'
import * as store from '../session/store.js'
import { RankCard } from './Rank.jsx'
import Wardrobe from './Wardrobe.jsx'

function clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function rowLabel(run) {
  if (run.kind === 'arcade') return `SEVENTH HOUSE · ${keyDisplay(run.keyId)}`
  if (run.kind !== 'manual' && run.scope === 'lesson') {
    return run.moduleTypes?.length ? `LESSON · ${run.moduleTypes[0]}` : 'LESSON'
  }
  if (run.kind === 'manual') return run.focus || 'OPEN'
  return keyDisplay(run.keyId)
}

export default function Ledger({
  filterKey,
  onFilter,
  onOpen,
  onStartSession,
  syncState,
  onRetrySync,
  rank,
  onTotalXp,
  wardrobeOpen,
}) {
  const [runs, setRuns] = useState(() => store.loadCachedRuns())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showWardrobe, setShowWardrobe] = useState(!!wardrobeOpen)
  const [changes] = useState(() => changesStats(loadRounds()))

  useEffect(() => {
    if (wardrobeOpen) setShowWardrobe(true)
  }, [wardrobeOpen])

  useEffect(() => {
    let live = true
    getRuns({ limit: 100 })
      .then((body) => {
        if (!live) return
        if (Number.isFinite(body?.meta?.totalXp)) onTotalXp?.(body.meta.totalXp)
        const list = Array.isArray(body.sessions) ? body.sessions : []
        store.cacheRuns(list)
        setRuns(list)
        setError('')
      })
      .catch((err) => {
        if (live) setError(err.message || 'ledger unavailable')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [onTotalXp])

  const filtered = filterKey
    ? runs.filter((run) => run.kind !== 'manual' && run.keyId === filterKey)
    : runs
  const counts = new Map()
  for (const run of runs) {
    if (run.kind === 'manual') continue
    counts.set(run.keyId, (counts.get(run.keyId) || 0) + 1)
  }
  const maxCount = Math.max(1, ...counts.values())
  const presentKeys = MAJOR_KEYS.filter((key) => counts.has(key.id)).map((key) => key.id)

  const minutes = Math.round(filtered.reduce((sum, run) => sum + (run.durationMs || 0), 0) / 60000)
  const graded = filtered.filter((run) => run.kind !== 'manual')
  const stageTotal = graded.reduce(
    (sum, run) => sum + (run.kind === 'arcade' ? 0 : run.moduleCount || 3),
    0,
  )
  const passed = graded.reduce((sum, run) => sum + (run.passedStages || 0), 0)
  const misses = filtered.reduce((sum, run) => sum + (run.misses || 0), 0)
  const passRate = stageTotal ? Math.round((passed / stageTotal) * 100) : 0

  const week = lastSevenRuns(runs)
  const weekMinutes = Math.round(week.reduce((sum, run) => sum + (run.durationMs || 0), 0) / 60000)
  const weekGraded = week.filter((run) => run.kind !== 'manual')
  const weekModules = weekGraded.reduce(
    (sum, run) => sum + (run.kind === 'arcade' ? 0 : run.moduleCount || 3),
    0,
  )
  const weekPassed = weekGraded.reduce((sum, run) => sum + (run.passedStages || 0), 0)
  const weekRate = weekModules ? Math.round((weekPassed / weekModules) * 100) : 0

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="ledger__head">
        <h2 className="ledger__title" id="ledger-title">
          THE LEDGER
        </h2>
        <span className="ledger__meta">
          {runs.length} SESSION{runs.length === 1 ? '' : 'S'} ON RECORD
        </span>
      </div>

      <div className="ledger__grid">
        <div className="ledger__main">
          {syncState.pending > 0 || syncState.dead > 0 ? (
            <p className={`syncnote${syncState.dead ? ' syncnote--dead' : ' syncnote--queued'}`}>
              {syncState.pending > 0
                ? `${syncState.pending} RUN${syncState.pending === 1 ? '' : 'S'} WAITING TO SYNC.`
                : ''}{' '}
              {syncState.dead > 0
                ? `${syncState.dead} RUN${syncState.dead === 1 ? '' : 'S'} COULD NOT SYNC — KEPT ON THIS DEVICE.`
                : ''}
              {syncState.dead > 0 ? (
                <button type="button" className="linkbtn" onClick={onRetrySync}>
                  RETRY SYNC
                </button>
              ) : null}
            </p>
          ) : null}

          <div className="meters" aria-label="Ledger meters">
            <div className="meter">
              <span className="meter__value">{filtered.length}</span>
              <span className="meter__label">SESSIONS</span>
              <div className="meter__bar">
                <div
                  className="meter__fill"
                  style={{ width: `${Math.min(100, filtered.length * 4)}%` }}
                />
              </div>
            </div>
            <div className="meter">
              <span className="meter__value">{minutes}</span>
              <span className="meter__label">MINUTES</span>
              <div className="meter__bar">
                <div className="meter__fill" style={{ width: `${Math.min(100, minutes / 2)}%` }} />
              </div>
            </div>
            <div className="meter">
              <span className="meter__value">{passRate}%</span>
              <span className="meter__label">MODULES PASSED · {stageTotal}</span>
              <div className="meter__bar">
                <div className="meter__fill" style={{ width: `${passRate}%` }} />
              </div>
            </div>
            <div className="meter">
              <span className="meter__value">{misses}</span>
              <span className="meter__label">MISSES</span>
              <div className="meter__bar">
                <div className="meter__fill" style={{ width: `${Math.min(100, misses)}%` }} />
              </div>
            </div>
          </div>

          <div className="filterrow" role="group" aria-label="Filter by key">
            <button
              type="button"
              className={`chipbtn${!filterKey ? ' is-active' : ''}`}
              aria-pressed={!filterKey}
              onClick={() => onFilter(null)}
            >
              ALL KEYS
            </button>
            {presentKeys.map((keyId) => (
              <button
                type="button"
                className={`chipbtn${filterKey === keyId ? ' is-active' : ''}`}
                key={keyId}
                aria-pressed={filterKey === keyId}
                onClick={() => onFilter(filterKey === keyId ? null : keyId)}
              >
                {keyDisplay(keyId)} MAJOR
              </button>
            ))}
          </div>

          {error && runs.length > 0 ? (
            <p className="syncnote syncnote--queued">LEDGER OFFLINE — SHOWING CACHED RUNS.</p>
          ) : null}

          {loading && runs.length === 0 ? (
            <div className="emptyblock">READING THE LEDGER…</div>
          ) : filtered.length === 0 ? (
            <div className="emptyblock">
              {runs.length === 0 ? (
                error ? (
                  <>LEDGER OFFLINE — NO CACHED RUNS.</>
                ) : (
                  <>
                    NO SESSIONS YET.
                    <br />
                    <button type="button" className="linkbtn" onClick={onStartSession}>
                      START TODAY
                    </button>
                  </>
                )
              ) : (
                <>
                  NO RUNS IN {keyDisplay(filterKey)} MAJOR YET.
                  <br />
                  <button type="button" className="linkbtn" onClick={() => onFilter(null)}>
                    CLEAR FILTER
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="runlist">
              {filtered.map((run) => {
                const manual = run.kind === 'manual'
                return (
                  <button type="button" className="runrow" key={run.id} onClick={() => onOpen(run.id)}>
                    <span className="runrow__date">
                      {run.date} · {clock(run.durationMs)}
                    </span>
                    <span className="runrow__key">{rowLabel(run)}</span>
                    <span className="runrow__stats">
                      {manual
                        ? 'OPEN SESSION'
                        : run.kind === 'arcade'
                          ? `${run.attempts - run.misses}/14 CHORDS · ${run.accuracy ?? 0}%`
                          : `${run.attempts} ATTEMPTS · ${run.misses} MISSES · ${run.passedStages}/${run.moduleCount || 3} MODULES${
                              run.moduleTypes?.length ? ` · ${run.moduleTypes.join(' ')}` : ''
                            }`}
                    </span>
                    <span
                      className={`runrow__status${run.status === 'abandoned' ? ' is-abandoned' : ''}`}
                    >
                      {manual ? 'DONE' : run.status === 'abandoned' ? 'ENDED EARLY' : 'DONE'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {runs.length > 0 && !error ? (
            <div className="queuebar">
              <span>{filtered.length} SHOWN</span>
              <span>{syncState.syncing ? 'SYNCING…' : 'LIVE FROM practice.sessions'}</span>
            </div>
          ) : null}
        </div>

        <aside className="ledger__side" aria-label="Ledger summary">
          <RankCard rank={rank} onOpenWardrobe={() => setShowWardrobe((value) => !value)} />
          {showWardrobe ? <Wardrobe level={rank?.level ?? 1} /> : null}

          <div className="ledger__block">
            <span className="rail__label">KEYS · 4 × 3</span>
            <div className="heatgrid" aria-label="Sessions by key">
              {MAJOR_KEYS.map((key) => {
                const count = counts.get(key.id) || 0
                const level = count ? Math.min(4, Math.ceil((count / maxCount) * 4)) : 0
                const selected = filterKey === key.id
                return (
                  <button
                    type="button"
                    className={`heatcell heat--${level}${selected ? ' is-active' : ''}`}
                    key={key.id}
                    disabled={!count}
                    aria-pressed={selected}
                    aria-label={`${keyDisplay(key.id)} major, ${count} session${count === 1 ? '' : 's'}`}
                    onClick={() => onFilter(selected ? null : key.id)}
                  >
                    <span className="heatcell__key">{keyDisplay(key.id)}</span>
                    <span className="heatcell__count">
                      {count} RUN{count === 1 ? '' : 'S'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="ledger__block">
            <span className="rail__label">CHANGES</span>
            {changes.rounds ? (
              <>
                <div className="strip">
                  <div className="strip__cell">
                    <span className="strip__value">{changes.best}</span>
                    <span className="strip__label">BEST</span>
                  </div>
                  <div className="strip__cell">
                    <span className="strip__value">{changes.rounds}</span>
                    <span className="strip__label">ROUNDS</span>
                  </div>
                  <div className="strip__cell">
                    <span className="strip__value">{changes.average}</span>
                    <span className="strip__label">AVERAGE</span>
                  </div>
                </div>
                <div className="changesledger">
                  {changes.perProgression.slice(0, 5).map((round) => (
                    <span className="changesledger__row" key={`${round.keyId}-${round.changesId}-${round.barsPerChord}`}>
                      <span>
                        {keyDisplay(round.keyId)} ·{' '}
                        {PLAY_CHANGES.find((entry) => entry.id === round.changesId)?.name ||
                          round.changesId}
                      </span>
                      <strong>{round.score}</strong>
                    </span>
                  ))}
                  {changes.last.map((round) => (
                    <span className="changesledger__row changesledger__row--last" key={`${round.at}-${round.score}`}>
                      <span>{round.at ? new Date(round.at).toLocaleDateString() : '—'}</span>
                      <span>{round.accuracy}%</span>
                      <strong>{round.score}</strong>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="rail__empty">NO CHANGES ROUNDS YET.</p>
            )}
          </div>

          <div className="ledger__block">
            <span className="rail__label">7 DAYS</span>
            <div className="strip">
              <div className="strip__cell">
                <span className="strip__value">{week.length}</span>
                <span className="strip__label">SESSIONS</span>
              </div>
              <div className="strip__cell">
                <span className="strip__value">{weekMinutes}</span>
                <span className="strip__label">MINUTES</span>
              </div>
              <div className="strip__cell">
                <span className="strip__value">{weekRate}%</span>
                <span className="strip__label">PASSED</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
