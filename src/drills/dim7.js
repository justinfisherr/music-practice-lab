import { CHORDS, randomChord } from '../data/diminishedChords.js'

// A "drill" is a self-contained challenge definition. The MIDI engine knows
// nothing about music theory — it just collects `notesToCollect` unique pitch
// classes and asks the drill to grade them. To add a new challenge (e.g.
// major triads, dominant 7ths, scale degrees) create another module shaped
// like this one and register it in ./index.js. Nothing else has to change.
//
// Question shape returned by generate():
//   {
//     promptLabel:  string  — small label above the target ("PLAY")
//     promptValue:  string  — the big target text ("Bb°7")
//     expected:     number[] — pitch classes that count as correct
//     expectedNotes: string[] — human-readable spelling for feedback
//     subtitle?:    string  — optional secondary line
//   }

export const dim7Drill = {
  id: 'dim7',
  label: 'DIMINISHED 7TH',
  blurb: 'Play the named diminished-7th chord. Any octave, any inversion.',
  notesToCollect: 4,
  generate(prevQuestion) {
    const chord = randomChord(prevQuestion?.promptValue)
    return {
      promptLabel: 'PLAY',
      promptValue: chord.name,
      subtitle: `FAMILY ${chord.family}`,
      expected: chord.pitchClasses,
      expectedNotes: chord.notes,
    }
  },
}

// Exported for potential reuse / tests.
export const allDim7Chords = CHORDS
