import { useEffect, useRef, useState } from 'react'
import { useNoteSequence } from '../hooks/useNoteSequence.js'
import { gradeSequence } from '../session/grade.js'
import { playChord, playCountIn, playPhrase, unlockAudio } from '../session/audio.js'
import { createTransport } from '../session/transport.js'
import { noteName } from '../data/diminishedChords.js'
import { keyDisplay } from '../data/scales.js'
import {
  chordLabel,
  chordTonePc,
  degreeRootPc,
  fifthPc,
  fiveNoteRangePcs,
  scoreComp,
  scoreLandTheThird,
  scoreSolo,
  seventhByDegree,
  soloViolates,
  thirdPc,
} from '../session/set.js'
import GrooveBar from './GrooveBar.jsx'
import PianoExample from './PianoExample.jsx'
import FoundationLink from './FoundationLink.jsx'
import { CARD_FOUNDATION, CARD_SPECS, CARD_WHY } from '../../lib/cards.js'

const BPM = 72
const ORDINAL = { 3: '3RD', 5: '5TH', 7: '7TH' }
const RULE_TEXT = {
  noRoots: 'NO CHORD ROOTS — THE CROSSED KEYS ARE OFF LIMITS.',
  range: 'FIVE NOTES ONLY — FROM THE THIRD TO THE SEVENTH.',
  oneNote: 'ONE NOTE ONLY — THE FIFTH OF THE KEY.',
}

