import { useCallback, useEffect, useRef, useState } from 'react'

// The panel is a live reading, so it is polled rather than cached: every 15s
// while the tab is visible, and once on the way back. A slow response can never
// overwrite a newer one — each fetch carries a token and the last one wins.
export function useNowPlaying(intervalMs = 15000) {
  const [state, setState] = useState({
    data: null,
    at: 0,
    loading: true,
    refreshing: false,
    error: null,
  })
  const tokenRef = useRef(0)
  const controllerRef = useRef(null)

  const load = useCallback(async (manual = false) => {
    tokenRef.current += 1
    const token = tokenRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState((prev) => ({ ...prev, refreshing: manual }))
    try {
      const res = await fetch('/api/now-playing', { signal: controller.signal, cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (token !== tokenRef.current) return
      setState({
        data,
        at: data?.fetchedAt || Date.now(),
        loading: false,
        refreshing: false,
        error: null,
      })
    } catch (error) {
      if (controller.signal.aborted || token !== tokenRef.current) return
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error?.message || 'failed',
      }))
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, intervalMs)
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      controllerRef.current?.abort()
    }
  }, [load, intervalMs])

  const refresh = useCallback(() => load(true), [load])

  return { ...state, refresh }
}
