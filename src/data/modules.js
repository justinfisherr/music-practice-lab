import { diatonicChords, keyById } from './scales.js'
import { noteName } from './diminishedChords.js'
import { diatonicPcs, earPhrase, mulberry32 } from '../session/phrases.js'
import { fnv1a } from '../session/tonight.js'
import {
  MODULE_SPECS,
  MODULE_TYPES,
  MIN_MODULES,
  MAX_MODULES,
  validatePlan,
} from '../../lib/modules.js'

// Seventh-chord intervals by quality. Built on a diatonic root so the spelling
// stays in the key; display names use flats/sharps from the note table.
const SEVENTH = { maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], halfDim: [0, 3, 6, 10], dim7: [0, 3, 6, 9] }

function seventh(chord, quality) {
  const root = chord.rootPc
  return {
    label: `${chord.numeral} · ${noteName(root)}${quality === 'maj7' ? 'maj7' : quality === 'min7' ? 'm7' : quality === 'dom7' ? '7' : 'ø7'}`,
    numeral: chord.numeral,
    name: `${noteName(root)}${quality === 'maj7' ? 'maj7' : quality === 'min7' ? 'm7' : quality === 'dom7' ? '7' : 'ø7'}`,
    pcs: normalize(SEVENTH[quality].map((iv) => root + iv)),
  }
}

function normalize(pcs) {
  return [...new Set(pcs.map((pc) => ((pc % 12) + 12) % 12))].sort((a, b) => a - b)
}

// Build the target(s) for one module type in a key. Everything is derived from
// the key's diatonic chords, so a planned module can never point at a wrong note.
export function resolveTargets(type, keyId, seed) {
  const key = keyById(keyId)
  const triads = diatonicChords(keyId)
  switch (type) {
    case 'SCALE': {
      const pcs = [...diatonicPcs(keyId), key.tonic]
      return [{ label: `${key.label} MAJOR SCALE`, pcs }]
    }
    case 'TRIADS':
      return triads.map((chord) => ({
        label: `${chord.numeral} · ${chord.name}`,
        numeral: chord.numeral,
        name: chord.name,
        pcs: chord.pitchClasses,
      }))
    case 'EAR': {
      const pcs = earPhrase(seed, keyId)
      return [{ label: 'FOUR NOTES BY EAR', pcs }]
    }
    case 'MAJ7':
      return [triads[0], triads[3]].map((chord) => seventh(chord, 'maj7'))
    case 'MIN7':
      return [triads[1], triads[2], triads[5]].map((chord) => seventh(chord, 'min7'))
    case 'DOM7':
      return [seventh(triads[4], 'dom7')]
    case 'HALF_DIM':
      return [seventh(triads[6], 'halfDim')]
    case 'II_V_I':
      return [triads[1], triads[4], triads[0]].map((chord, index) =>
        seventh(chord, ['min7', 'dom7', 'maj7'][index]),
      )
    case 'GUIDE_TONES': {
      const ii = triads[1].rootPc
      const v = triads[4].rootPc
      const pcs = [ii + 3, ii + 10, v + 10, key.tonic + 4].map((pc) => ((pc % 12) + 12) % 12)
      return [{ label: 'GUIDE TONES ii–V–I', pcs }]
    }
    case 'PASSING_DIM':
      return [
        {
          label: `${noteName(key.tonic + 1)}°7 PASSING`,
          pcs: normalize([key.tonic + 1, key.tonic + 4, key.tonic + 7, key.tonic + 10]),
        },
      ]
    default:
      return []
  }
}

// A resolved module carries both the catalog spec and its concrete targets.
export function resolveModule({ type, keyId, seed }) {
  const spec = MODULE_SPECS[type]
  if (!spec) return null
  const targets = resolveTargets(type, keyId, seed)
  if (!targets.length) return null
  return {
    type,
    tier: spec.tier,
    title: spec.title,
    teach: spec.teach,
    skill: spec.skill,
    grading: spec.grading,
    why: spec.why,
    estSec: spec.estSec,
    steps: spec.steps,
    keyId,
    targets,
  }
}

// Deterministic composition: tonight draws 3-5 types from the whole catalog;
// a bonus session draws 3 from the harder half. Sorting by tier keeps the run
// easy-to-hard. Types never repeat inside a session.
export function composeModules({ seed, keyId, variant = 'tonight' }) {
  const pool = variant === 'bonus'
    ? MODULE_TYPES.filter((type) => MODULE_SPECS[type].tier > 1)
    : MODULE_TYPES
  const rng = mulberry32((seed ^ fnv1a(`modules|${variant}`)) >>> 0)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const min = Math.min(MIN_MODULES, pool.length)
  const count = Math.max(min, Math.min(pool.length, min + Math.floor(rng() * (MAX_MODULES - min + 1))))
  const types = shuffled.slice(0, count).sort((a, b) => {
    const tier = MODULE_SPECS[a].tier - MODULE_SPECS[b].tier
    return tier || MODULE_TYPES.indexOf(a) - MODULE_TYPES.indexOf(b)
  })
  return types.map((type) => resolveModule({ type, keyId, seed })).filter(Boolean)
}

// Resolve a validated plan into concrete modules. The plan's types/order are
// kept; every note comes from the local catalog. Invalid plans return null.
export function resolvePlan({ plan, keyId, seed }) {
  const checked = validatePlan(plan)
  if (!checked.ok) return null
  const modules = checked.value.modules
    .map(({ type }) => resolveModule({ type, keyId, seed }))
    .filter(Boolean)
  if (modules.length !== checked.value.modules.length) return null
  return {
    version: 3,
    source: 'llm',
    rationale: checked.value.rationale,
    estSec: checked.value.estSec,
    modules,
  }
}
