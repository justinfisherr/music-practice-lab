/* eslint-disable react-refresh/only-export-components -- hook + renderer co-located intentionally */
import { useCallback, useRef, useState } from 'react'

// Rainbow "+N" chips for every point award. One hook owns the list, the
// component draws it; a chip removes itself after the animation ends.
export function usePointPops() {
  const [pops, setPops] = useState([])
  const idRef = useRef(0)

  const pop = useCallback((points, label = '') => {
    if (!points) return
    const id = (idRef.current += 1)
    setPops((prev) => [...prev.slice(-4), { id, points, label }])
    setTimeout(() => setPops((prev) => prev.filter((entry) => entry.id !== id)), 1300)
  }, [])

  return { pops, pop }
}

export default function PointsPops({ pops }) {
  return (
    <div className="pointspops" aria-live="polite">
      {pops.map((entry) => (
        <span className="pointspop" key={entry.id}>
          +{entry.points}
          {entry.label ? <span className="pointspop__label">{entry.label}</span> : null}
        </span>
      ))}
    </div>
  )
}