export default function SetCard({ session, stageId, onDone, disabled, recordAttempt }) {
  const keyId = session.keyId
  const stage = session.composition.stages.find((entry) => entry.id === stageId)
  const card = stage.detail
  const spec = CARD_SPECS[card.concept] || {}
  const kind = card.kind || spec.kind || 'transcribe'
  const degrees = card.degrees || card.params?.degrees || spec.params?.degrees || []
  const tone = card.tone ?? spec.tone
  const rule = card.rule ?? spec.rule ?? null
  const isGroove = kind === 'land' || kind === 'comp' || kind === 'solo'
  const isSequence = kind === 'sequence' || kind === 'transcribe'
  const guide = card.guide || degrees.map((degree) => thirdPc(keyId, degree))
  const line =
    kind === 'transcribe'
      ? card.phrase || degrees.map((degree) => degreeRootPc(keyId, degree))
      : guide
  const chords =
    card.chords ||
    degrees.map((degree) => ({
      degree,
      pcs: seventhByDegree(keyId, degree),
      label: chordLabel(keyId, degree),
    }))
  const roots = card.roots || degrees.map((degree) => degreeRootPc(keyId, degree))
  const range = card.range || fiveNoteRangePcs(keyId)
  const targetPc = card.target ?? fifthPc(keyId)
  const soloTargets = { roots, range, targetPc }
  const cardIndex = session.composition.stages.findIndex((entry) => entry.id === stageId)
  const foundationId =
    CARD_FOUNDATION[card.concept] ||
    (card.concept === 'ONE_NOTE_SOLO' ? 'chord-tones' : null)

  const [phase, setPhase] = useState('howto')
  const [transport, setTransport] = useState(null)
  const [result, setResult] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [played, setPlayed] = useState([])
  const [armed, setArmed] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const collectedRef = useRef([])
  const playedRef = useRef([])
  const attemptsRef = useRef(0)
  const gradedRunRef = useRef(false)
  const timerRef = useRef(null)
  const transportRef = useRef(null)
  const runTokenRef = useRef(0)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  useEffect(
    () => () => {
      runTokenRef.current += 1
      if (timerRef.current) clearTimeout(timerRef.current)
      transportRef.current?.stop()
    },
    [],
  )

  useEffect(() => {
    if (!disabled) return
    if (transportRef.current?.isRunning()) {
      transportRef.current.stop()
      if (phase === 'playing') finishGroove()
      else if (phase === 'practice') setPhase('ready')
    } else if (phase === 'countin') {
      runTokenRef.current += 1
      setPhase('ready')
    }
    setArmed(false)
  }, [disabled]) // eslint-disable-line react-hooks/exhaustive-deps

  function finishGroove() {
    const running = transportRef.current
    if (!running || gradedRunRef.current) return
    gradedRunRef.current = true
    running.stop()
    const barMs = running.barMs()
    const bars = degrees.map((degree, index) => ({
      startMs: index * barMs,
      barMs,
      targetPc: chordTonePc(keyId, degree, tone),
      targetPcs: seventhByDegree(keyId, degree),
    }))
    let scored
    if (kind === 'land') scored = scoreLandTheThird(bars, collectedRef.current)
    else if (kind === 'comp') scored = scoreComp(bars, collectedRef.current)
    else scored = scoreSolo(rule, collectedRef.current, soloTargets)
    const nextAttempts = attemptsRef.current + 1
    attemptsRef.current = nextAttempts
    setAttempts(nextAttempts)
    recordAttempt(stageId, !scored.passed)
    setResult({ ...scored, kind, rule })
    setPhase('result')
  }

  async function runGroove(graded) {
    const token = ++runTokenRef.current
    transportRef.current?.stop()
    collectedRef.current = []
    setPlayed([])
    setTransport(null)
    gradedRunRef.current = false
    setPhase('countin')
    await playCountIn(BPM)
    if (token !== runTokenRef.current || disabledRef.current) return
    const next = createTransport({
      keyId,
      bpm: BPM,
      degrees,
      onEnd: () => {
        if (graded) finishGroove()
        else setPhase('ready')
      },
    })
    transportRef.current = next
    setTransport(next)
    setPhase(graded ? 'playing' : 'practice')
    await next.start()
  }

  function hearLine() {
    unlockAudio()
    setPlayed([])
    playedRef.current = []
    setArmed(false)
    playPhrase(line, { gap: 0.45 })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setArmed(true), line.length * 450 + 350)
  }

  function gradeLine(notes) {
    const diff = gradeSequence(line, notes)
    const nextAttempts = attemptsRef.current + 1
    attemptsRef.current = nextAttempts
    setAttempts(nextAttempts)
    recordAttempt(stageId, !diff.passed)
    setResult({ ...diff, kind })
    setArmed(false)
    setPhase('result')
    if (!diff.passed) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (disabledRef.current) return
        setResult(null)
        setPlayed([])
        playedRef.current = []
        setPhase('attempt')
        hearLine()
      }, 1200)
    }
  }

  function handleLineNote(pc) {
    if (disabled || !armed) return
    const next = [...playedRef.current, pc]
    playedRef.current = next
    setPlayed(next)
    if (next.length >= line.length) {
      if (phase === 'practice') {
        setArmed(false)
        setPhase('ready')
      } else gradeLine(next)
    }
  }

  function handleLineSilence() {
    if (disabled || !armed || !playedRef.current.length) return
    if (phase === 'practice') {
      setArmed(false)
      setPlayed([])
      playedRef.current = []
      setPhase('ready')
    } else gradeLine(playedRef.current)
  }

  useNoteSequence({
    active: isGroove && (phase === 'playing' || phase === 'practice') && !disabled,
    allowRepeats: kind === 'solo',
    onNote: (pc) => {
      const at = transportRef.current?.elapsedMs() || 0
      collectedRef.current.push({ pc, at })
      if (kind === 'solo' || kind === 'comp') setPlayed((prev) => [...prev, pc])
    },
    onSilence: () => {},
  })

  useNoteSequence({
    active:
      isSequence && armed && (phase === 'attempt' || phase === 'practice') && !disabled,
    allowRepeats: kind === 'sequence',
    onNote: handleLineNote,
    onSilence: handleLineSilence,
  })

  function retry() {
    setRevealed(0)
    setResult(null)
    setPlayed([])
    playedRef.current = []
    if (isGroove) {
      void runGroove(true)
    } else {
      setPhase('attempt')
      hearLine()
    }
  }

  function done() {
    const hits = result?.hits ?? 0
    onDone({
      concept: card.concept,
      kind,
      attempts: attemptsRef.current,
      passed: result?.passed === true,
      hits,
      combo: result?.combo ?? 0,
      total: result?.total ?? null,
      rule,
      timingBonus: Array.isArray(result?.rows)
        ? result.rows.reduce((sum, row) => sum + (row.timingBonus || 0), 0)
        : 0,
    })
  }

  function startAttempt() {
    setRevealed(0)
    setResult(null)
    setPlayed([])
    if (isGroove) {
      void runGroove(true)
    } else {
      setPhase('attempt')
      hearLine()
    }
  }

  function startPractice() {
    unlockAudio()
    setResult(null)
    setPlayed([])
    if (isGroove) {
      void runGroove(false)
    } else {
      setPhase('practice')
      hearLine()
    }
  }

  function playChanges() {
    unlockAudio()
    chords.forEach((chord, index) => {
      setTimeout(() => playChord(chord.pcs), index * 650)
    })
  }

  function hearTutorial() {
    unlockAudio()
    if (kind === 'land') {
      const degree = degrees[0] ?? 1
      playChord(seventhByDegree(keyId, degree))
      setTimeout(
        () => playPhrase([chordTonePc(keyId, degree, tone)], { gap: 0.2 }),
        520,
      )
    } else if (isSequence) {
      playPhrase(line, { gap: 0.45 })
    } else {
      playChanges()
    }
  }

  function verdict() {
    if (!result) return ''
    if (kind === 'land') {
      return `${result.hits} OF 4 BARS LANDED.${result.passed ? ' CARD CLEAR.' : ' TWO BARS IS THE PASS.'}`
    }
    if (kind === 'comp') {
      return `${result.hits} OF 4 CHORDS.${result.passed ? ' CARD CLEAR.' : ' TWO CHORDS IS THE PASS.'}`
    }
    if (kind === 'solo') {
      if (result.passed) return `${result.total} NOTES, NO RULE BREAKS. CARD PASSED.`
      if (result.total < 4) return `${result.total} NOTES. PLAY AT LEAST FOUR. TRY AGAIN.`
      return `${result.total} NOTES. A NOTE BROKE THE RULE. TRY AGAIN.`
    }
    return result.passed
      ? 'LINE CLEAR. CARD PASSED.'
      : `${result.rows.filter((row) => row.status === 'match').length} OF ${line.length}. TRY AGAIN.`
  }

  const demoDegree = degrees[0] ?? 1
  const demoChord = seventhByDegree(keyId, demoDegree)
  const demoTone = chordTonePc(keyId, demoDegree, tone)
  const soloPcs = rule === 'range' ? range : rule === 'oneNote' ? [targetPc] : roots
  const crossPcs = rule === 'noRoots' ? roots : []

  return (
    <div className="stagecard setcard">
      <div className="stagehead">
        <span className="stagehead__eyebrow">
          CARD {Math.max(1, cardIndex)} OF 2 · {keyDisplay(keyId)} MAJOR · T3
        </span>
        <h2 className="stagehead__title">{card.title}</h2>
        <p className="stagehead__copy">{card.howTo}</p>
      </div>

      {phase === 'howto' && foundationId ? <FoundationLink id={foundationId} /> : null}

      {phase === 'countin' ? (
        <p className="countin" aria-live="polite">
          COUNT IN · 4 BEATS
        </p>
      ) : null}

      {kind === 'transcribe' ? (
        <div className="rootanchor" aria-label="The first note">
          <span className="rootanchor__label">FIRST NOTE</span>
          <span className="rootanchor__note">{noteName(line[0])}</span>
          <span className="rootanchor__sub">THE PHRASE STARTS HERE</span>
        </div>
      ) : null}

      {phase === 'howto' ? (
        <>
          <div className="cardtutorial">
            <span className="pianoexample__label">EXAMPLE</span>
            {kind === 'land' ? (
              <div className="barrow">
                <div className="barrow__head">
                  <span className="barrow__label">{chordLabel(keyId, demoDegree)}</span>
                  <span className="barrow__third">
                    {ORDINAL[tone] || '3RD'} · {noteName(demoTone)}
                  </span>
                </div>
                <PianoExample
                  pcs={demoChord}
                  accentPc={demoTone}
                  label={`${chordLabel(keyId, demoDegree)}, target ${noteName(demoTone)}`}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={hearTutorial}
                  disabled={disabled}
                >
                  HEAR IT
                </button>
              </div>
            ) : null}

            {isSequence ? (
              <div className="barrow">
                <div className="barrow__head">
                  <span className="barrow__label">
                    {kind === 'transcribe' ? 'EXAMPLE PHRASE' : 'GUIDE LINE · 3RDS IN ORDER'}
                  </span>
                </div>
                <PianoExample
                  pcs={line}
                  accentPc={line[0]}
                  label={kind === 'transcribe' ? 'Example phrase' : 'The four guide notes'}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={hearTutorial}
                  disabled={disabled}
                >
                  HEAR IT
                </button>
              </div>
            ) : null}

            {kind === 'comp'
              ? chords.map((chord, index) => (
                  <div className="barrow" key={`${chord.degree}-${index}`}>
                    <div className="barrow__head">
                      <span className="barrow__label">
                        CHORD {index + 1} · {chord.label}
                      </span>
                    </div>
                    <PianoExample
                      pcs={chord.pcs}
                      accentPc={chord.pcs[0]}
                      label={`${chord.label} seventh chord`}
                    />
                  </div>
                ))
              : null}

            {kind === 'comp' ? (
              <button
                type="button"
                className="btn"
                onClick={hearTutorial}
                disabled={disabled}
              >
                HEAR IT
              </button>
            ) : null}

            {kind === 'solo' ? (
              <div className="barrow">
                <div className="barrow__head">
                  <span className="barrow__label">
                    {rule === 'noRoots'
                      ? 'ALLOWED — ANY NOTE BUT THE CROSSED ROOTS'
                      : rule === 'range'
                        ? 'ALLOWED — THE FIVE KEYED NOTES'
                        : `ALLOWED — ${noteName(targetPc)} ONLY`}
                  </span>
                </div>
                <PianoExample
                  pcs={soloPcs}
                  accentPc={rule === 'oneNote' ? targetPc : null}
                  crossPcs={crossPcs}
                  label="The solo rule on the keyboard"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={hearTutorial}
                  disabled={disabled}
                >
                  HEAR IT
                </button>
                <p className="hintline">{RULE_TEXT[rule]}</p>
              </div>
            ) : null}
          </div>

          <div className="modulewhy">
            <span className="modulewhy__label">WHY IT MATTERS</span>
            <span>{card.why || CARD_WHY[card.concept]}</span>
          </div>
          {card.rationale ? <p className="hintline">TODAY: {card.rationale}</p> : null}
          <div className="stagefoot">
            <button
              type="button"
              className="btn btn--signal"
              onClick={startPractice}
              disabled={disabled}
            >
              FREE PRACTICE REP
            </button>
            <button type="button" className="btn" onClick={startAttempt} disabled={disabled}>
              GO TO THE ATTEMPT
            </button>
          </div>
          <p className="hintline">The free rep is not graded. The attempt is.</p>
        </>
      ) : null}

      {(phase === 'practice' || phase === 'playing') && isGroove ? (
        <>
          <GrooveBar
            transport={transport}
            keyId={keyId}
            disabled={disabled}
            onStop={() => {
              if (phase === 'playing') finishGroove()
              else {
                transportRef.current?.stop()
                setPhase('ready')
              }
            }}
          />
          <p className="hintline">
            {phase === 'playing'
              ? kind === 'land'
                ? `PLAY THE ${ORDINAL[tone] || '3RD'} AS EACH CHORD LANDS. ONE NOTE IS ENOUGH.`
                : kind === 'comp'
                  ? 'PLAY EACH CHORD AS IT LANDS. FOUR NOTES PER BAR.'
                  : `PLAY THE RULE. ${RULE_TEXT[rule] || ''}`
              : 'FREE REP — NOT GRADED. LISTEN TO THE GROOVE.'}
          </p>
          {kind === 'solo' && played.length ? (
            <div className="notecells" aria-label="Notes played so far">
              {played.slice(-8).map((pc, index) => {
                const bad = soloViolates(rule, pc, soloTargets)
                return (
                  <div
                    className={`notecell ${bad ? 'is-off' : 'is-match'}`}
                    key={`${pc}-${index}`}
                  >
                    <span className="notecell__index">{index + 1}</span>
                    <span className="notecell__note">{noteName(pc)}</span>
                    <span className="notecell__mark">{bad ? 'OFF' : 'OK'}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
          {kind === 'comp' && played.length ? (
            <p className="hintline">{played.length} NOTES PLAYED. KEEP EACH CHORD EVEN.</p>
          ) : null}
        </>
      ) : null}

      {phase === 'practice' && isSequence ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn" onClick={hearLine} disabled={disabled}>
              HEAR IT AGAIN
            </button>
          </div>
          <p className="hintline">PLAY IT BACK ONCE. NOTHING IS GRADED.</p>
        </>
      ) : null}

      {phase === 'ready' ? (
        <div className="stagefoot">
          <button type="button" className="btn btn--signal" onClick={startAttempt} disabled={disabled}>
            {isGroove ? 'TAKE THE ATTEMPT · 4 BARS' : 'TAKE THE ATTEMPT'}
          </button>
        </div>
      ) : null}

      {phase === 'playing' ? (
        <p className="hintline">FOUR BARS. THE DOWNBEAT IS THE TARGET WINDOW.</p>
      ) : null}

      {phase === 'attempt' ? (
        <>
          <div className="stagefoot">
            <button type="button" className="btn" onClick={hearLine} disabled={disabled}>
              {kind === 'transcribe' ? 'HEAR THE PHRASE' : 'HEAR THE LINE'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setRevealed((n) => Math.min(line.length, n + 1))}
              disabled={disabled || revealed >= line.length}
            >
              REVEAL NEXT
            </button>
          </div>
          <p className="hintline">
            {armed ? 'YOUR TURN — PLAY THE NOTES IN ORDER.' : 'LISTEN, THEN PLAY IT BACK.'}
          </p>
          <div className="notecells" aria-label="Line notes">
            {line.map((pc, index) => {
              const playedPc = played[index]
              const correct = playedPc != null && playedPc === pc
              const wrong = playedPc != null && playedPc !== pc
              const shown = correct || (playedPc == null && (index === 0 || index < revealed))
              return (
                <div
                  className={`notecell ${playedPc == null ? 'is-pending' : correct ? 'is-match' : 'is-off'}`}
                  key={index}
                >
                  <span className="notecell__index">{index + 1}</span>
                  <span className="notecell__note">
                    {shown ? noteName(pc) : wrong ? noteName(playedPc) : '·'}
                  </span>
                  <span className="notecell__mark">
                    {correct
                      ? 'HIT'
                      : wrong
                        ? 'OFF'
                        : index === 0
                          ? kind === 'transcribe'
                            ? 'ROOT'
                            : 'START'
                          : index < revealed
                            ? 'HINT'
                            : 'PLAY'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      {phase === 'result' && result ? (
        <>
          <p className={`verdictline ${result.passed ? 'verdictline--ok' : 'verdictline--bad'}`}>
            {verdict()}
          </p>
          <p className="hintline">
            {attempts} ATTEMPT{attempts === 1 ? '' : 'S'} · {card.source === 'llm' ? 'LLM CARD' : 'STANDARD CARD'}
          </p>
          <div className="pianoexample">
            {kind === 'land' ? (
              <>
                <span className="pianoexample__label">HOW EACH BAR SHOULD SOUND</span>
                {degrees.map((degree, index) => {
                  const chord = seventhByDegree(keyId, degree)
                  const target = chordTonePc(keyId, degree, tone)
                  return (
                    <div className="barrow" key={`${degree}-${index}`}>
                      <div className="barrow__head">
                        <span className="barrow__label">
                          BAR {index + 1} · {chordLabel(keyId, degree)}
                        </span>
                        <span className="barrow__third">
                          {ORDINAL[tone] || '3RD'} · {noteName(target)}
                        </span>
                      </div>
                      <PianoExample
                        pcs={chord}
                        accentPc={target}
                        label={`${chordLabel(keyId, degree)}, target ${noteName(target)}`}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          unlockAudio()
                          playChord(chord)
                          setTimeout(() => playPhrase([target], { gap: 0.2 }), 520)
                        }}
                        disabled={disabled}
                      >
                        HEAR THE TONE
                      </button>
                    </div>
                  )
                })}
              </>
            ) : null}

            {kind === 'comp'
              ? chords.map((chord, index) => (
                  <div className="barrow" key={`${chord.degree}-${index}`}>
                    <div className="barrow__head">
                      <span className="barrow__label">
                        BAR {index + 1} · {chord.label}
                      </span>
                    </div>
                    <PianoExample
                      pcs={chord.pcs}
                      accentPc={chord.pcs[0]}
                      label={`${chord.label} seventh chord`}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        unlockAudio()
                        playChord(chord.pcs)
                      }}
                      disabled={disabled}
                    >
                      HEAR THE CHORD
                    </button>
                  </div>
                ))
              : null}

            {kind === 'solo' ? (
              <>
                <span className="pianoexample__label">
                  THE RULE ·{' '}
                  {rule === 'noRoots'
                    ? 'NO CHORD ROOTS'
                    : rule === 'range'
                      ? 'THE FIVE-NOTE RANGE'
                      : `ONE NOTE · ${noteName(targetPc)}`}
                </span>
                <PianoExample
                  pcs={soloPcs}
                  accentPc={rule === 'oneNote' ? targetPc : null}
                  crossPcs={crossPcs}
                  label="The solo rule on the keyboard"
                />
                <button type="button" className="btn" onClick={hearTutorial} disabled={disabled}>
                  HEAR IT
                </button>
              </>
            ) : null}

            {isSequence ? (
              <>
                <span className="pianoexample__label">
                  THE LINE{lineLabel(kind)} · STARTS ON {noteName(line[0])}
                </span>
                <PianoExample pcs={line} accentPc={line[0]} label="The target line" />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    unlockAudio()
                    playPhrase(line, { gap: 0.45 })
                  }}
                  disabled={disabled}
                >
                  HEAR IT
                </button>
              </>
            ) : null}
          </div>
          <div className="stagefoot">
            <button type="button" className="btn btn--signal" onClick={done}>
              {result.passed ? 'CONTINUE' : 'MOVE ON'}
            </button>
            <button type="button" className="btn" onClick={retry} disabled={disabled}>
              TRY AGAIN
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function lineLabel(kind) {
  return kind === 'transcribe' ? ' · FIRST NOTE ANCHOR' : ' · 3RDS IN ORDER'
}
