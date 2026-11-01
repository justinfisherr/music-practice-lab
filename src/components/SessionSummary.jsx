import { useState } from 'react'
import { keyById } from '../data/scales.js'
import { noteName } from '../data/diminishedChords.js'

const STAGE_LABELS = { warmup: 'WARM-UP', ear: 'EAR CHECK', hook: 'HOOK' }

function clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function syncLine(syncState) {
  if (syncState.syncing) return { tone: 'queued', text: 'SYNCING TO THE LEDGER…' }
  if (syncState.pending > 0) {
    return {
      tone: 'queued',
      text: syncState.online
        ? `${syncState.pending} RUN${syncState.pending === 1 ? '' : 'S'} QUEUED — WILL SYNC`
        : `${syncState.pending} RUN${syncState.pending === 1 ? '' : 'S'} QUEUED — OFFLINE`,
    }
  }
  if (syncState.dead > 0) {
    return {
      tone: 'dead',
      text: `${syncState.dead} RUN${syncState.dead === 1 ? '' : 'S'} COULD NOT SYNC — KEPT ON THIS DEVICE`,
    }
  }
  return { tone: '', text: 'SAVED TO THE LEDGER.' }
}

export default function SessionSummary({ session, syncState, onDone, onAgain }) {
  const [openHook, setOpenHook] = useState(false)

  if (!session || session.status === 'active') {
    return (
      <section className="summary">
        <div className="emptyblock">
          NO FINISHED SESSION YET.
          <br />
          <button type="button" className="linkbtn" onClick={onDone}>
            BACK TO TONIGHT
          </button>
        </div>
      </section>
    )
  }

  const key = keyById(session.keyId)
  const hook = session.composition?.stages?.find((stage) => stage.id === 'hook')
  const sync = syncLine(syncState)
  const duration = session.durationMs || 0
  const stages = session.stages || []
  const totalAttempts = stages.reduce((sum, stage) => sum + stage.attempts, 0)
  const totalMisses = stages.reduce((sum, stage) => sum + stage.misses, 0)

  return (
    <section className="summary" aria-labelledby="summary-title">
      <div className="summary__head">
        <span className="summary__kicker">
          {session.status === 'abandoned' ? 'SESSION ENDED EARLY' : 'SESSION COMPLETE'} ·{' '}
          {session.date}
        </span>
        <h2 className="summary__title" id="summary-title">
          {key.label} MAJOR
        </h2>
        <p className="summary__meta">
          {clock(duration)} · {totalAttempts} ATTEMPTS · {totalMisses} MISSES
        </p>
      </div>

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
              <td>{stage.attempts}</td>
              <td>{stage.misses}</td>
              <td className={stage.passed ? 'is-pass' : 'is-fail'}>
                {stage.passed ? 'PASS' : 'OPEN'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={`syncnote${sync.tone ? ` syncnote--${sync.tone}` : ''}`}>{sync.text}</p>

      {hook ? (
        <div className="hookreview">
          <button
            type="button"
            className="linkbtn"
            aria-expanded={openHook}
            onClick={() => setOpenHook((value) => !value)}
          >
            {openHook ? 'HIDE THE HOOK' : 'REVIEW THE HOOK'}
          </button>
          {openHook ? (
            <div className="scaleviz" aria-label="Hook notes">
              {hook.pcs.map((pc, index) => (
                <span className="scaleviz__note" key={`${pc}-${index}`}>
                  {index + 1}. {noteName(pc)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="stagefoot">
        <button type="button" className="btn btn--signal" onClick={onDone}>
          DONE
        </button>
        <button type="button" className="btn" onClick={onAgain}>
          PLAY IT AGAIN
        </button>
      </div>
    </section>
  )
}
