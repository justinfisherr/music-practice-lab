// The teaching spine. Ten micro-lessons in C, in the order the research says
// works: key -> intervals -> chord tones -> 7th -> guide tones -> function ->
// extensions -> secondary dominants -> borrowed chords -> playing the changes.
// Each one is a plain definition, a demo you can hear, one thing to play, and
// three quick checks. The cards link back here; Free Play links terms here.
export const FOUNDATIONS = [
  {
    id: 'key',
    title: 'THE KEY',
    blurb: 'The home note and the seven notes that belong with it.',
    definition:
      'A key is a home note plus the seven notes that belong with it. In C major that is C D E F G A B. When a note belongs, we say it is "in key." Most music you like is built from one key at a time.',
    demo: { label: 'C MAJOR SCALE', kind: 'sequence', pcs: [0, 2, 4, 5, 7, 9, 11, 12] },
    play: { label: 'PLAY THE C MAJOR SCALE', kind: 'sequence', pcs: [0, 2, 4, 5, 7, 9, 11, 12] },
    checks: [
      { q: 'Which note is home in C major?', options: ['C', 'G', 'A'], answer: 0 },
      { q: 'Which note is NOT in C major?', options: ['F#', 'F', 'B'], answer: 0 },
      { q: 'A note that belongs to the key is…', options: ['in key', 'borrowed', 'chromatic'], answer: 0 },
    ],
  },
  {
    id: 'intervals',
    title: 'INTERVALS',
    blurb: 'The distance between two notes: 3rds, 5ths, 7ths.',
    definition:
      'An interval is the distance between two notes. A 3rd is three letters apart (C to E). A 5th is five letters (C to G). A 7th is seven letters (C to B). Almost everything in this app is built from 3rds, 5ths and 7ths, so learn their sound.',
    demo: { label: 'C → E → G → B', kind: 'sequence', pcs: [0, 4, 7, 11] },
    play: { label: 'PLAY C, E, G, B', kind: 'sequence', pcs: [0, 4, 7, 11] },
    checks: [
      { q: 'C to E is a…', options: ['3rd', '5th', '7th'], answer: 0 },
      { q: 'C to G is a…', options: ['3rd', '5th', '7th'], answer: 1 },
      { q: 'C to B is a…', options: ['3rd', '5th', '7th'], answer: 2 },
    ],
  },
  {
    id: 'chord-tones',
    title: 'CHORD TONES',
    blurb: 'Root, 3rd, 5th — the notes that make the chord.',
    definition:
      'A chord is a stack of notes. The root is its name. The 3rd tells you major or minor. The 5th fills it out. Root, 3rd and 5th are the chord tones. In C major: C, E, G. If you only learn one thing, learn to find the 3rd — it is the note that makes the chord happy or sad.',
    demo: { label: 'C MAJOR TRIAD', kind: 'set', pcs: [0, 4, 7] },
    play: { label: 'PLAY C MAJOR (C E G)', kind: 'set', pcs: [0, 4, 7] },
    checks: [
      { q: 'The root of C major is…', options: ['C', 'E', 'G'], answer: 0 },
      { q: 'The 3rd of C major is…', options: ['E', 'G', 'B'], answer: 0 },
      { q: 'Root, 3rd and 5th are called…', options: ['chord tones', 'extensions', 'guide tones'], answer: 0 },
    ],
  },
  {
    id: 'sevenths',
    title: 'THE 7TH',
    blurb: 'Add a 7th and the chord gets colour and pull.',
    definition:
      'Put a 7th on top of the triad and you get a seventh chord. The 7th is the colour note: it makes a chord sound open (major 7), or tense and ready to move (dominant 7), or smooth (minor 7). In jazz, sevenths are the default, not the exception.',
    demo: { label: 'CMAJ7 → DM7 → G7', kind: 'sequence', pcs: [0, 4, 7, 11, 2, 5, 9, 0, 7, 11, 2, 5] },
    play: { label: 'PLAY G7 (G B D F)', kind: 'set', pcs: [7, 11, 2, 5] },
    checks: [
      { q: 'G7 is a…', options: ['dominant 7', 'minor 7', 'major 7'], answer: 0 },
      { q: 'Cmaj7 contains…', options: ['C E G B', 'C E G Bb', 'C Eb G Bb'], answer: 0 },
      { q: 'The 7th makes a chord…', options: ['more open or tense', 'quieter', 'out of key'], answer: 0 },
    ],
  },
  {
    id: 'guide-tones',
    title: 'GUIDE TONES',
    blurb: 'The 3rd and 7th — the two notes that carry the chord.',
    definition:
      'The 3rd and 7th are the guide tones. They tell you major, minor or dominant, and they move the shortest distance between chords. In a ii–V–I the 3rd of ii (F in Dm7) becomes the 7th of V (F in G7), then falls to the 3rd of I (E in Cmaj7). Hear that line and you can follow the changes.',
    demo: { label: 'GUIDE TONES: F → F → E', kind: 'sequence', pcs: [5, 5, 4] },
    play: { label: 'PLAY F, F, E', kind: 'sequence', pcs: [5, 5, 4] },
    checks: [
      { q: 'Guide tones are the…', options: ['3rd and 7th', 'root and 5th', '9th and 13th'], answer: 0 },
      { q: 'The 3rd of Dm7 is…', options: ['F', 'A', 'C'], answer: 0 },
      { q: 'The 7th of G7 is…', options: ['F', 'G', 'B'], answer: 0 },
    ],
  },
  {
    id: 'function',
    title: 'FUNCTION',
    blurb: 'I is home, IV pulls away, V pulls back. ii–V–I.',
    definition:
      'Chords have jobs. I is home. IV pulls away. V pulls back home. Put ii in front of V and you get the most common move in jazz: ii–V–I. A progression is just chords doing those jobs in order. That progression is what people mean by "the changes."',
    demo: { label: 'Cmaj7 → Dm7 → G7 → Cmaj7', kind: 'sequence', pcs: [0, 4, 7, 11, 2, 5, 9, 0, 7, 11, 2, 5, 0, 4, 7, 11] },
    play: { label: 'PLAY THE V CHORD (G7)', kind: 'set', pcs: [7, 11, 2, 5] },
    checks: [
      { q: 'I is…', options: ['home', 'the pull', 'colour'], answer: 0 },
      { q: 'V is…', options: ['the pull back home', 'home', 'a borrowed chord'], answer: 0 },
      { q: 'ii–V–I ends on…', options: ['I', 'ii', 'V'], answer: 0 },
    ],
  },
  {
    id: 'extensions',
    title: 'EXTENSIONS',
    blurb: '9, 11, 13 — colour above the 7th. Add them last.',
    definition:
      'Above the 7th are the extensions: 9, 11 and 13. They make a chord richer, but they also blur it. Learn the 1, 3 and 7 first; add extensions only when the chord underneath is already clear. Cmaj9 is Cmaj7 with a D added on top.',
    demo: { label: 'CMAJ7 → CMAJ9', kind: 'sequence', pcs: [0, 4, 7, 11, 0, 2, 4, 7, 11] },
    play: { label: 'PLAY Cmaj9 (C E G B D)', kind: 'set', pcs: [0, 2, 4, 7, 11] },
    checks: [
      { q: '9, 11 and 13 are…', options: ['extensions', 'chord tones', 'roots'], answer: 0 },
      { q: 'Cmaj9 adds which note to Cmaj7?', options: ['D', 'F', 'A'], answer: 0 },
      { q: 'Add extensions…', options: ['after the 1-3-7 is clear', 'before anything else', 'instead of chord tones'], answer: 0 },
    ],
  },
  {
    id: 'secondary-dominants',
    title: 'SECONDARY DOMINANTS',
    blurb: 'A temporary V that points at another chord.',
    definition:
      'A V chord can point at any chord, not just home. In C, E7 is the V of Am: it pulls to Am. We write that V/vi. A7 pulls to Dm (V/ii). It is a temporary dominant — a sidestep, not a new key. If the chord after it is the target, the pull makes sense.',
    demo: { label: 'E7 → Am', kind: 'sequence', pcs: [4, 8, 11, 2, 9, 0, 4] },
    play: { label: 'PLAY E7 (E G# B D)', kind: 'set', pcs: [4, 8, 11, 2] },
    checks: [
      { q: 'In C, E7 is the V of…', options: ['Am', 'Dm', 'G'], answer: 0 },
      { q: 'V/vi means…', options: ['the V of the vi chord', 'the vi of V', 'a borrowed chord'], answer: 0 },
      { q: 'A secondary dominant is…', options: ['a temporary dominant, not a key change', 'a new key', 'a borrowed chord'], answer: 0 },
    ],
  },
  {
    id: 'borrowed-chords',
    title: 'BORROWED CHORDS',
    blurb: 'A chord from the parallel minor. Home does not move.',
    definition:
      'A borrowed chord comes from the parallel minor — same home note, different colour. In C, Fm (iv), Bb (bVII), Ab (bVI) and Eb (bIII) are borrowed from C minor. You are still in C; you just visited the minor for a bar. The other name for it is modal interchange.',
    demo: { label: 'C → F → Fm → C', kind: 'sequence', pcs: [0, 4, 7, 5, 9, 0, 5, 8, 0, 0, 4, 7] },
    play: { label: 'PLAY Fm (F Ab C)', kind: 'set', pcs: [5, 8, 0] },
    checks: [
      { q: 'In C, Fm is borrowed from…', options: ['C minor', 'C major', 'G major'], answer: 0 },
      { q: 'A borrowed chord keeps…', options: ['the same home note', 'a new home', 'no home'], answer: 0 },
      { q: 'Bb in C is…', options: ['bVII', 'IV', 'ii'], answer: 0 },
    ],
  },
  {
    id: 'play-the-changes',
    title: 'PLAY THE CHANGES',
    blurb: 'Land on the chord that is actually sounding.',
    definition:
      'The changes are the chord progression. To "play the changes" means your notes land on the chord that is sounding — chord tones on the strong beats. Start with the 3rds and 7ths, then add colour. It is not about playing fast; it is about being in the right place when the chord moves.',
    demo: { label: 'GUIDE TONES OVER ii–V–I', kind: 'sequence', pcs: [5, 11, 4] },
    play: { label: 'PLAY THE GUIDE TONES F, B, E', kind: 'sequence', pcs: [5, 11, 4] },
    checks: [
      { q: 'Playing the changes means…', options: ['landing on the chord that is sounding', 'playing fast', 'playing only scales'], answer: 0 },
      { q: 'The changes are…', options: ['the chord progression', 'the melody', 'the drum beat'], answer: 0 },
      { q: 'Start by targeting…', options: ['the 3rds and 7ths', 'every note', 'only the root'], answer: 0 },
    ],
  },
]

export function foundationById(id) {
  return FOUNDATIONS.find((lesson) => lesson.id === id) || null
}

const STORAGE = 'mpl.foundations'

export function loadFoundations() {
  try {
    const raw = window.localStorage.getItem(STORAGE)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function markFoundation(id) {
  try {
    const done = new Set(loadFoundations())
    done.add(id)
    window.localStorage.setItem(STORAGE, JSON.stringify([...done]))
    return [...done]
  } catch {
    return []
  }
}
