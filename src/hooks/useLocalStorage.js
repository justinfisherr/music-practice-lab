import { useCallback, useEffect, useRef, useState } from 'react'

// A useState that persists to localStorage. Survives refresh on the same device.
// Gracefully no-ops if storage is unavailable (private mode, quota, SSR).
export function useLocalStorage(key, initialValue) {
  const seed = () => (typeof initialValue === 'function' ? initialValue() : initialValue)

  function read() {
    try {
      const stored = window.localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : seed()
    } catch {
      return seed()
    }
  }

  const [value, setValue] = useState(read)

  // Re-read when the key changes so a new drill/key doesn't inherit the
  // previous one's persisted value.
  const [prevKey, setPrevKey] = useState(key)
  if (prevKey !== key) {
    setPrevKey(key)
    setValue(read())
  }

  // Keep the latest value in a ref so the setter can be a stable callback.
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore write failures
    }
  }, [key, value])

  const set = useCallback((next) => {
    setValue((prev) => (typeof next === 'function' ? next(prev) : next))
  }, [])

  return [value, set]
}
