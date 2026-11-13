// Server-side tune analysis: the chart prompt and the strict parse of what the
// model returns. Parsing is conservative — a dropped chord shifts every bar,
// so one bad chord rejects the whole chart.

export const TUNE_PROMPT = [
  'You chart the chord changes of a jazz standard for a pianist comping from a lead sheet.',
  'Return ONLY a JSON object with keys known, key, mode, tempo, chords.',
  'known: true only when you are confident these are the real changes of a well-known standard; otherwise false.',
  'key: the tonic as a note name ("Bb", "F#"). mode: "major" or "minor".',
  'tempo: the usual tempo as an integer BPM.',
  'chords: 4 to 16 entries in playing order, one chord per bar.',
  'Each chord is {"root":"Bb","quality":"maj7"} with root a note name and quality exactly one of',
  'maj7, min7, dom7, halfDim, dim7, maj, min, dim.',
  'No prose, no markdown fences.',
].join(' ')

// 12 pitch classes, written with the spellings a lead sheet uses.
export const ROOTS = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
}

// The eight qualities the grid knows, as semitones above the root.
export const QUALITY_INTERVALS = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  halfDim: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
}

// Key names the way a lead sheet writes them, for the hint sent to the model.
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function noteName(pc) {
  return NAMES[((pc % 12) + 12) % 12]
}

const ROOT_PATTERN = /^[A-Ga-g][#b♯♭]?$/

export function rootPc(value) {
  if (typeof value !== 'string' || !ROOT_PATTERN.test(value)) return null
  const key = value.toLowerCase().replace('♯', '#').replace('♭', 'b')
  const pc = ROOTS[key]
  return Number.isInteger(pc) ? pc : null
}

export function qualityPcs(pc, quality) {
  const intervals = QUALITY_INTERVALS[quality]
  if (!intervals) return null
  return [...new Set(intervals.map((step) => (pc + step) % 12))].sort((a, b) => a - b)
}

// Spotify strings reach a model, so drop control characters and cap the length.
function clean(value) {
  let text = ''
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0)
    text += code < 32 || code === 127 ? ' ' : char
  }
  return text.slice(0, 120).trim()
}

export function buildTuneMessages({ title, artist, album, keyHint = null, tempoHint = null }) {
  return [
    { role: 'system', content: TUNE_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        title: clean(title),
        artist: clean(artist),
        album: clean(album),
        key: keyHint,
        tempo: tempoHint,
      }),
    },
  ]
}

function parseKey(root, mode) {
  const pc = rootPc(root)
  if (pc == null) return null
  if (mode == null) return { pc, mode: 'major' }
  if (mode !== 'major' && mode !== 'minor') return null
  return { pc, mode }
}

// Returns { known, chords, tempo, key } or null. Chords are strict; key and
// tempo are best-effort, so a missing tempo costs the tempo and nothing else.
export function parseTune(text) {
  if (typeof text !== 'string') return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  let parsed
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (typeof parsed.known !== 'boolean') return null
  if (!Array.isArray(parsed.chords) || parsed.chords.length < 4 || parsed.chords.length > 16) {
    return null
  }

  const chords = []
  for (const chord of parsed.chords) {
    if (!chord || typeof chord !== 'object' || Array.isArray(chord)) return null
    const pc = rootPc(chord.root)
    if (pc == null) return null
    const pcs = qualityPcs(pc, chord.quality)
    if (!pcs) return null
    chords.push({ pc, quality: chord.quality, pcs })
  }

  const bpm =
    Number.isFinite(parsed.tempo) && parsed.tempo >= 40 && parsed.tempo <= 300
      ? Math.round(parsed.tempo)
      : null

  return {
    known: parsed.known,
    chords,
    tempo: bpm,
    key: parsed.key == null ? null : parseKey(parsed.key, parsed.mode),
  }
}
