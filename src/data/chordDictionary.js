import { noteName } from './diminishedChords.js'

// Chord identification for FREE PLAY: given the notes currently held on the
// keyboard, work out what they spell.
//
// Templates are root-relative semitone sets. To add more recognizable chords,
// just add a template here — the matcher is generic.

const INTERVAL_NAMES = [
  'Unison',
  'Minor 2nd',
  'Major 2nd',
  'Minor 3rd',
  'Major 3rd',
  'Perfect 4th',
  'Tritone',
  'Perfect 5th',
  'Minor 6th',
  'Major 6th',
  'Minor 7th',
  'Major 7th',
]

// Ordered roughly most-common first; matching is exact-set so order only
// affects which name wins for enharmonically identical shapes.
const TEMPLATES = [
  { suffix: '', intervals: [0, 4, 7] }, // major triad
  { suffix: 'm', intervals: [0, 3, 7] }, // minor triad
  { suffix: '°', intervals: [0, 3, 6] }, // diminished triad
  { suffix: '+', intervals: [0, 4, 8] }, // augmented triad
  { suffix: 'sus2', intervals: [0, 2, 7] },
  { suffix: 'sus4', intervals: [0, 5, 7] },
  { suffix: '6', intervals: [0, 4, 7, 9] },
  { suffix: 'm6', intervals: [0, 3, 7, 9] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: '7', intervals: [0, 4, 7, 10] }, // dominant 7th
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
  { suffix: 'm7b5', intervals: [0, 3, 6, 10] }, // half-diminished
  { suffix: '°7', intervals: [0, 3, 6, 9] }, // diminished 7th
  { suffix: '7#5', intervals: [0, 4, 8, 10] }, // augmented 7th
  { suffix: '7b5', intervals: [0, 4, 6, 10] },
  { suffix: 'add9', intervals: [0, 2, 4, 7] },
  { suffix: 'madd9', intervals: [0, 2, 3, 7] },
  { suffix: '9', intervals: [0, 2, 4, 7, 10] },
  { suffix: 'maj9', intervals: [0, 2, 4, 7, 11] },
  { suffix: 'm9', intervals: [0, 2, 3, 7, 10] },
  { suffix: '6/9', intervals: [0, 2, 4, 7, 9] },
]

function toPitchClasses(notes) {
  return [...new Set(notes.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b)
}

function setEquals(a, b) {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((v) => sb.has(v))
}

// Return every root/suffix whose template exactly matches the held pitch classes.
function matchChords(pcs) {
  const matches = []
  for (const template of TEMPLATES) {
    for (let root = 0; root < 12; root++) {
      const templatePcs = template.intervals.map((i) => (root + i) % 12)
      if (setEquals(pcs, [...new Set(templatePcs)])) {
        matches.push({ root, suffix: template.suffix })
      }
    }
  }
  return matches
}

function chordName(root, suffix) {
  return `${noteName(root)}${suffix}`
}

// Identify what a set of held MIDI notes spells.
// Returns a display-ready object:
//   { kind: 'empty' }
//   { kind: 'note',     name }
//   { kind: 'interval', name, detail }
//   { kind: 'chord',    name, equivalents: [], notes: [] }
//   { kind: 'unknown',  notes: [] }
export function analyzeNotes(notes) {
  const sorted = [...notes].sort((a, b) => a - b)
  const pcs = toPitchClasses(sorted)
  const noteLabels = pcs.map(noteName)

  if (pcs.length === 0) return { kind: 'empty' }

  if (pcs.length === 1) {
    return { kind: 'note', name: noteName(pcs[0]) }
  }

  const bassPc = ((sorted[0] % 12) + 12) % 12

  if (pcs.length === 2) {
    const [a, b] = pcs
    const up = (b - a + 12) % 12
    const interval = INTERVAL_NAMES[up] || INTERVAL_NAMES[(a - b + 12) % 12]
    return {
      kind: 'interval',
      name: `${noteName(a)} · ${noteName(b)}`,
      detail: interval,
    }
  }

  const matches = matchChords(pcs)
  if (matches.length === 0) {
    return { kind: 'unknown', notes: noteLabels }
  }

  // Prefer the interpretation rooted on the bass note (i.e. root position);
  // otherwise take the first match and mark it as a slash chord.
  const rootMatch = matches.find((m) => m.root === bassPc)
  const primary = rootMatch || matches[0]
  let name = chordName(primary.root, primary.suffix)
  if (primary.root !== bassPc) name += `/${noteName(bassPc)}`

  const equivalents = matches
    .filter((m) => !(m.root === primary.root && m.suffix === primary.suffix))
    .map((m) => chordName(m.root, m.suffix))

  return { kind: 'chord', name, equivalents, notes: noteLabels }
}
