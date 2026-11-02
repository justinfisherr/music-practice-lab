import { useCallback, useState } from 'react'
import * as store from './store.js'
import { describe } from './rank.js'
import { markLevel, reconcile } from './skin.js'

// Client mirror of the server XP total. applyTotalXp is the only writer: it
// persists the total, records the level for the boot script, and reconciles
// the active skin against the new level.
export function useRank() {
  const [totalXp, setTotalXp] = useState(() => store.loadXp())
  const info = describe(totalXp)

  const applyTotalXp = useCallback((value) => {
    if (!Number.isFinite(value)) return
    const next = Math.max(0, Math.round(value))
    setTotalXp(next)
    store.saveXp(next)
    const level = describe(next).level
    markLevel(level)
    reconcile(level)
  }, [])

  // The mount-cache XP is not trustworthy (0 before the first server read), so
  // first paint is left to the index.html boot script. Reconcile only on live data.

  return { totalXp, ...info, applyTotalXp }
}
