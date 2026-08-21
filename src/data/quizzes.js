import { buildChord, DEFAULT_TYPE_ID } from './chordTypes.js'
import { randomItem } from './diminishedChords.js'

// A "quiz" is a user-defined pool of chords to be drilled, saved to
// localStorage. Shape:
//   { id, name, items: [{ id, root, typeId, label }] }
// `label` is optional free text (e.g. "Dm — ii of C major"); when present it's
// what the player sees as the big prompt, with the chord spelled out beneath.
export const QUIZZES_KEY = 'mpl.quizzes'

const rand = () => Math.random().toString(36).slice(2, 6)
export const newQuizId = () => `q_${Date.now().toString(36)}_${rand()}`
export const newItemId = () => `i_${Date.now().toString(36)}_${rand()}`

export function blankItem() {
  return { id: newItemId(), root: 0, typeId: DEFAULT_TYPE_ID, label: '' }
}

export function newQuiz() {
  return { id: newQuizId(), name: '', items: [blankItem()] }
}

// Only quizzes with at least one chord are playable.
export function isPlayable(quiz) {
  return (quiz?.items?.length ?? 0) > 0
}

// Turn a saved quiz into a drill the MIDI trainer engine understands. The engine
// is generic over drills: it collects `notesToCollect` unique pitch classes and
// asks `generate()` for the next question. Custom quizzes mix triads and 7ths,
// so each question carries its own `notesToCollect`.
export function quizToDrill(quiz) {
  const items = quiz.items ?? []
  return {
    id: `quiz:${quiz.id}`,
    label: quiz.name?.trim() || 'UNTITLED QUIZ',
    blurb: `${items.length} chord${items.length === 1 ? '' : 's'}. Play the named chord. Any octave, any inversion.`,
    notesToCollect: 4,
    isCustom: true,
    itemCount: items.length,
    generate(prevQuestion) {
      if (items.length === 0) {
        return { promptLabel: 'PLAY', promptValue: '—', expected: [], expectedNotes: [], notesToCollect: 4 }
      }
      const item = randomItem(items.map((it) => ({ ...it, name: it.id })), prevQuestion?.itemId)
      const chord = buildChord(item.root, item.typeId)
      const label = (item.label || '').trim() || chord.name
      return {
        itemId: item.id,
        promptLabel: 'PLAY',
        promptValue: label,
        subtitle: `CHORD ${chord.notes.join(' · ')}`,
        expected: chord.pitchClasses,
        expectedNotes: chord.notes,
        notesToCollect: chord.notesToCollect,
      }
    },
  }
}
