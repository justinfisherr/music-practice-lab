// v4 card contract: the taught-concept pool, their strict validators, the
// deterministic selection and fallback instances, and the LLM prompt/parser.
// The model only supplies degrees plus copy; every note is derived client-side
// from keyId.
export const CARD_CONCEPTS = [
  'LAND_THE_3RD',
  'LAND_THE_5TH',
  'LAND_THE_7TH',
  'GUIDE_TONES',
  'COMP_THE_CHANGES',
  'NO_ROOTS',
  'SMALL_RANGE',
  'ONE_NOTE_SOLO',
]

// Kept in the DB/API and the card render path for runs stored before the pool.
// It is never selected for a new night.
export const LEGACY_CONCEPTS = ['TRANSCRIBE_ROOT']

// The foundation lesson that teaches each card's idea. The card links back to
// it; nothing is gated. ONE_NOTE is the legacy name for ONE_NOTE_SOLO.
export const CARD_FOUNDATION = {
  LAND_THE_3RD: 'chord-tones',
  LAND_THE_5TH: 'chord-tones',
  LAND_THE_7TH: 'sevenths',
  GUIDE_TONES: 'guide-tones',
  COMP_THE_CHANGES: 'function',
  NO_ROOTS: 'chord-tones',
  SMALL_RANGE: 'chord-tones',
  ONE_NOTE_SOLO: 'chord-tones',
}

export const CARD_STAGE_BY_CONCEPT = {
  LAND_THE_3RD: 'land_the_3rd',
  LAND_THE_5TH: 'land_the_5th',
  LAND_THE_7TH: 'land_the_7th',
  GUIDE_TONES: 'guide_tones',
  COMP_THE_CHANGES: 'comp_changes',
  NO_ROOTS: 'no_roots',
  SMALL_RANGE: 'small_range',
  ONE_NOTE_SOLO: 'one_note',
  TRANSCRIBE_ROOT: 'transcribe_root',
}

export const CARD_STAGE_IDS = CARD_CONCEPTS.map((concept) => CARD_STAGE_BY_CONCEPT[concept])
export const LEGACY_STAGE_IDS = LEGACY_CONCEPTS.map(
  (concept) => CARD_STAGE_BY_CONCEPT[concept],
)

const TURNAROUND = [1, 6, 2, 5]

export const CARD_SPECS = {
  LAND_THE_3RD: {
    stageId: 'land_the_3rd',
    kind: 'land',
    tone: 3,
    title: 'LAND THE 3RD',
    howTo:
      'One chord per bar. Play the 3rd as it lands. One note is enough. Aim for the downbeat.',
    rationale: 'the third tells you major from minor.',
    degrees: TURNAROUND,
    params: { tone: 3, degrees: TURNAROUND },
  },
  LAND_THE_5TH: {
    stageId: 'land_the_5th',
    kind: 'land',
    tone: 5,
    title: 'LAND THE 5TH',
    howTo:
      'One chord per bar. Play the 5th as it lands. One note is enough. Aim for the downbeat.',
    rationale: 'the fifth keeps the chord grounded.',
    degrees: TURNAROUND,
    params: { tone: 5, degrees: TURNAROUND },
  },
  LAND_THE_7TH: {
    stageId: 'land_the_7th',
    kind: 'land',
    tone: 7,
    title: 'LAND THE 7TH',
    howTo:
      'One chord per bar. Play the 7th as it lands. One note is enough. Aim for the downbeat.',
    rationale: 'the seventh adds color and motion.',
    degrees: TURNAROUND,
    params: { tone: 7, degrees: TURNAROUND },
  },
  GUIDE_TONES: {
    stageId: 'guide_tones',
    kind: 'sequence',
    title: 'GUIDE TONES',
    howTo:
      'Hear the four guide notes, then play the line in order. One note per chord. Go slowly.',
    rationale: 'guide tones show the harmony moving.',
    degrees: TURNAROUND,
    params: { degrees: TURNAROUND },
  },
  COMP_THE_CHANGES: {
    stageId: 'comp_changes',
    kind: 'comp',
    title: 'COMP THE CHANGES',
    howTo:
      'Play the four seventh chords in order, one per bar. Keep each chord short and even.',
    rationale: 'comping teaches the chords by feel.',
    degrees: TURNAROUND,
    params: { degrees: TURNAROUND },
  },
  NO_ROOTS: {
    stageId: 'no_roots',
    kind: 'solo',
    rule: 'noRoots',
    title: 'NO ROOTS',
    howTo:
      'Solo over the four-bar groove without touching a chord root. Four notes or more. Shape a line.',
    rationale: 'leaving out roots frees the line.',
    degrees: TURNAROUND,
    params: { degrees: TURNAROUND },
  },
  SMALL_RANGE: {
    stageId: 'small_range',
    kind: 'solo',
    rule: 'range',
    title: 'SMALL RANGE',
    howTo:
      'Solo inside the five-note range from the third to the seventh. Four notes or more. Stay in the lines.',
    rationale: 'a small range forces real melody.',
    degrees: TURNAROUND,
    params: { degrees: TURNAROUND },
  },
  ONE_NOTE_SOLO: {
    stageId: 'one_note',
    kind: 'solo',
    rule: 'oneNote',
    title: 'ONE NOTE SOLO',
    howTo:
      'Solo only on the fifth of the key. Four notes or more. Make rhythm carry the line.',
    rationale: 'one note teaches rhythm and tone.',
    degrees: TURNAROUND,
    params: { degrees: TURNAROUND },
  },
  TRANSCRIBE_ROOT: {
    stageId: 'transcribe_root',
    kind: 'transcribe',
    title: 'TRANSCRIBE THE PHRASE',
    howTo:
      'The first note is shown. Hear the four-note phrase, then play it back in order. Use reveal if you need a hint.',
    rationale: 'the first note anchors the shape.',
    degrees: [3, 6, 2, 5],
    params: { degrees: [3, 6, 2, 5] },
  },
}

