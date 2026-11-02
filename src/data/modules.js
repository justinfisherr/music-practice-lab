import { diatonicChords, keyById } from './scales.js'
import { noteName } from './diminishedChords.js'
import { diatonicPcs, earPhrase, mulberry32 } from '../session/phrases.js'
import { fnv1a } from '../session/tonight.js'
import {
  GRADING,
  MODULE_SPECS,
  MODULE_TYPES,
  MIN_MODULES,
  MAX_MODULES,
  validateModule,
  validatePlan,
} from '../../lib/modules.js'

// Seventh-chord intervals by quality. Built on a diatonic root so the spelling
// stays in the key; display names use flats/sharps from the note table.
const SEVENTH = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  halfDim: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
}

const QUALITY_LABEL = { maj7: 'maj7', min7: 'm7', dom7: '7', halfDim: 'ø7' }
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

function normalize(pcs) {
  return [...new Set(pcs.map((pc) => ((pc % 12) + 12) % 12))].sort((a, b) => a - b)
}

function seventh(chord, quality) {
  const root = chord.rootPc
  const pcs = normalize(SEVENTH[quality].map((iv) => root + iv))
  return {
    label: `${chord.numeral} · ${noteName(root)}${QUALITY_LABEL[quality]}`,
    numeral: chord.numeral,
    name: `${noteName(root)}${QUALITY_LABEL[quality]}`,
    pcs,
    notes: pcs.map(noteName),
  }
}

function degreesToPcs(keyId, degrees) {
  const tonic = keyById(keyId).tonic
  return degrees.map((degree) => (tonic + MAJOR_STEPS[degree - 1]) % 12)
}

// Build the target(s) for one module type in a key. Everything is derived from
// the key's diatonic chords, so a planned module can never point at a wrong note.
export function resolveTargets(type, keyId, seed, params = {}) {
  const key = keyById(keyId)
  const triads = diatonicChords(keyId)
  switch (type) {
    case 'SCALE': {
      const pcs = [...diatonicPcs(keyId), key.tonic]
      return [{ label: `${key.label} MAJOR SCALE`, pcs, notes: [...key.scale, key.scale[0]] }]
    }
    case 'TRIADS':
      return triads.map((chord) => ({
        label: `${chord.numeral} · ${chord.name}`,
        numeral: chord.numeral,
        name: chord.name,
        pcs: chord.pitchClasses,
        notes: chord.notes,
      }))
    case 'EAR': {
      const pcs = Array.isArray(params?.degrees)
        ? degreesToPcs(keyId, params.degrees)
        : earPhrase(seed, keyId)
      return [{ label: `${pcs.length} NOTES BY EAR`, pcs, notes: pcs.map(noteName) }]
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
      // ii7 third -> V7 seventh -> Imaj7 third. C: F F E.
      const pcs = [triads[1].rootPc + 3, triads[4].rootPc + 10, key.tonic + 4].map(
        (pc) => ((pc % 12) + 12) % 12,
      )
      return [{ label: 'GUIDE TONES ii–V–I', pcs, notes: pcs.map(noteName) }]
    }
    case 'PASSING_DIM':
      return [
        {
          label: `${noteName(key.tonic + 1)}°7 PASSING`,
          pcs: normalize([key.tonic + 1, key.tonic + 4, key.tonic + 7, key.tonic + 10]),
          notes: normalize([key.tonic + 1, key.tonic + 4, key.tonic + 7, key.tonic + 10]).map(
            noteName,
          ),
        },
      ]
    default:
      return []
  }
}

function toSteps(grading, targets) {
  return targets.map((target) => ({
    kind: grading === GRADING.SET ? 'set' : 'sequence',
    targetPcs: target.pcs,
    targetNotes: target.notes || target.pcs.map(noteName),
    label: target.label,
  }))
}

// A resolved module carries both the catalog spec and its concrete steps. The
// catalog overwrites every LLM-authored field; only validated params survive.
export function resolveModule({ type, params, keyId, seed }) {
  const checked = validateModule(params == null ? type : { type, params })
  if (!checked.ok) return null
  const spec = MODULE_SPECS[type]
  const targets = resolveTargets(type, keyId, seed, checked.value.params)
  if (!targets.length) return null
  let steps = toSteps(spec.grading, targets)
  if (type === 'PASSING_DIM') {
    // The passing chord resolves into ii7. Grade the borrowed arpeggio in
    // order, then the diatonic landing chord as a set.
    const ii = seventh(diatonicChords(keyId)[1], 'min7')
    steps = [
      ...steps,
      {
        kind: 'set',
        targetPcs: ii.pcs,
        targetNotes: ii.notes,
        label: `ii7 · ${ii.name}`,
      },
    ]
  }
  return {
    type,
    params: checked.value.params,
    tier: spec.tier,
    title: spec.title,
    teach: spec.teach,
    skill: spec.skill,
    grading: spec.grading,
    why: spec.why,
    estSec: spec.estSec,
    steps,
  }
}

// Deterministic composition: tonight draws 3-5 types from the whole catalog;
// a bonus session draws from the harder half. Sorting by tier keeps the run
// easy-to-hard. Types never repeat inside a session.
export function composeModules({ seed, keyId, variant = 'tonight' }) {
  const pool =
    variant === 'bonus'
      ? MODULE_TYPES.filter((type) => MODULE_SPECS[type].tier > 1)
      : MODULE_TYPES
  const rng = mulberry32((seed ^ fnv1a(`modules|${variant}`)) >>> 0)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const min = Math.min(MIN_MODULES, pool.length)
  const count = Math.max(
    min,
    Math.min(pool.length, min + Math.floor(rng() * (MAX_MODULES - min + 1))),
  )
  // Anchor the fallback on an ear module so every local session has a listening
  // step: EAR tonight, GUIDE_TONES for the harder bonus draw. The rest of the
  // slots keep the no-repeat and at-most-one-hard-module rules.
  const hard = new Set(['II_V_I', 'GUIDE_TONES', 'PASSING_DIM'])
  const picked = [variant === 'bonus' ? 'GUIDE_TONES' : 'EAR']
  for (const type of shuffled) {
    if (picked.length >= count) break
    if (picked.includes(type)) continue
    if (hard.has(type) && picked.some((value) => hard.has(value))) continue
    if (MODULE_SPECS[type].tier === 3 && picked.filter((value) => MODULE_SPECS[value].tier === 3).length >= 2) {
      continue
    }
    picked.push(type)
  }
  const types = picked.sort((a, b) => {
    const tier = MODULE_SPECS[a].tier - MODULE_SPECS[b].tier
    return tier || MODULE_TYPES.indexOf(a) - MODULE_TYPES.indexOf(b)
  })
  return types
    .map((type) => resolveModule({ type, keyId, seed }))
    .filter(Boolean)
}

// Resolve a validated plan into concrete modules. The plan's types/order and
// validated params are kept; every note comes from the local catalog. Invalid
// plans return null.
export function resolvePlan({ plan, keyId, seed }) {
  const checked = validatePlan(plan)
  if (!checked.ok) return null
  const modules = checked.value.modules
    .map(({ type, params }) => resolveModule({ type, params, keyId, seed }))
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
