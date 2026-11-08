import { keyDisplay } from '../data/scales.js'
import { PLAY_CHANGES } from '../session/set.js'
import { xpBreakdown } from '../../lib/xp.js'
import { LevelUpBlock } from './Rank.jsx'

function clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
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

function focusLine(stages) {
  const warm = stages.find((stage) => stage.id === 'warmup')?.detail
  const changes = stages.find((stage) => stage.id === 'jam')?.detail
  const lab = warm?.lab
  if (lab && !lab.passed) {
    return 'SCALE LAB: play the major, relative minor, and parallel minor before the ear.'
  }
  if (warm?.rapid && warm.rapid.passed !== true) {
    return 'CHORDS: play I through vi in order before the turnaround.'
  }
  if (warm?.turnaround && warm.turnaround.passed !== true) {
    return 'TURNAROUND: comp I–vi–ii–V clean.'
  }
  if (changes && (changes.accuracy ?? 0) < 60) {
    return 'CHANGES: catch the chord at the change before adding movement.'
  }
  if (changes && (changes.voiceLead ?? 0) < 20) {
    return 'CHANGES: keep the voicings close — small moves are the smooth ones.'
  }
  if (warm?.ear && warm.ear.passed !== true) {
    return 'EAR: listen for the direction before you touch the keys.'
  }
  return 'Keep the voicings close and land the chord at the change.'
}

export default function SetSummary({ session, syncState, onDone, onAgain, onOpenWardrobe }) {
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

  const stages = session.stages || []
  const warm = stages.find((stage) => stage.id === 'warmup')?.detail
  const changes = stages.find((stage) => stage.id === 'jam')?.detail
  const changesName = PLAY_CHANGES.find((entry) => entry.id === changes?.changesId)?.name
  const xp = xpBreakdown(stages, session.status, session.scope || 'session')
  const sync = syncLine(syncState)
  const rapid = warm?.rapid
  const turnaround = warm?.turnaround
  const lab = warm?.lab
  const homes = Array.isArray(lab?.homesPlayed) ? lab.homesPlayed.length : warm?.scale?.passed ? 1 : 0
  const focus = focusLine(stages)

  return (
    <section className="summary" aria-labelledby="summary-title">
      <div className="summary__head">
        <span className="summary__kicker">
          {session.status === 'abandoned' ? 'SET ENDED EARLY' : 'SET COMPLETE'} · {session.date}
        </span>
        <h2 className="summary__title" id="summary-title">
          {keyDisplay(session.keyId)} MAJOR
        </h2>
        <p className="summary__meta">
          {clock(session.durationMs)} · 30-SECOND CHANGES ·{' '}
          {session.composition?.source === 'llm' ? 'LLM WARM-UP' : 'STANDARD SET'}
        </p>
      </div>

      <div className="setreport">
        <div className="setreport__block">
          <span className="setreport__label">WARM-UP</span>
          <div className="setreport__rows">
            <span>
              SCALE LAB · <strong>{homes ? `${homes} OF 3 HOMES` : 'OPEN'}</strong>
            </span>
            <span>
              CALLS · <strong>{lab?.callsCorrect ?? 0} OF {lab?.callsTotal ?? 6}</strong>
            </span>
            <span>EAR · <strong>{warm?.ear?.passed ? 'CLEAR' : 'OPEN'}</strong></span>
          </div>
        </div>

        <div className="setreport__block">
          <span className="setreport__label">CHORDS · TURNAROUND</span>
          <div className="setreport__nums">
            <span>
              <strong>{rapid?.clean ?? rapid?.correct ?? 0} / {rapid?.total ?? 6}</strong> CHORDS
            </span>
            <span>
              <strong>{turnaround?.clean ?? 0} / {turnaround?.total ?? 4}</strong> TURNAROUND
            </span>
            <span>
              <strong>{turnaround?.passed ? 'CLEAR' : 'OPEN'}</strong> SET
            </span>
          </div>
        </div>

        <div className="setreport__block">
          <span className="setreport__label">
            CHANGES{changesName ? ` · ${changesName.toUpperCase()}` : ''}
          </span>
          <div className="setreport__nums">
            <span>
              <strong>{changes?.score ?? 0}</strong> SCORE
            </span>
            <span>
              <strong>{changes?.best ?? 0}</strong> BEST
            </span>
            <span>
              <strong>{changes?.voiceLead ?? 0}</strong> VOICE LEAD
            </span>
            <span>
              <strong>{changes?.accuracy ?? 0}%</strong> ACCURACY
            </span>
          </div>
        </div>

        {changes ? (
          <div className="setreport__block">
            <span className="setreport__label">JAM REPORT</span>
            <div className="setreport__nums">
              <span>
                <strong>{changes.notes ?? 0}</strong> NOTES
              </span>
              <span>
                <strong>{changes.hits ?? 0} / {changes.changes ?? 0}</strong> CHANGES HIT
              </span>
              <span>
                <strong>×{changes.bestCombo ?? 0}</strong> BEST COMBO
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="xpbreak">
        <div className="xpbreak__earned">
          <span className="xpbreak__label">XP EARNED</span>
          <span className="xpbreak__value">+{xp.total}</span>
        </div>
        <ul className="xpbreak__list">
          {xp.modules.map((module) => (
            <li key={module.id}>
              <span>{module.title}</span>
              <span className="xpbreak__num">+{module.xp}</span>
            </li>
          ))}
          <li>
            <span>COMPLETE</span>
            <span className="xpbreak__num">+{xp.complete}</span>
          </li>
        </ul>
      </div>

      <LevelUpBlock
        before={session.xpBefore}
        after={syncState.totalXp}
        onOpenWardrobe={onOpenWardrobe}
      />

      <p className="focusline">
        <span className="focusline__label">FOCUS</span>
        {focus}
      </p>

      <p className={`syncnote${sync.tone ? ` syncnote--${sync.tone}` : ''}`}>{sync.text}</p>

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
