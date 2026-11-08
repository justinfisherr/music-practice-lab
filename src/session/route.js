export const VIEWS = ['session', 'lessons', 'freeplay', 'crate', 'stats']
export const SESSION_SUBS = ['run', 'summary']

export function parseHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const raw = String(hash || '').replace(/^#/, '')
  const [pathPart, queryPart = ''] = raw.split('?')
  const parts = pathPart.split('/').filter(Boolean)
  const query = new URLSearchParams(queryPart)

  if (parts[0] === 'stats') {
    return {
      view: 'stats',
      id: parts[1] ? decodeURIComponent(parts[1]) : null,
      key: query.get('key') || null,
      wardrobe: query.get('wardrobe') === 'open',
    }
  }

  if (parts[0] === 'crate') {
    return { view: 'crate', id: parts[1] ? decodeURIComponent(parts[1]) : null }
  }

  if (parts[0] === 'lessons') {
    return {
      view: 'lessons',
      type: query.get('type') || null,
      foundation: query.get('foundation') || null,
    }
  }

  if (parts[0] === 'session') {
    const sub = SESSION_SUBS.includes(parts[1]) ? parts[1] : null
    return { view: 'session', sub }
  }

  if (VIEWS.includes(parts[0])) return { view: parts[0] }

  // Unknown or empty hashes render the default tab without rewriting the URL.
  return { view: 'session', sub: null, unknown: raw.length > 0 }
}

export function navigate(path) {
  if (typeof window === 'undefined') return
  const hash = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash === hash) return
  window.location.hash = hash
}
