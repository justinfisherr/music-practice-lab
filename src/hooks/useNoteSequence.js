import { useEffect, useRef } from 'react'
import { useMidiContext } from './MidiContext.jsx'

// Subscribe to MIDI while `active`, normalize to pitch class, and report a
// partial phrase after silence. shortcut: 60ms dedupe for key bounce.
export function useNoteSequence({ active, onNote, onSilence, silenceMs = 1500, dedupeMs = 60 }) {
  const { subscribe } = useMidiContext()
  const noteRef = useRef(onNote)
  const silenceRef = useRef(onSilence)
  const activeRef = useRef(active)
  const timerRef = useRef(null)
  const countRef = useRef(0)
  const lastRef = useRef({ pc: null, at: 0 })

  noteRef.current = onNote
  silenceRef.current = onSilence
  activeRef.current = active

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      return
    }
    countRef.current = 0
    lastRef.current = { pc: null, at: 0 }
  }, [active])

  useEffect(() => {
    const unsubscribe = subscribe((note) => {
      if (!activeRef.current) return
      const pc = ((note % 12) + 12) % 12
      const now = Date.now()
      if (lastRef.current.pc === pc && now - lastRef.current.at < dedupeMs) return
      lastRef.current = { pc, at: now }
      countRef.current += 1
      noteRef.current?.(pc)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (countRef.current > 0) {
          countRef.current = 0
          silenceRef.current?.()
        }
      }, silenceMs)
    })
    return () => {
      unsubscribe()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [subscribe, silenceMs, dedupeMs])
}
