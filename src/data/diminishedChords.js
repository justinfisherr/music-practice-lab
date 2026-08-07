// Diminished-7th theory, generated so the 12 chords and 3 families never drift.
//
// A dim7 chord stacks minor thirds (0,3,6,9 semitones), so it repeats every 3
// semitones. That collapses all 12 roots into exactly 3 pitch-class sets
// ("families"). Recognition is purely by pitch class, so enharmonic spelling
// doesn't matter for correctness — we just pick one readable spelling per note.

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export function noteName(pc) {
  return NOTE_NAMES[((pc % 12) + 12) % 12]
}

export function normalizePitchClasses(notes) {
  return [...new Set(notes.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b)
}

// The three diminished families, keyed by a stable id.
export const FAMILIES = [
  { id: 1, label: 'FAMILY 1', pitchClasses: [0, 3, 6, 9] }, // C  Eb Gb A
  { id: 2, label: 'FAMILY 2', pitchClasses: [1, 4, 7, 10] }, // C# E  G  Bb
  { id: 3, label: 'FAMILY 3', pitchClasses: [2, 5, 8, 11] }, // D  F  Ab B
]

export function familyForPitchClass(pc) {
  const norm = ((pc % 12) + 12) % 12
  return FAMILIES.find((f) => f.pitchClasses.includes(norm))
}

// The 12 dim7 chords: 4 roots per family. `notes` is spelled from the root.
export const CHORDS = FAMILIES.flatMap((family) =>
  family.pitchClasses.map((root) => ({
    name: `${noteName(root)}°7`, // e.g. "Bb°7"
    root,
    family: family.id,
    pitchClasses: [...family.pitchClasses].sort((a, b) => a - b),
    notes: [0, 3, 6, 9].map((iv) => noteName(root + iv)),
  })),
)

export function chordByName(name) {
  return CHORDS.find((c) => c.name === name) ?? null
}

// True when two note collections describe the same chord (octave/inversion/
// duplicate-agnostic).
export function pitchClassesEqual(a, b) {
  const sa = normalizePitchClasses(a)
  const sb = normalizePitchClasses(b)
  return sa.length === sb.length && sa.every((v, i) => v === sb[i])
}

export function randomItem(list, excludeName) {
  const pool = excludeName ? list.filter((c) => c.name !== excludeName) : list
  const source = pool.length ? pool : list
  return source[Math.floor(Math.random() * source.length)]
}

export function randomChord(excludeName) {
  return randomItem(CHORDS, excludeName)
}
