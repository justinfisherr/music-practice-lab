import { useEffect, useState } from 'react'

function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Persistent bar for a manual (open) session. The graded timer lives in
// SessionRun; this one follows the same pause/elapsed rules.
export default function ManualBar({ session, onEnd }) {
  const [now, setNow] = useState(() => Date.now())
  const running = session?.status === 'active' && !session.pausedAt

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])

  if (!session || session.status !== 'active') return null

  const elapsed =
    (session.pausedAt ? Date.parse(session.pausedAt) : now) -
    Date.parse(session.startedAt) -
    (session.pausedMs || 0)

  return (
    <div className="sessionbar manualbar" role="status">
      <span className="sessionbar__key">OPEN SESSION · {session.focus || 'FREE PLAY'}</span>
      <span className="sessionbar__timer" aria-label={`Elapsed ${clock(elapsed)}`}>
        {clock(elapsed)}
      </span>
      <div className="sessionbar__btns">
        <button type="button" className="sessionbar__btn" onClick={onEnd}>
          END SESSION
        </button>
      </div>
    </div>
  )
}