// A beginner-friendly explanation shown on the card's how-to screen. This is
// catalog-authored so it is always correct, unlike a model paraphrase.
export const CARD_WHY = {
  LAND_THE_3RD:
    'The 3rd is the note that tells you whether a chord is major or minor. In jazz, landing on it makes a line sound like it belongs to the chord instead of just running a scale. You only need one note, played on the change, to make the harmony clear.',
  LAND_THE_5TH:
    'The 5th is the steady note in a chord. It sits between the root and the color tones, so it keeps a line anchored without spelling out the whole harmony. Hitting it on the change makes the chord sound settled.',
  LAND_THE_7TH:
    'The 7th is the color note: it turns a plain triad into jazz harmony. It can feel restless or warm depending on the chord, which is exactly why it points to the next change. Land on it and the harmony sounds richer.',
  GUIDE_TONES:
    'Guide tones are the 3rds and 7ths that move from chord to chord. Following just the 3rds is the simplest version: one note per chord, in order. It teaches you to hear the progression as a line instead of a stack of separate chords.',
  COMP_THE_CHANGES:
    'Comping is how a pianist plays the chords under a solo. The four seventh chords are the actual harmony of the progression, one per bar. Playing them in order trains your hands to find the changes without thinking.',
  NO_ROOTS:
    'The root is the bass player\'s job in a band. A solo that skips the roots has more room to move and avoids fighting the bass. It forces you to hear the chord by its color notes instead of leaning on the root.',
  SMALL_RANGE:
    'A narrow range makes you build a melody instead of running up and down the scale. Five notes are plenty for a strong idea. Staying inside them also trains your ear to hear each note\'s color.',
  ONE_NOTE_SOLO:
    'Playing one note makes rhythm, tone, and placement the whole story. It is harder than it sounds, and it teaches you to make a phrase without any harmonic help. When you can solo on one note, adding more is easy.',
  TRANSCRIBE_ROOT:
    'Transcription is how players build an ear: hear a phrase, then find it on your instrument. The first note gives you a place to start; the rest teaches you to hear intervals and shape. Go slowly, and check yourself after each pass.',
}

// Keep the lesson copy reachable from either catalog: specs carry it, and the
// card UI reads CARD_WHY directly.
for (const concept of Object.keys(CARD_SPECS)) {
  CARD_SPECS[concept].why = CARD_WHY[concept]
}

const LAND_CONCEPTS = new Set(['LAND_THE_3RD', 'LAND_THE_5TH', 'LAND_THE_7TH'])
const SOLO_CONCEPTS = new Set(['NO_ROOTS', 'SMALL_RANGE', 'ONE_NOTE_SOLO'])
const CORE_CONCEPTS = new Set([...LAND_CONCEPTS, 'COMP_THE_CHANGES', 'GUIDE_TONES'])

