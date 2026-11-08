import { useEffect, useState } from 'react'
import { safeRead, safeWrite } from './store.js'

// Media lookups are public and cacheable; the client keeps a copy per record or
// artist so a shelf never refetches a cover it already has.
const API = import.meta.env?.VITE_CRATE_API || 'https://music-practice-lab.vercel.app/api'
const TIMEOUT = 8000

function coverKey(record) {
  return `mpl.covers.${record.id}`
}

function artistKey(artist) {
  return `mpl.artists.${artist.id}`
}

export function useCover(record) {
  const key = record ? coverKey(record) : ''
  const [url, setUrl] = useState(() => (key ? safeRead(key, undefined) : undefined))

  useEffect(() => {
    if (!record) return
    const cached = safeRead(key, undefined)
    if (cached !== undefined) {
      setUrl(cached)
      return
    }

    let live = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    setUrl(undefined)

    const params = new URLSearchParams({ artist: record.artist, album: record.album })
    fetch(`${API}/cover?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body) => {
        const next = body?.url || null
        safeWrite(key, next)
        if (live) setUrl(next)
      })
      .catch(() => {
        if (live) setUrl(null)
      })
      .finally(() => clearTimeout(timer))

    return () => {
      live = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, record])

  return url
}

export function useArtistImage(artist) {
  const key = artist ? artistKey(artist) : ''
  const [data, setData] = useState(() => (key ? safeRead(key, undefined) : undefined))

  useEffect(() => {
    if (!artist) return
    const cached = safeRead(key, undefined)
    if (cached !== undefined) {
      setData(cached)
      return
    }

    let live = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    setData(undefined)

    const params = new URLSearchParams({ name: artist.imageQuery || artist.name })
    fetch(`${API}/artist-image?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body) => {
        const next = {
          url: body?.url || null,
          extract: body?.extract || null,
          page: body?.page || null,
        }
        safeWrite(key, next)
        if (live) setData(next)
      })
      .catch(() => {
        if (live) setData({ url: null, extract: null, page: null })
      })
      .finally(() => clearTimeout(timer))

    return () => {
      live = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, artist])

  return data
}
