// Server-side LLM plan: prompt construction and strict parsing. The API treats
// anything this rejects as a standard (local) plan, so parsing is conservative.

import { validatePlan } from './modules.js'

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

function cleanRationale(value, limit = 200) {
  if (typeof value !== 'string') return ''
  let clean = ''
  for (const char of value) {
    const code = char.codePointAt(0)
    clean += code < 32 || code === 127 ? ' ' : char
  }
  return clean.trim().slice(0, limit)
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

// ---- v3 module plans -------------------------------------------------------
// The v3 client asks for a module list instead of ear/hook degrees. The prompt
// names the catalog and the composer's constraints; parsing is just as strict.

export const MODULE_PROMPT = [
  'You program a short graded practice session for a jazz-minded pianist.',
  'Choose 3 to 5 modules from this catalog: SCALE, TRIADS, EAR, MAJ7, MIN7,',
  'DOM7, HALF_DIM, II_V_I, GUIDE_TONES, PASSING_DIM.',
  'Use each module at most once. Include at least one tier-1 module (SCALE, TRIADS, EAR).',
  'Include EAR or GUIDE_TONES. Use at most two tier-3 modules (II_V_I, GUIDE_TONES, PASSING_DIM).',
  'Use at most one of II_V_I, GUIDE_TONES and PASSING_DIM.',
  'Avoid a type that appears on two or more of the last three graded nights.',
  'Every module is diatonic to the key except PASSING_DIM.',
  'Order them from easiest to hardest.',
  'rationale: 200 characters or fewer, lowercase, no exclamation marks.',
  'Return ONLY the JSON object, with keys rationale and modules. Each module is {"type":"SCALE"}. No prose, no fences.',
].join(' ')

export function buildModuleMessages({ date, keyId, variant = 'tonight', recent }) {
  return [
    { role: 'system', content: MODULE_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        date,
        keyId,
        variant,
        recent: Array.isArray(recent) ? recent : [],
      }),
    },
  ]
}

export function parseModulePlan(text) {
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
  // v3 does not truncate: an overlong rationale is a failed plan and the API
  // falls back to the deterministic composition.
  const checked = validatePlan({
    rationale: cleanRationale(parsed.rationale, Infinity),
    modules: parsed.modules,
  })
  if (!checked.ok) return null
  return {
    rationale: checked.value.rationale,
    modules: checked.value.modules,
  }
}