function hashSeed(text) {
  let hash = 2166136261
  const input = String(text)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function validPair([first, second]) {
  const landCount = Number(LAND_CONCEPTS.has(first)) + Number(LAND_CONCEPTS.has(second))
  if (landCount > 1) return false
  if (SOLO_CONCEPTS.has(first) && SOLO_CONCEPTS.has(second)) return false
  return CORE_CONCEPTS.has(first) || CORE_CONCEPTS.has(second)
}

// Deterministic per date + key: shuffle the eight concepts, then take the first
// pair that fits the night's rules. Same date and key always give the same pair.
export function selectConcepts(date, keyId) {
  const rng = mulberry32(hashSeed(`${date}|${keyId}`))
  const pool = [...CARD_CONCEPTS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const pair = [pool[i], pool[j]]
      if (validPair(pair)) return pair
    }
  }
  return ['LAND_THE_3RD', 'COMP_THE_CHANGES']
}

// ---- fingerprint ----------------------------------------------------------
// Pure sync SHA-256 so the browser fallback and the server recompute the same id.
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function rotr(value, bits) {
  return (value >>> bits) | (value << (32 - bits))
}

export function sha256Hex(input) {
  const bytes = new TextEncoder().encode(String(input))
  const size = ((bytes.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(size)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  const bits = bytes.length * 8
  view.setUint32(size - 8, Math.floor(bits / 0x100000000))
  view.setUint32(size - 4, bits >>> 0)

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const w = new Uint32Array(64)

  for (let offset = 0; offset < size; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
  return h.map((value) => value.toString(16).padStart(8, '0')).join('')
}

export function fingerprintFor(concept, keyId, date) {
  return sha256Hex(`${concept}|${keyId}|${date}`)
}

// ---- validation -----------------------------------------------------------
const NOTE_NAME = /\b[A-G](?:#|b)?\b/
const CHORD_SYMBOL = /(?:[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|\d))|(?:maj7?|min7?|dim7?|dom7?)\b/i
const TRAILING_PUNCT = /[.?!,:;'")\]}]$/

function cleanText(value) {
  if (typeof value !== 'string') return ''
  let clean = ''
  for (const char of value) {
    const code = char.codePointAt(0)
    clean += code < 32 || code === 127 ? ' ' : char
  }
  return clean.trim()
}

function validDegrees(degrees, { rootFirst = false } = {}) {
  if (!Array.isArray(degrees) || degrees.length !== 4) return false
  for (let i = 0; i < degrees.length; i++) {
    const degree = degrees[i]
    if (!Number.isInteger(degree) || degree < 1 || degree > 7) return false
    if (i > 0 && degrees[i - 1] === degree) return false
  }
  if (rootFirst && degrees[0] !== 1) return false
  return true
}

// Canonical card shape only: concept, title, howTo, params, rationale.
export function validateCard(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'card_missing' }
  }
  const keys = Object.keys(input).sort()
  const expected = ['concept', 'howTo', 'params', 'rationale', 'title']
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, error: 'card_fields' }
  }
  const { concept } = input
  const spec = CARD_SPECS[concept]
  if (!spec) return { ok: false, error: 'bad_concept' }

  const title = cleanText(input.title)
  if (!title || title.length > 40 || title !== title.toUpperCase() || TRAILING_PUNCT.test(title)) {
    return { ok: false, error: 'bad_title' }
  }

  const howTo = cleanText(input.howTo)
  if (!howTo || howTo.length > 240) return { ok: false, error: 'bad_how_to' }
  if (NOTE_NAME.test(howTo) || CHORD_SYMBOL.test(howTo)) return { ok: false, error: 'bad_how_to' }

  const rationale = cleanText(input.rationale)
  if (
    !rationale ||
    rationale.length > 120 ||
    rationale !== rationale.toLowerCase() ||
    rationale.includes('!')
  ) {
    return { ok: false, error: 'bad_rationale' }
  }

  const params = input.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return { ok: false, error: 'bad_params' }
  }
  const paramKeys = Object.keys(params).sort()
  if (spec.kind === 'land') {
    if (paramKeys.length !== 2 || paramKeys[0] !== 'degrees' || paramKeys[1] !== 'tone') {
      return { ok: false, error: 'bad_params' }
    }
    if (params.tone !== spec.tone) return { ok: false, error: 'bad_tone' }
  } else if (paramKeys.length !== 1 || paramKeys[0] !== 'degrees') {
    return { ok: false, error: 'bad_params' }
  }
  if (!validDegrees(params.degrees)) {
    return { ok: false, error: 'bad_degrees' }
  }

  const value =
    spec.kind === 'land'
      ? {
          concept,
          title,
          howTo,
          params: { tone: spec.tone, degrees: [...params.degrees] },
          rationale,
        }
      : { concept, title, howTo, params: { degrees: [...params.degrees] }, rationale }
  return { ok: true, value }
}

