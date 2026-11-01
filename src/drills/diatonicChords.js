import { diatonicChords, keyName } from '../data/scales.js'
import { randomItem } from '../data/diminishedChords.js'

// Diatonic-chord drill: name a key, play its chords. Draws a random triad from
// the key's seven diatonic chords each round (same endless shape as dim7, but
// scoped to one key). The numeral is shown in the subtitle so chord and
// function recognition reinforce each other.

export function makeChordsDrill(keyId) {
  const chords = diatonicChords(keyId)
  return {
    id: 'chords',
    label: 'DIATONIC CHORDS',
    blurb: `Every triad in ${keyName(keyId)}. Any octave, any inversion.`,
    usesKey: true,
    notesToCollect: 3,
    generate(prevQuestion) {
      const chord = randomItem(chords, prevQuestion?.promptValue)
      return {
        promptLabel: 'PLAY',
        promptValue: chord.name,
        subtitle: `${keyName(keyId)} · ${chord.numeral}`,
        expected: chord.pitchClasses,
        expectedNotes: chord.notes,
        notesToCollect: 3,
      }
    },
  }
}
