import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Web MIDI wrapper.
//
// Status values:
//   'unsupported' — browser has no navigator.requestMIDIAccess
//   'idle'        — supported, not yet connected
//   'requesting'  — awaiting the permission prompt
//   'ready'       — access granted, listening
//   'denied'      — permission refused / access failed
//
// Exposes a subscribe() so drills can react to note-on events without this hook
// knowing anything about them. `activeNotes` is the set currently held down,
// for live display.
export function useMidi() {
  const supported =
    typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'

  const [status, setStatus] = useState(supported ? 'idle' : 'unsupported')
  const [inputs, setInputs] = useState([])
  const [selectedInputId, setSelectedInputId] = useState(null)
  const [activeNotes, setActiveNotes] = useState([])

  const accessRef = useRef(null)
  const selectedRef = useRef(null) // the currently-attached MIDIInput
  const listenersRef = useRef(new Set())

  // Subscribe to note-on events. Returns an unsubscribe fn.
  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  const handleMessage = useCallback((event) => {
    const [statusByte, note, velocity = 0] = event.data
    const command = statusByte & 0xf0
    const isNoteOn = command === 0x90 && velocity > 0
    const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0)

    if (isNoteOn) {
      setActiveNotes((prev) => (prev.includes(note) ? prev : [...prev, note]))
      listenersRef.current.forEach((fn) => fn(note, velocity))
    } else if (isNoteOff) {
      setActiveNotes((prev) => prev.filter((n) => n !== note))
    }
  }, [])

  // Attach message handling to a given input id (detaching any previous one).
  const attachToInput = useCallback(
    (id) => {
      const access = accessRef.current
      if (selectedRef.current) selectedRef.current.onmidimessage = null
      const input = access && id ? access.inputs.get(id) : null
      selectedRef.current = input || null
      if (input) input.onmidimessage = handleMessage
      setActiveNotes([])
    },
    [handleMessage],
  )

  const refreshInputs = useCallback(() => {
    const access = accessRef.current
    if (!access) return
    const list = Array.from(access.inputs.values()).map((i) => ({
      id: i.id,
      name: i.name || 'Unknown MIDI input',
      manufacturer: i.manufacturer || '',
    }))
    setInputs(list)

    // Auto-select the first input if nothing valid is currently attached.
    const currentId = selectedRef.current?.id
    const stillPresent = currentId && list.some((i) => i.id === currentId)
    if (!stillPresent) {
      const firstId = list[0]?.id ?? null
      attachToInput(firstId)
      setSelectedInputId(firstId)
    }
  }, [attachToInput])

  const connect = useCallback(async () => {
    if (!supported) {
      setStatus('unsupported')
      return
    }
    setStatus('requesting')
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      accessRef.current = access
      access.onstatechange = () => refreshInputs()
      refreshInputs()
      setStatus('ready')
    } catch {
      setStatus('denied')
    }
  }, [supported, refreshInputs])

  const selectInput = useCallback(
    (id) => {
      setSelectedInputId(id)
      attachToInput(id)
    },
    [attachToInput],
  )

  useEffect(() => {
    // Cleanup on unmount.
    return () => {
      if (selectedRef.current) selectedRef.current.onmidimessage = null
      const access = accessRef.current
      if (access) access.onstatechange = null
    }
  }, [])

  const connected = status === 'ready' && !!selectedInputId

  return useMemo(
    () => ({
      supported,
      status,
      connected,
      inputs,
      selectedInputId,
      selectInput,
      connect,
      subscribe,
      activeNotes,
    }),
    [supported, status, connected, inputs, selectedInputId, selectInput, connect, subscribe, activeNotes],
  )
}
