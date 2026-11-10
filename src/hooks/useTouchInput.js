import { useEffect, useState } from 'react'
import { useMidiContext } from './MidiContext.jsx'

// Which input the device has: a connected keyboard always wins, then a coarse
// pointer or a browser with no Web MIDI at all gets the touch pad.
export function useTouchInput() {
  const midi = useMidiContext()
  const [coarse, setCoarse] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const query = window.matchMedia('(pointer: coarse)')
    const onChange = () => setCoarse(query.matches)
    setCoarse(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return { touch: !midi.connected && (!midi.supported || coarse) }
}
