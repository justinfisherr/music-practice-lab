import { useState } from 'react'
import { keyDisplay } from '../data/scales.js'
import { noteName } from '../data/diminishedChords.js'
import { xpBreakdown } from '../../lib/xp.js'
import { LevelUpBlock } from './Rank.jsx'
import SetSummary from './SetSummary.jsx'

const STAGE_LABELS = { warmup: 'WARM-UP', ear: 'EAR CHECK', hook: 'HOOK' }
const XP_LABELS = [
  ['warmup', 'WARM-UP'],
  ['ear', 'EAR'],
  ['hook', 'HOOK'],
  ['complete', 'COMPLETE'],
]

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

export default function SessionSummary({ session, syncState, onDone, onAgain, onOpenWardrobe }) {
  const [openHook, setOpenHook] = useState(false)

  if (!session || session.status === 'active') {
    return (
      <section className="summary">
        <div className="emptyblock">
          NO FINISHED SESSION YET.
          <br />
          <button type="button" className="linkbtn" onClick={onDone}>
            BACK TO TODAY
          </button>
        </div>
      </section>
    )
  }

  if (session.composition?.version === 4) {
    return (
      <SetSummary
        session={session}
        syncState={syncState}
        onDone={onDone}
        onAgain={onAgain}
        onOpenWardrobe={onOpenWardrobe}
      />
    )
  }

  const v3 = session.composition?.version === 3
  const hook = v3 ? null : session.composition?.stages?.find((stage) => stage.id === 'hook')
  const sync = syncLine(syncState)
  const duration = session.durationMs || 0
  const stages = session.stages || []
  const totalAttempts = stages.reduce((sum, stage) => sum + stage.attempts, 0)
  const totalMisses = stages.reduce((sum, stage) => sum + stage.misses, 0)
  const scope = session.scope || (session.kind === 'manual' ? 'open' : 'session')
  const xp = xpBreakdown(stages, session.status, scope)
  const kicker = scope === 'lesson' ? 'LESSON COMPLETE' : 'SESSION COMPLETE'

  return (
    <section className="summary" aria-labelledby="summary-title">
      <div className="summary__head">
        <span className="summary__kicker">
          {session.status === 'abandoned' ? `${kicker} ENDED EARLY` : kicker} · {session.date}
        </span>
        <h2 className="summary__title" id="summary-title">
          {keyDisplay(session.keyId)} MAJOR
        </h2>
        <p className="summary__meta">
          {clock(duration)} · {totalAttempts} ATTEMPTS · {totalMisses} MISSES
        </p>
      </div>

      <div className="xpbreak">
        <div className="xpbreak__earned">
          <span className="xpbreak__label">XP EARNED</span>
          <span className="xpbreak__value">+{xp.total}</span>
        </div>
        <ul className="xpbreak__list">
          {Array.isArray(xp.modules)
            ? xp.modules.map((module) => (
                <li key={module.id}>
                  <span>{module.title}</span>
                  <span className="xpbreak__num">+{module.xp}</span>
                </li>
              ))
            : XP_LABELS.map(([id, label]) => (
                <li key={id}>
                  <span>{label}</span>
                  <span className="xpbreak__num">+{xp[id]}</span>
                </li>
              ))}
          {Array.isArray(xp.modules) ? (
            <li>
              <span>COMPLETE</span>
              <span className="xpbreak__num">+{xp.complete}</span>
            </li>
          ) : null}
        </ul>
      </div>

      <LevelUpBlock
        before={session.xpBefore}
        after={syncState.totalXp}
        onOpenWardrobe={onOpenWardrobe}
      />

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
