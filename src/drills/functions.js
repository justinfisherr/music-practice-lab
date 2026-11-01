import { diatonicChords, keyName } from '../data/scales.js'

// Function drill: see a roman numeral ("ii"), play the chord that fills that
// function in the key ("Em" in D major). A "set" is one pass through all seven
// functions in a shuffled order, timed against the clock — no countdown, you
// just go. Wrong answers re-present the same numeral until you hit it; the
// clock keeps running, so mistakes cost you time. Best (fastest) set time is
// persisted by the engine.

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function makeFunctionDrill(keyId) {
  return {
    id: 'function',
    label: 'FUNCTION',
    blurb: `See a numeral, play its chord in ${keyName(keyId)}. Timed — best time kept.`,
    usesKey: true,
    timed: true,
    setSize: 7,
    notesToCollect: 3,
    buildSet() {
      return shuffle(diatonicChords(keyId)).map((chord) => ({
        promptLabel: 'PLAY',
        promptValue: chord.numeral,
        subtitle: keyName(keyId),
        expected: chord.pitchClasses,
        expectedNotes: chord.notes,
        notesToCollect: 3,
      }))
    },
  }
}
