import { useEffect, useState } from 'react'
import { diatonicSevenths, keyDisplay } from '../data/scales.js'
import { noteName } from '../data/diminishedChords.js'
import { deleteRun, getRun } from '../session/api.js'
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
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function remove() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteRun(id)
      store.removeCachedRun(id)
      onBack()
    } catch (err) {
      setDeleteError(err.message || 'delete failed')
      setDeleting(false)
    }
  }

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

  const manual = run.kind === 'manual'
  const arcade = run.kind === 'arcade'
  const payload = run.payload || {}
  const lesson = payload.scope === 'lesson'
  const v3 = payload.version === 3 || payload.composition?.version === 3
  const stages = run.stages || payload.stages || []
  const modules = payload.composition?.modules || []
  const lessonModule = lesson ? modules[0] : null
  const hook = v3 ? null : payload.composition?.stages?.find((stage) => stage.id === 'hook')
  const attempts = run.attempts ?? stages.reduce((sum, stage) => sum + (stage.attempts || 0), 0)
  const misses = run.misses ?? stages.reduce((sum, stage) => sum + (stage.misses || 0), 0)
  const passed = run.passedStages ?? stages.filter((stage) => stage.passed).length
  const moduleCount = run.moduleCount ?? payload.moduleCount ?? (v3 ? stages.length : 3)
  const cleared = payload.cleared ?? Math.max(0, attempts - misses)
  const accuracy = run.accuracy ?? payload.accuracy ?? 0
  const seventhRows = arcade
    ? diatonicSevenths(run.keyId).map((chord) => ({
        name: chord.name,
        numeral: chord.numeral,
        correct: payload.chords?.[chord.degree]?.correct ?? 0,
        missed: payload.chords?.[chord.degree]?.missed ?? 0,
      }))
    : []

  return (
    <section className="detail" aria-labelledby="detail-title">
      <button type="button" className="linkbtn" onClick={onBack}>
        BACK TO LEDGER
      </button>

      <div className="detail__head">
        <span className="detail__kicker">
          {manual
            ? `${run.date} · ${run.focus || 'OPEN'}`
            : arcade
              ? `${run.date} · SEVENTH HOUSE`
              : lesson
                ? `${run.date} · LESSON`
                : `${run.date} · ${run.status === 'abandoned' ? 'ENDED EARLY' : 'DONE'}`}
        </span>
        <h2 className="detail__title" id="detail-title">
          {manual
            ? 'OPEN SESSION'
            : arcade
              ? `${keyDisplay(run.keyId)} MAJOR`
              : lesson
                ? lessonModule?.title || 'LESSON'
                : `${keyDisplay(run.keyId)} MAJOR`}
        </h2>
        <p className="detail__meta">
          {manual
            ? `${clock(run.durationMs)} · ${payload.scope || 'open'} · +0 XP`
            : arcade
              ? `${clock(run.durationMs)} · ${cleared}/14 CHORDS · ${accuracy}% · +${run.xp ?? 0} XP`
              : `${clock(run.durationMs)} · ${attempts} ATTEMPTS · ${misses} MISSES · ${passed}/${moduleCount} MODULES · +${run.xp ?? 0} XP`}
        </p>
      </div>

      {error ? <p className="syncnote syncnote--queued">LEDGER OFFLINE — SHOWING THE LOCAL CACHE.</p> : null}

      {manual ? (
        <div className="emptyblock">
          OPEN SESSION · {run.focus || 'FREE PLAY'} · {clock(run.durationMs)}
        </div>
      ) : arcade ? (
        <>
          <table className="house__table">
            <thead>
              <tr>
                <th scope="col">CHORD</th>
                <th scope="col">NUM</th>
                <th scope="col">HITS / 2</th>
                <th scope="col">MISSED</th>
              </tr>
            </thead>
            <tbody>
              {seventhRows.map((row) => (
                <tr key={row.numeral + row.name}>
                  <td>{row.name}</td>
                  <td>{row.numeral}</td>
                  <td className={row.correct < 2 ? 'is-back' : undefined}>{row.correct}</td>
                  <td className={row.missed > 0 ? 'is-back' : undefined}>{row.missed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="house__outcome">
            {run.status === 'abandoned' ? 'ENDED EARLY' : 'RUN COMPLETE'}
          </p>
        </>
      ) : (
        <>
          {v3 && modules.length ? (
            <ol className="stagepreview" aria-label="Session modules">
              {modules.map((module, index) => (
                <li className="stagepreview__row" key={`${module.type}-${index}`}>
                  <span className="stagepreview__num">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="stagepreview__type">{module.type}</span>
                    <span className="stagepreview__title">{module.title}</span>
                    <span className="stagepreview__copy">{module.teach}</span>
                  </span>
                  <span className="stagepreview__tag">
                    T{module.tier} · {module.grading === 'set' ? 'SET' : 'ORDERED'} · {module.estSec}S
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {stages.length ? (
            <table className="summarytable">
              <thead>
                <tr>
                  <th scope="col">{v3 ? 'MODULE' : 'STAGE'}</th>
                  <th scope="col">ATTEMPTS</th>
                  <th scope="col">MISSES</th>
                  <th scope="col">RESULT</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <tr key={`${stage.id}-${stage.position ?? 0}`}>
                    <td>{stage.title || STAGE_LABELS[stage.id] || stage.id}</td>
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
        </>
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

      <div className="detail__danger">
        {deleteError ? <p className="syncnote syncnote--queued">DELETE FAILED — {deleteError.toUpperCase()}</p> : null}
        {confirming ? (
          <div className="stagefoot">
            <button
              type="button"
              className="btn btn--signal"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? 'DELETING…' : 'CONFIRM DELETE'}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={deleting}>
              CANCEL
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirming(true)}>
            DELETE THIS SESSION
          </button>
        )}
      </div>
    </section>
  )
}