// Model output must contain exactly the expected concepts, no extras.
export function validateCards(cards, expected = null) {
  const wanted = Array.isArray(expected) ? expected : null
  const count = wanted ? wanted.length : 2
  if (!Array.isArray(cards) || cards.length !== count) return { ok: false, error: 'card_count' }
  const seen = new Set()
  const value = []
  for (const card of cards) {
    const checked = validateCard(card)
    if (!checked.ok) return checked
    if (seen.has(checked.value.concept)) return { ok: false, error: 'duplicate_concept' }
    if (wanted && !wanted.includes(checked.value.concept)) {
      return { ok: false, error: 'unexpected_concept' }
    }
    seen.add(checked.value.concept)
    value.push(checked.value)
  }
  if (wanted && wanted.some((concept) => !seen.has(concept))) {
    return { ok: false, error: 'concept_missing' }
  }
  return { ok: true, value }
}

export function fallbackCard(concept, { keyId, date }) {
  const spec = CARD_SPECS[concept]
  const card = {
    concept,
    title: spec.title,
    howTo: spec.howTo,
    params:
      spec.kind === 'land'
        ? { tone: spec.tone, degrees: [...spec.params.degrees] }
        : { degrees: [...spec.params.degrees] },
    rationale: spec.rationale,
  }
  const fingerprint = fingerprintFor(concept, keyId, date)
  return {
    ...card,
    id: fingerprint,
    fingerprint,
    keyId,
    date,
    source: 'fallback',
  }
}

// The pair the night selects, each with its deterministic instance.
export function fallbackCards({ keyId, date }) {
  return selectConcepts(date, keyId).map((concept) => fallbackCard(concept, { keyId, date }))
}

// ---- LLM prompt + strict parser ------------------------------------------
function conceptPrompt(concept) {
  const spec = CARD_SPECS[concept]
  const params =
    spec.kind === 'land'
      ? `{"tone":${spec.tone},"degrees":[4 ints 1-7]}`
      : '{"degrees":[4 ints 1-7]}'
  const description = {
    LAND_THE_3RD: 'land the chord third on each change',
    LAND_THE_5TH: 'land the chord fifth on each change',
    LAND_THE_7TH: 'land the chord seventh on each change',
    GUIDE_TONES: 'play the third of each listed chord in order',
    COMP_THE_CHANGES: 'play the listed seventh chords in order',
    NO_ROOTS: 'solo without playing any chord root',
    SMALL_RANGE: 'solo inside the five-note range from scale degree 3 to 7',
    ONE_NOTE_SOLO: 'solo only on the key fifth',
  }[concept]
  return `${concept}: ${description}. params ${params}.`
}

export function buildCardPrompt(concepts) {
  return [
    'You write two short practice cards for a jazz-minded pianist.',
    `Return a JSON object {"cards":[...]} with exactly two cards, one for each concept: ${concepts.join(' and ')}.`,
    concepts.map(conceptPrompt).join(' '),
    'Each card has exactly these keys: concept, title, how_to, params, rationale.',
    'Degrees are four integers 1-7 with no identical adjacent values.',
    'For land cards the tone is fixed by the concept; copy it into params exactly.',
    'title: 1-40 characters, UPPERCASE, no trailing punctuation.',
    'how_to: 1-240 characters, imperative, no note names and no chord symbols.',
    'rationale: 1-120 characters, lowercase, no exclamation marks.',
    'Do not include any other fields. Return ONLY the JSON object. No prose, no fences.',
  ].join(' ')
}

export function buildCardMessages({ date, keyId, concepts }) {
  const selected =
    Array.isArray(concepts) && concepts.length ? concepts : selectConcepts(date, keyId)
  return [
    { role: 'system', content: buildCardPrompt(selected) },
    { role: 'user', content: JSON.stringify({ date, keyId, concepts: selected }) },
  ]
}

// Strict: no fences, no prose, no extra fields. Anything unexpected is null.
export function parseCards(text, expected = null) {
  if (typeof text !== 'string') return null
  let parsed
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (Object.keys(parsed).length !== 1 || !Array.isArray(parsed.cards)) return null
  const cards = []
  for (const raw of parsed.cards) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const keys = Object.keys(raw).sort()
    const expectedKeys = ['concept', 'how_to', 'params', 'rationale', 'title']
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== expectedKeys[index])
    ) {
      return null
    }
    const checked = validateCard({
      concept: raw.concept,
      title: raw.title,
      howTo: raw.how_to,
      params: raw.params,
      rationale: raw.rationale,
    })
    if (!checked.ok) return null
    cards.push(checked.value)
  }
  const checked = validateCards(cards, expected)
  return checked.ok ? checked.value : null
}
