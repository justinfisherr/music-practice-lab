// Module engine: the shared contract between the client composer and the server
// validators. A module is one graded unit of a session. Tiers set the XP base;
// grading is either a chord SET (order/octave free) or a SEQUENCE (in order).

export const GRADING = { SET: 'set', SEQUENCE: 'sequence' }

export const MODULE_SPECS = {
  SCALE: {
    tier: 1,
    grading: GRADING.SEQUENCE,
    title: 'MAJOR SCALE',
    teach: 'Play the major scale up one octave. Listen for the half steps between 3-4 and 7-1.',
    skill: 'theory',
    why: 'The scale is the map every chord and line sits on.',
    estSec: 20,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  TRIADS: {
    tier: 1,
    grading: GRADING.SET,
    title: 'DIATONIC TRIADS',
    teach: 'Play the seven diatonic triads in order. Any octave, any inversion.',
    skill: 'theory',
    why: 'Chord quality by degree is the grammar of functional harmony.',
    estSec: 25,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  EAR: {
    tier: 1,
    grading: GRADING.SEQUENCE,
    title: 'EAR CHECK',
    teach: 'Four diatonic notes. Hear them once, then play them back in order.',
    skill: 'ear',
    why: 'Playing what you hear closes the loop between ear and hands.',
    estSec: 20,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  MAJ7: {
    tier: 2,
    grading: GRADING.SET,
    title: 'MAJOR SEVENTHS',
    teach: 'Play the major seventh chords on I and IV. The major seventh is the sweet one.',
    skill: 'chords',
    why: 'Maj7 chords are the resting color of a major key.',
    estSec: 20,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  MIN7: {
    tier: 2,
    grading: GRADING.SET,
    title: 'MINOR SEVENTHS',
    teach: 'Play the minor seventh chords on ii, iii and vi.',
    skill: 'chords',
    why: 'Minor sevenths carry the ii and the relative minor.',
    estSec: 25,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  DOM7: {
    tier: 2,
    grading: GRADING.SET,
    title: 'DOMINANT SEVENTH',
    teach: 'Play the dominant seventh on V. The third and seventh are the engine.',
    skill: 'chords',
    why: 'The V7 is the hinge that turns a key around.',
    estSec: 15,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  HALF_DIM: {
    tier: 2,
    grading: GRADING.SET,
    title: 'HALF-DIMINISHED',
    teach: 'Play the viiø7 chord. Four notes, one diminished triad under a major seventh.',
    skill: 'chords',
    why: 'The half-diminished seventh is the leading-tone sound of a major key.',
    estSec: 20,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  II_V_I: {
    tier: 3,
    grading: GRADING.SET,
    title: 'ii-V-I',
    teach: 'Play ii7, V7, Imaj7 in order. Three chords, one cadence.',
    skill: 'harmony',
    why: 'The ii-V-I is the sentence structure of jazz.',
    estSec: 25,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  GUIDE_TONES: {
    tier: 3,
    grading: GRADING.SEQUENCE,
    title: 'GUIDE TONES',
    teach: 'Play the guide-tone line through ii-V-I: third, seventh, seventh, third.',
    skill: 'voice-leading',
    why: 'Guide tones move by step and tell the story of the changes.',
    estSec: 25,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
  PASSING_DIM: {
    tier: 3,
    grading: GRADING.SET,
    title: 'PASSING DIMINISHED',
    teach: 'Play the passing diminished seventh that sits between ii and I.',
    skill: 'harmony',
    why: 'A passing dim7 slips chromatically between two diatonic chords.',
    estSec: 20,
    steps: ['TEACH', 'HEAR', 'PLAY', 'GRADE'],
  },
}

export const MODULE_TYPES = Object.keys(MODULE_SPECS)
export const MIN_MODULES = 3
export const MAX_MODULES = 5
export const MAX_EST_SEC = 180
export const MAX_RATIONALE = 200

export function moduleSpec(type) {
  return MODULE_SPECS[type] || null
}

// Shape validation for a planned module list. Accepts strings or {type,params}.
// Params are kept opaque here; the resolver validates the ones it knows.
export function validatePlanShape(modules) {
  if (!Array.isArray(modules)) return { ok: false, error: 'modules_missing' }
  if (modules.length < MIN_MODULES) return { ok: false, error: 'too_few_modules' }
  if (modules.length > MAX_MODULES) return { ok: false, error: 'too_many_modules' }
  const seen = new Set()
  let estSec = 0
  const value = []
  for (const entry of modules) {
    const type = typeof entry === 'string' ? entry : entry?.type
    const spec = MODULE_SPECS[type]
    if (!spec) return { ok: false, error: 'unknown_module' }
    if (seen.has(type)) return { ok: false, error: 'duplicate_module' }
    seen.add(type)
    estSec += spec.estSec
    if (entry && typeof entry === 'object') {
      if (entry.params != null && (typeof entry.params !== 'object' || Array.isArray(entry.params))) {
        return { ok: false, error: 'bad_params' }
      }
      value.push({ type, params: entry.params || undefined })
    } else {
      value.push({ type })
    }
  }
  if (estSec > MAX_EST_SEC) return { ok: false, error: 'too_long' }
  return { ok: true, value, estSec }
}

// Session-shape rules beyond the raw module list. `recent` is an array of type
// arrays from the last graded nights; a type used on 2+ of the last 3 is stale.
export function validatePlanConstraints(modules, recent = []) {
  const types = modules.map((entry) => (typeof entry === 'string' ? entry : entry.type))
  const tierOf = (type) => MODULE_SPECS[type]?.tier || 0
  const count = (predicate) => types.filter(predicate).length
  const t3 = count((type) => tierOf(type) === 3)
  if (t3 > 2) return { ok: false, error: 'too_many_tier3' }
  if (count((type) => tierOf(type) === 1) < 1) return { ok: false, error: 'needs_tier1' }
  if (!types.includes('EAR') && !types.includes('GUIDE_TONES')) {
    return { ok: false, error: 'needs_ear_or_guide_tones' }
  }
  const hard = ['II_V_I', 'GUIDE_TONES', 'PASSING_DIM']
  if (count((type) => hard.includes(type)) > 1) {
    return { ok: false, error: 'too_many_hard_modules' }
  }
  const nights = Array.isArray(recent) ? recent.slice(0, 3) : []
  const used = new Map()
  for (const night of nights) {
    for (const type of new Set(Array.isArray(night) ? night : [])) {
      used.set(type, (used.get(type) || 0) + 1)
    }
  }
  for (const type of types) {
    if ((used.get(type) || 0) >= 2) return { ok: false, error: 'stale_module' }
  }
  return { ok: true }
}

// Full plan validation, used by the API parser and the client resolver.
export function validatePlan(plan, { recent = [] } = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { ok: false, error: 'plan_missing' }
  }
  const shape = validatePlanShape(plan.modules)
  if (!shape.ok) return shape
  const constraints = validatePlanConstraints(shape.value, recent)
  if (!constraints.ok) return constraints
  const rationale = typeof plan.rationale === 'string' ? plan.rationale.trim() : ''
  if (rationale.length > MAX_RATIONALE) return { ok: false, error: 'rationale_too_long' }
  if (rationale !== rationale.toLowerCase()) return { ok: false, error: 'rationale_not_lowercase' }
  if (rationale.includes('!')) return { ok: false, error: 'rationale_exclamation' }
  return { ok: true, value: { rationale, modules: shape.value, estSec: shape.estSec } }
}
