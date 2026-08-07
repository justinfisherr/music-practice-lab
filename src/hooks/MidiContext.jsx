/* eslint-disable react-refresh/only-export-components -- provider + hook co-located intentionally */
import { createContext, useContext } from 'react'
import { useMidi } from './useMidi.js'

// One MIDI connection shared across every screen. Connect once on any tab and
// the whole app sees the same inputs, status, and live notes.
const MidiContext = createContext(null)

export function MidiProvider({ children }) {
  const midi = useMidi()
  return <MidiContext.Provider value={midi}>{children}</MidiContext.Provider>
}

export function useMidiContext() {
  const value = useContext(MidiContext)
  if (!value) throw new Error('useMidiContext must be used within <MidiProvider>')
  return value
}
