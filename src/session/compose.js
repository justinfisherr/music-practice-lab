import { diatonicChords, keyById } from '../data/scales.js'
import { diatonicPcs, earPhrase, HOOK_BEATS, hookPhrase } from './phrases.js'

const STEPS = [0, 2, 4, 5, 7, 9, 11]

function degreePcs(keyId, degrees) {
  const degreesPcs = diatonicPcs(keyId)
  return degrees.map((degree) => degreesPcs[degree - 1])
}

// Compose tonight's three graded stages. Pure and deterministic: the same
// date/key/seed always produces the same warm-up, ear phrase, and hook.
//
// A plan is an optional LLM suggestion of scale degrees; when present the ear
// and hook phrases come from it, otherwise the deterministic local phrase does.
// The stage shapes stay identical either way.
export function composeSession({ date, keyId, seed, plan = null }) {
  const key = keyById(keyId)
  const triads = diatonicChords(keyId)
  const scalePcs = [...STEPS, 12].map((step) => (key.tonic + step) % 12)

  // /api/plan returns { source, rationale, plan: { earDegrees, hookDegrees } };
  // older/flattened callers pass the degrees at the top level. Accept both.
  const suggestion = plan?.plan ?? plan
  const earDegrees =
    suggestion && Array.isArray(suggestion.earDegrees) && suggestion.earDegrees.length === 4
      ? suggestion.earDegrees
      : null
  const hookDegrees =
    suggestion && Array.isArray(suggestion.hookDegrees) && suggestion.hookDegrees.length === 6
      ? suggestion.hookDegrees
      : null

  return {
    date,
    keyId,
    seed,
    source: plan ? 'llm' : 'local',
    rationale: plan?.rationale ?? null,
    stages: [
      {
        id: 'warmup',
        position: 0,
        title: 'WARM-UP',
        scale: { pcs: scalePcs, notes: [...key.scale, key.scale[0]] },
        triads,
        vChord: triads[4],
      },
      {
        id: 'ear',
        position: 1,
        title: 'EAR CHECK',
        pcs: earDegrees ? degreePcs(keyId, earDegrees) : earPhrase(seed, keyId),
      },
      {
        id: 'hook',
        position: 2,
        title: 'HOOK',
        pcs: hookDegrees ? degreePcs(keyId, hookDegrees) : hookPhrase(seed, keyId),
        beats: HOOK_BEATS,
      },
    ],
  }
}
