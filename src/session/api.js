export const ENDPOINT =
  import.meta.env.VITE_SESSIONS_ENDPOINT || 'https://music-practice-lab.vercel.app/api/sessions'

export class ApiError extends Error {
  constructor(message, { status = 0, retryable = true, body = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryable = retryable
    this.body = body
  }
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`${ENDPOINT}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(body.error || `HTTP ${res.status}`, {
        status: res.status,
        // 4xx is a bad row (dead-letter it); 429 and 5xx are worth retrying.
        retryable: res.status === 429 || res.status >= 500,
        body,
      })
    }
    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error.name === 'AbortError' ? 'request timed out' : 'network error', {
      status: 0,
      retryable: true,
    })
  } finally {
    clearTimeout(timer)
  }
}

export function postRun(run) {
  return request('', { method: 'POST', body: JSON.stringify(run) })
}

export function getRuns({ limit = 40, key = null, before = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (key) params.set('key', key)
  if (before) params.set('before', before)
  return request(`?${params.toString()}`)
}

export function getRun(id) {
  return request(`?id=${encodeURIComponent(id)}`)
}
