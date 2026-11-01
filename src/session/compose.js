import { diatonicChords, keyById } from '../data/scales.js'
import { earPhrase, HOOK_BEATS, hookPhrase } from './phrases.js'

const STEPS = [0, 2, 4, 5, 7, 9, 11]

// Compose tonight's three graded stages. Pure and deterministic: the same
// date/key/seed always produces the same warm-up, ear phrase, and hook.
//
// LLM SEAM: keep this signature and return shape stable if a composer is added
// later; only the `source` and stage contents should change.
export function composeSession({ date, keyId, seed }) {
  const key = keyById(keyId)
  const triads = diatonicChords(keyId)
  const scalePcs = [...STEPS, 12].map((step) => (key.tonic + step) % 12)

  return {
    date,
    keyId,
    seed,
    source: 'local',
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
        pcs: earPhrase(seed, keyId),
      },
      {
        id: 'hook',
        position: 2,
        title: 'HOOK',
        pcs: hookPhrase(seed, keyId),
        beats: HOOK_BEATS,
      },
    ],
  }
}
