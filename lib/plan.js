// Server-side LLM plan: prompt construction and strict parsing. The API treats
// anything this rejects as a standard (local) plan, so parsing is conservative.

export const PROMPT = [
  'You compose a short ear-training drill for a jazz-minded pianist.',
  'Use major-scale degrees only: integers 1 through 7 (1 is the tonic).',
  'earDegrees must be exactly 4 degrees; hookDegrees must be exactly 6.',
  'No identical adjacent degrees in either phrase.',
  'Vary from the recent sessions: avoid repeating their shapes.',
  'NEVER place 2, 5, 1 consecutively in the hook.',
  'The hook should be mostly stepwise with exactly one leap.',
  'rationale: 120 characters or fewer, lowercase, no exclamation marks.',
  'Return ONLY the JSON object, with keys rationale, earDegrees, hookDegrees. No prose, no fences.',
].join(' ')

export function buildMessages({ date, keyId, recent }) {
  return [
    { role: 'system', content: PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        date,
        keyId,
        recent: Array.isArray(recent) ? recent : [],
      }),
    },
  ]
}

function validPhrase(value, length) {
  if (!Array.isArray(value) || value.length !== length) return false
  for (let i = 0; i < value.length; i++) {
    const degree = value[i]
    if (!Number.isInteger(degree) || degree < 1 || degree > 7) return false
    if (i > 0 && value[i - 1] === degree) return false
  }
  return true
}

function cleanRationale(value) {
  if (typeof value !== 'string') return ''
  let clean = ''
  for (const char of value) {
    const code = char.codePointAt(0)
    clean += code < 32 || code === 127 ? ' ' : char
  }
  return clean.trim().slice(0, 200)
}

// Strip optional code fences, take from the first "{" to the last "}", then
// validate shape. Returns null on anything unexpected.
export function parsePlan(text) {
  if (typeof text !== 'string') return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  let parsed
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (!validPhrase(parsed.earDegrees, 4)) return null
  if (!validPhrase(parsed.hookDegrees, 6)) return null
  return {
    rationale: cleanRationale(parsed.rationale),
    earDegrees: parsed.earDegrees,
    hookDegrees: parsed.hookDegrees,
  }
}
