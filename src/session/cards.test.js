import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CARD_CONCEPTS,
  CARD_SPECS,
  CARD_STAGE_IDS,
  LEGACY_CONCEPTS,
  fallbackCard,
  fallbackCards,
  fingerprintFor,
  parseCards,
  selectConcepts,
  sha256Hex,
  validateCard,
} from '../../lib/cards.js'

const METa = { keyId: 'C', date: '2026-11-02' }

function cardValue(card) {
  return {
    concept: card.concept,
    title: card.title,
    howTo: card.howTo,
    params: card.params,
    rationale: card.rationale,
  }
}

test('sha256 is stable and matches the known abc vector', () => {
  assert.equal(
    sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
  assert.equal(fingerprintFor('LAND_THE_3RD', 'C', '2026-11-02').length, 64)
})

test('fallback cards are the selected pair, valid, and deterministic', () => {
  const cards = fallbackCards(METa)
  const selected = selectConcepts(METa.date, METa.keyId)
  assert.equal(cards.length, 2)
  assert.deepEqual(
    cards.map((card) => card.concept),
    selected,
  )
  assert.deepEqual(
    cards.map((card) => card.fingerprint),
    selected.map((concept) => fingerprintFor(concept, METa.keyId, METa.date)),
  )
  for (const card of cards) {
    const value = cardValue(card)
    const checked = validateCard(value)
    assert.equal(checked.ok, true, `${card.concept}: ${checked.error}`)
    assert.equal(card.source, 'fallback')
  }
})

test('every catalog concept has a valid fallback instance', () => {
  for (const concept of [...CARD_CONCEPTS, ...LEGACY_CONCEPTS]) {
    const card = fallbackCard(concept, METa)
    const checked = validateCard(cardValue(card))
    assert.equal(checked.ok, true, `${concept}: ${checked.error}`)
    assert.equal(CARD_SPECS[concept].stageId.length > 0, true, concept)
  }
})

test('selectConcepts is stable and obeys the night rules', () => {
  const land = new Set(['LAND_THE_3RD', 'LAND_THE_5TH', 'LAND_THE_7TH'])
  const solo = new Set(['NO_ROOTS', 'SMALL_RANGE', 'ONE_NOTE_SOLO'])
  const core = new Set([...land, 'COMP_THE_CHANGES', 'GUIDE_TONES'])
  const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F']
  for (let day = 1; day <= 28; day++) {
    for (const keyId of keys) {
      const date = `2026-11-${String(day).padStart(2, '0')}`
      const first = selectConcepts(date, keyId)
      assert.deepEqual(first, selectConcepts(date, keyId), `${date} ${keyId}`)
      assert.equal(first.length, 2)
      assert.equal(new Set(first).size, 2)
      assert.equal(first.filter((concept) => land.has(concept)).length <= 1, true)
      assert.equal(first.filter((concept) => solo.has(concept)).length <= 1, true)
      assert.equal(first.some((concept) => core.has(concept)), true)
      assert.equal(first.some((concept) => LEGACY_CONCEPTS.includes(concept)), false)
    }
  }
})

test('validateCard rejects bad degrees, params, and copy', () => {
  const base = {
    concept: 'LAND_THE_3RD',
    title: 'LAND THE 3RD',
    howTo: 'One chord per bar. Play the third as it lands.',
    params: { tone: 3, degrees: [1, 6, 2, 5] },
    rationale: 'the third tells you major from minor.',
  }
  assert.equal(validateCard(base).ok, true)
  assert.equal(validateCard({ ...base, params: { tone: 3, degrees: [1, 1, 2, 5] } }).ok, false)
  assert.equal(validateCard({ ...base, params: { tone: 3, degrees: [1, 2, 3] } }).ok, false)
  assert.equal(validateCard({ ...base, params: { tone: 3, degrees: [0, 2, 3, 4] } }).ok, false)
  assert.equal(validateCard({ ...base, params: { tone: 5, degrees: [1, 6, 2, 5] } }).ok, false)
  assert.equal(validateCard({ ...base, params: { degrees: [1, 6, 2, 5] } }).ok, false)
  assert.equal(
    validateCard({
      ...base,
      concept: 'GUIDE_TONES',
      params: { degrees: [2, 3, 5, 6] },
    }).ok,
    true,
  )
  assert.equal(
    validateCard({
      ...base,
      concept: 'NO_ROOTS',
      params: { degrees: [1, 6, 2, 5], rule: 'noRoots' },
    }).ok,
    false,
  )
  assert.equal(
    validateCard({ ...base, params: { tone: 3, degrees: [1, 2, 3, 4], extra: 1 } }).ok,
    false,
  )
  assert.equal(validateCard({ ...base, title: 'Land the 3rd' }).ok, false)
  assert.equal(validateCard({ ...base, title: 'LAND THE 3RD.' }).ok, false)
  assert.equal(validateCard({ ...base, howTo: 'Play the C then the G.' }).ok, false)
  assert.equal(validateCard({ ...base, howTo: 'Play the Gmaj7 chord.' }).ok, false)
  assert.equal(validateCard({ ...base, rationale: 'This is the point!' }).ok, false)
  assert.equal(validateCard({ ...base, rationale: 'The third tells you.' }).ok, false)
  assert.equal(validateCard({ ...base, extra: 'nope' }).ok, false)
})

test('parseCards accepts the selected pair and rejects fences or extra fields', () => {
  const selected = selectConcepts(METa.date, METa.keyId)
  const cards = selected.map((concept) => {
    const card = fallbackCard(concept, METa)
    return {
      concept: card.concept,
      title: card.title,
      how_to: card.howTo,
      params: card.params,
      rationale: card.rationale,
    }
  })
  const clean = JSON.stringify({ cards })
  const parsed = parseCards(clean, selected)
  assert.equal(parsed.length, 2)
  assert.deepEqual(
    parsed.map((card) => card.concept),
    selected,
  )

  assert.equal(parseCards(`\`\`\`json\n${clean}\n\`\`\``, selected), null)
  const extra = JSON.parse(clean)
  extra.cards[0].tier = 3
  assert.equal(parseCards(JSON.stringify(extra), selected), null)
  const missing = JSON.parse(clean)
  missing.cards.pop()
  assert.equal(parseCards(JSON.stringify(missing), selected), null)
  const duplicate = JSON.parse(clean)
  duplicate.cards[1].concept = duplicate.cards[0].concept
  assert.equal(parseCards(JSON.stringify(duplicate), selected), null)
  assert.equal(parseCards(clean.replace('"cards"', '"tracks"'), selected), null)

  const unexpected = JSON.parse(clean)
  unexpected.cards[0].concept = CARD_CONCEPTS.find((concept) => !selected.includes(concept))
  assert.equal(parseCards(JSON.stringify(unexpected), selected), null)
})

test('card stage ids are the v4 session contract', () => {
  assert.deepEqual(CARD_STAGE_IDS, [
    'land_the_3rd',
    'land_the_5th',
    'land_the_7th',
    'guide_tones',
    'comp_changes',
    'no_roots',
    'small_range',
    'one_note',
  ])
})
