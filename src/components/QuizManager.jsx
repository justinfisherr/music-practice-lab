import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { CHORD_TYPES, DEFAULT_TYPE_ID, buildChord } from '../data/chordTypes.js'
import { NOTE_NAMES } from '../data/diminishedChords.js'
import {
  QUIZZES_KEY,
  newQuiz,
  newItemId,
  blankItem,
} from '../data/quizzes.js'

// QUIZZES tab: build, name, edit and delete custom chord quizzes. Playing them
// happens on the DRILLS tab, which reads the same localStorage list.
export default function QuizManager() {
  const [quizzes, setQuizzes] = useLocalStorage(QUIZZES_KEY, [])
  const [draft, setDraft] = useState(null) // the quiz currently being edited

  function startNew() {
    setDraft(newQuiz())
  }

  function edit(quiz) {
    // Deep-ish copy so edits don't mutate stored state until SAVE.
    setDraft({ ...quiz, items: quiz.items.map((it) => ({ ...it })) })
  }

  function remove(id) {
    setQuizzes((prev) => prev.filter((q) => q.id !== id))
    if (draft?.id === id) setDraft(null)
  }

  function save() {
    const clean = { ...draft, name: draft.name.trim() || 'UNTITLED QUIZ' }
    setQuizzes((prev) => {
      const i = prev.findIndex((q) => q.id === clean.id)
      if (i >= 0) {
        const copy = [...prev]
        copy[i] = clean
        return copy
      }
      return [...prev, clean]
    })
    setDraft(null)
  }

  if (draft) {
    return (
      <QuizEditor
        draft={draft}
        setDraft={setDraft}
        onSave={save}
        onCancel={() => setDraft(null)}
      />
    )
  }

  return (
    <div className="qm">
      <div className="tracker__bar">
        <button type="button" className="btn btn--add" onClick={startNew}>
          + NEW QUIZ
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty">NO QUIZZES YET. BUILD ONE — E.G. "ALL MAJOR CHORDS".</div>
      ) : (
        <ul className="itemlist">
          {quizzes.map((q) => (
            <li key={q.id} className="item quizrow">
              <div className="quizrow__meta">
                <span className="quizrow__name">{q.name || 'UNTITLED QUIZ'}</span>
                <span className="quizrow__count">
                  {q.items.length} CHORD{q.items.length === 1 ? '' : 'S'}
                </span>
              </div>
              <div className="quizrow__btns">
                <button type="button" className="btn btn--ghost" onClick={() => edit(q)}>
                  EDIT
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => remove(q.id)}>
                  DELETE
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">PLAY A QUIZ FROM THE DRILLS TAB — PICK IT UNDER "DRILL".</p>
    </div>
  )
}

function QuizEditor({ draft, setDraft, onSave, onCancel }) {
  const [bulkType, setBulkType] = useState(DEFAULT_TYPE_ID)

  function setName(name) {
    setDraft((d) => ({ ...d, name }))
  }
  function updateItem(id, patch) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
  }
  function addItem() {
    setDraft((d) => ({ ...d, items: [...d.items, blankItem()] }))
  }
  function removeItem(id) {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }))
  }
  function addAllRoots(typeId) {
    const rows = Array.from({ length: 12 }, (_, root) => ({
      id: newItemId(),
      root,
      typeId,
      label: '',
    }))
    setDraft((d) => ({ ...d, items: [...d.items, ...rows] }))
  }

  return (
    <div className="qm">
      <label className="qm__field">
        <span className="picker__legend">QUIZ NAME</span>
        <input
          className="addbar__input"
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="E.G. MAJOR CHORDS, ii-V-I POOL…"
        />
      </label>

      <fieldset className="picker">
        <legend className="picker__legend">QUICK ADD — ALL 12 ROOTS</legend>
        <div className="qm__bulk">
          <select
            className="select"
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value)}
          >
            {CHORD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--add" onClick={() => addAllRoots(bulkType)}>
            ADD ALL 12
          </button>
        </div>
      </fieldset>

      {draft.items.length === 0 ? (
        <div className="empty">NO CHORDS. ADD ONE BELOW.</div>
      ) : (
        <ul className="itemlist">
          {draft.items.map((it, idx) => {
            const chord = buildChord(it.root, it.typeId)
            return (
              <li key={it.id} className="item qmitem">
                <span className="qmitem__idx">{idx + 1}</span>
                <select
                  className="select qmitem__sel"
                  value={it.root}
                  onChange={(e) => updateItem(it.id, { root: Number(e.target.value) })}
                  aria-label="Root note"
                >
                  {NOTE_NAMES.map((n, pc) => (
                    <option key={pc} value={pc}>
                      {n}
                    </option>
                  ))}
                </select>
                <select
                  className="select qmitem__sel"
                  value={it.typeId}
                  onChange={(e) => updateItem(it.id, { typeId: e.target.value })}
                  aria-label="Chord type"
                >
                  {CHORD_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  className="addbar__input qmitem__label"
                  value={it.label}
                  onChange={(e) => updateItem(it.id, { label: e.target.value })}
                  placeholder={`LABEL (OPTIONAL) — DEFAULTS TO ${chord.name}`}
                />
                <span className="qmitem__chord">{chord.name}</span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => removeItem(it.id)}
                  aria-label="Remove chord"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="qm__actions">
        <button type="button" className="btn btn--add" onClick={addItem}>
          + ADD CHORD
        </button>
        <div className="qm__actions-right">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            CANCEL
          </button>
          <button type="button" className="btn" onClick={onSave}>
            SAVE QUIZ
          </button>
        </div>
      </div>
    </div>
  )
}
