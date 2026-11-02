import { useEffect, useState } from 'react'
import { keyById } from '../data/scales.js'
import { noteName } from '../data/diminishedChords.js'
import { getRun } from '../session/api.js'
import * as store from '../session/store.js'

const STAGE_LABELS = { warmup: 'WARM-UP', ear: 'EAR CHECK', hook: 'HOOK' }

function clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function LedgerDetail({ id, onBack }) {
  const [run, setRun] = useState(() => store.loadCachedRun(id))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setLoading(true)
    getRun(id)
      .then((body) => {
        if (!live) return
        const next = body.session || body
        store.cacheRun(next)
        setRun(next)
        setError('')
      })
      .catch((err) => {
        if (live) setError(err.message || 'run unavailable')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [id])

  if (!run) {
    return (
      <section className="detail">
        <button type="button" className="linkbtn" onClick={onBack}>
          BACK TO LEDGER
        </button>
        <div className="emptyblock">
          {loading ? 'READING THE RUN…' : 'RUN NOT FOUND IN THE LOCAL CACHE.'}
        </div>
      </section>
    )
  }

  const key = keyById(run.keyId)
  const manual = run.kind === 'manual'
  const payload = run.payload || {}
  const stages = run.stages || payload.stages || []
  const hook = payload.composition?.stages?.find((stage) => stage.id === 'hook')
  const attempts = run.attempts ?? stages.reduce((sum, stage) => sum + (stage.attempts || 0), 0)
  const misses = run.misses ?? stages.reduce((sum, stage) => sum + (stage.misses || 0), 0)
  const passed = run.passedStages ?? stages.filter((stage) => stage.passed).length

  return (
    <section className="detail" aria-labelledby="detail-title">
      <button type="button" className="linkbtn" onClick={onBack}>
        BACK TO LEDGER
      </button>

      <div className="detail__head">
        <span className="detail__kicker">
          {manual
            ? `${run.date} · ${run.focus || 'OPEN'}`
            : `${run.date} · ${run.status === 'abandoned' ? 'ENDED EARLY' : 'DONE'}`}
        </span>
        <h2 className="detail__title" id="detail-title">
          {manual ? 'OPEN SESSION' : `${key.label} MAJOR`}
        </h2>
        <p className="detail__meta">
          {manual
            ? `${clock(run.durationMs)} · ${run.focus || 'OPEN SESSION'} · +0 XP`
            : `${clock(run.durationMs)} · ${attempts} ATTEMPTS · ${misses} MISSES · ${passed}/3 STAGES · +${run.xp ?? 0} XP`}
        </p>
      </div>

      {error ? <p className="syncnote syncnote--queued">LEDGER OFFLINE — SHOWING THE LOCAL CACHE.</p> : null}

      {manual ? (
        <div className="emptyblock">
          OPEN SESSION · {run.focus || 'FREE PLAY'} · {clock(run.durationMs)}
        </div>
      ) : stages.length ? (
        <table className="summarytable">
          <thead>
            <tr>
              <th scope="col">STAGE</th>
              <th scope="col">ATTEMPTS</th>
              <th scope="col">MISSES</th>
              <th scope="col">RESULT</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.id}>
                <td>{STAGE_LABELS[stage.id] || stage.id}</td>
                <td>{stage.attempts ?? 0}</td>
                <td>{stage.misses ?? 0}</td>
                <td className={stage.passed ? 'is-pass' : 'is-fail'}>
                  {stage.passed ? 'PASS' : 'OPEN'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="emptyblock">STAGE DETAIL WAS NOT STORED FOR THIS RUN.</div>
      )}

      {hook ? (
        <div className="summary__head">
          <span className="summary__kicker">HOOK</span>
          <div className="scaleviz" aria-label="Hook notes">
            {hook.pcs.map((pc, index) => (
              <span className="scaleviz__note" key={`${pc}-${index}`}>
                {index + 1}. {noteName(pc)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="queuebar">
        <span>RUN {run.id}</span>
        <span>{manual ? 'OPEN SESSION' : `SEED ${run.seed}`}</span>
      </div>
    </section>
  )
}
