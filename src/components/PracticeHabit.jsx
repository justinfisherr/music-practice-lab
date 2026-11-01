import { useCallback, useEffect, useState } from 'react'

const ENDPOINT =
  import.meta.env.VITE_HABIT_ENDPOINT || 'https://music-practice-lab.vercel.app/api/practice'

export default function PracticeHabit() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT)
      if (!res.ok) throw new Error(`habit service ${res.status}`)
      const body = await res.json()
      setCount(Number(body.count) || 0)
      setError('')
    } catch (err) {
      setError(`Habit sync unavailable: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function log() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit: 'music_practice', count: 1 }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `habit service ${res.status}`)
      setCount(Number(body.count) || 1)
    } catch (err) {
      setError(`Could not log practice: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="practice-log" aria-labelledby="practice-log-title">
      <div className="practice-log__bar">
        <span className="practice-log__label">DAILY HABIT</span>
        <span className={`practice-log__status${count ? ' is-done' : ''}`} aria-live="polite">
          {loading ? 'READING…' : count ? `${count} LOGGED TODAY` : 'NOT LOGGED YET'}
        </span>
      </div>
      <h2 className="practice-log__title" id="practice-log-title">
        MUSIC PRACTICE
      </h2>
      <p className="practice-log__copy">
        One tap records it in the vault and feeds the Habits calendar. Multiple sessions count.
      </p>
      <button
        className={`btn btn--huge practice-log__btn${count ? ' is-done' : ''}`}
        type="button"
        onClick={log}
        disabled={busy || loading}
      >
        {busy ? 'LOGGING…' : count ? 'LOG ANOTHER SESSION' : 'I PRACTICED'}
      </button>
      {error ? (
        <p className="practice-log__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
