import { useEffect, useMemo, useState } from 'react'
import { useMidiContext } from '../hooks/MidiContext.jsx'
import { useNowPlaying } from '../hooks/useNowPlaying.js'
import { analyzeNotes } from '../data/chordDictionary.js'
import { analyzeFunction } from '../data/chordFunction.js'
import { keyById, MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import { buildTuneView, keyLabel } from '../data/tuneChords.js'
import { unlockAudio } from '../session/audio.js'
import MidiConnection from './MidiConnection.jsx'
import FreePlayCircle from './FreePlayCircle.jsx'
import PianoExample from './PianoExample.jsx'
import JamPanel from './JamPanel.jsx'
import NowPlaying from './NowPlaying.jsx'

// FREE PLAY: play anything on the keyboard and it names what you're holding —
// notes, intervals, and chords (inversions/slash chords included) — in a key
// you choose, with its function and a circle of fifths. The tune on Spotify
// sets that key for you and puts its changes on a grid you can comp.
export default function FreePlay({ session, onStartManual }) {
  const midi = useMidiContext()
  const held = midi.activeNotes

  const analysis = useMemo(() => analyzeNotes(held), [held])

  // Keep the last recognized chord/interval on screen after you lift your hands.
  const [last, setLast] = useState(null)
  useEffect(() => {
    if (analysis.kind === 'chord' || analysis.kind === 'interval' || analysis.kind === 'note') {
      setLast(analysis)
    }
  }, [analysis])

  const showing = analysis.kind === 'empty' ? last : analysis

  const [keyId, setKeyId] = useState('C')
  const [showCircle, setShowCircle] = useState(false)

  // The tune reads once per track. `analyzing` covers the whole round trip;
  // the panel shows its skeletons until it lands.
  const now = useNowPlaying()
  const trackId = now.data?.track?.id || null
  const trackTitle = now.data?.track?.title || ''
  const trackArtist = now.data?.track?.artist || ''
  const trackAlbum = now.data?.track?.album || ''
  const [tune, setTune] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    setTune(null)
    if (!trackId) {
      setAnalyzing(false)
      return undefined
    }
    const controller = new AbortController()
    const query = new URLSearchParams({
      id: trackId,
      title: trackTitle,
      artist: trackArtist,
      album: trackAlbum,
    })
    setAnalyzing(true)
    fetch(`/api/tune?${query}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setTune(data))
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setAnalyzing(false)
      })
    return () => controller.abort()
  }, [trackId, trackTitle, trackArtist, trackAlbum])

  // The grid reads in the tune's key. With no key at all the chart still shows,
  // read in the key on the selector — JAM stays off until there is a key.
  const view = useMemo(() => {
    const chords = tune?.changes?.chords || []
    if (!chords.length) return null
    return buildTuneView({
      keyPc: tune.key?.pc ?? keyById(keyId).tonic,
      mode: tune.key?.mode || 'major',
      chords,
    })
  }, [tune, keyId])

  // The tune sets the key unless the player picked one for this track. The
  // override is stamped with the track, so the next tune may set the key again.
  // A measured key needs no chart, so this keys off the tune's key alone.
  const tuneKey = tune?.key || null
  const tuneLabel = useMemo(() => (tuneKey ? keyLabel(tuneKey) : null), [tuneKey])
  const [keySource, setKeySource] = useState('manual')
  const [overriddenTrack, setOverriddenTrack] = useState(null)
  useEffect(() => {
    if (!tuneLabel) return
    if (keySource === 'manual' && overriddenTrack === trackId) return
    setKeyId(tuneLabel.keyId)
    setKeySource('tune')
  }, [tuneLabel, trackId, keySource, overriddenTrack])

  const [preset, setPreset] = useState(null)
  const [autoStartToken, setAutoStartToken] = useState(0)
  const [jamPhase, setJamPhase] = useState('idle')

  const jamDegrees = useMemo(
    () => (view ? view.cells.filter((cell) => Number.isInteger(cell.degree)).map((cell) => cell.degree) : []),
    [view],
  )

  // The literal chords, so a blues or a secondary dominant jams instead of
  // refusing: the round plays and grades these pitch sets, not a diatonic guess.
  const jamChords = useMemo(
    () =>
      view
        ? view.cells.map((cell) => ({
            root: cell.pc,
            pcs: cell.pcs,
            quality: cell.quality,
            label: cell.name,
          }))
        : [],
    [view],
  )

  function clearTune() {
    setPreset(null)
    setKeySource('manual')
    setOverriddenTrack(trackId)
  }

  function jamThese() {
    // Safari needs the unlock inside the click, before anything else.
    unlockAudio()
    if (!view || !tune?.key || !view.cells.length) return
    // Jamming the tune's bars means playing them in the tune's key.
    setKeyId(view.keyId)
    setKeySource('tune')
    setPreset({
      id: trackId,
      name: view.label,
      degrees: jamDegrees,
      chords: jamChords,
      bpm: tune.tempo?.bpm || 84,
    })
    setAutoStartToken((token) => token + 1)
  }

  const fn = useMemo(
    () => (showing?.kind === 'chord' ? analyzeFunction(showing, keyId) : null),
    [showing, keyId],
  )

  return (
    <div className="freeplay">
      <NowPlaying
        now={now}
        tune={tune}
        view={view}
        analyzing={analyzing}
        keyId={keyId}
        keySource={keySource}
        overriddenTrack={overriddenTrack}
        presetActive={Boolean(preset)}
        jamPhase={jamPhase}
        onRefresh={now.refresh}
        onJam={jamThese}
        onClearTune={clearTune}
      />

      <MidiConnection midi={midi} />

      {session?.status !== 'active' ? (
        <div className="freeplay__session">
          <div>
            <span className="freeplay__session-label">FREE PLAY SESSION</span>
            <p className="freeplay__session-copy">
              Start the clock and log these minutes to the vault. Play whatever you want.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--signal"
            onClick={() => onStartManual?.('FREE PLAY')}
            disabled={!onStartManual}
          >
            START &amp; LOG MINUTES
          </button>
        </div>
      ) : null}

      <JamPanel
        keyId={keyId}
        preset={preset}
        autoStartToken={autoStartToken}
        onPhaseChange={setJamPhase}
        onClearTune={clearTune}
      />

      <div className="freeplay__controls">
        <label className="freeplay__keypick">
          <span>KEY</span>
          <select
            className="select"
            value={keyId}
            onChange={(e) => {
              setKeyId(e.target.value)
              setKeySource('manual')
              setOverriddenTrack(trackId)
            }}
          >
            {MAJOR_KEYS.map((key) => (
              <option key={key.id} value={key.id}>
                {keyDisplay(key.id)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`btn btn--ghost${showCircle ? ' is-active' : ''}`}
          aria-pressed={showCircle}
          onClick={() => setShowCircle((on) => !on)}
        >
          CIRCLE OF FIFTHS
        </button>
      </div>

      <div className={`freeplay__analysis${showCircle ? ' freeplay__analysis--circle' : ''}`}>
        {showCircle && (
          <FreePlayCircle
            keyId={keyId}
            chord={showing?.kind === 'chord' ? showing : null}
            fn={fn}
            activeNotes={midi.activeNotes}
          />
        )}

        <div className="stage">
          {midi.supported && !midi.connected ? (
            <p className="stage__msg">CONNECT A MIDI KEYBOARD, THEN PLAY.</p>
          ) : (
            <FreePlayDisplay
              showing={showing}
              rawEmpty={analysis.kind === 'empty'}
              keyId={keyId}
              fn={fn}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FreePlayDisplay({ showing, rawEmpty, keyId, fn }) {
  if (!showing) {
    return <p className="stage__msg">PLAY SOMETHING…</p>
  }

  const showPiano =
    showing.kind === 'chord' || showing.kind === 'interval' || showing.kind === 'note'

  return (
    <div className={`readout${rawEmpty ? ' readout--held' : ''}`}>
      <span className="readout__kind">
        {showing.kind === 'chord'
          ? 'CHORD'
          : showing.kind === 'interval'
            ? 'INTERVAL'
            : showing.kind === 'note'
              ? 'NOTE'
              : 'NOTES'}
        {rawEmpty ? ' · LAST' : ''}
      </span>

      <span className="readout__name">
        {showing.kind === 'unknown' ? showing.notes.join(' · ') : showing.name}
      </span>

      {showing.kind === 'interval' && <span className="readout__detail">{showing.detail}</span>}

      {showing.kind === 'chord' && showing.notes && (
        <div className="readout__chips">
          {showing.notes.map((n) => (
            <span className="notechip" key={n}>
              {n}
            </span>
          ))}
        </div>
      )}

      {showing.kind === 'chord' && showing.equivalents.length > 0 && (
        <span className="readout__detail">= {showing.equivalents.join('  ·  ')}</span>
      )}

      {fn && (
        <div className="fnblock">
          <div className="fnblock__head">
            <span className="fnblock__label">{fn.label}</span>
            <span className={`fnblock__state ${fn.inKey ? 'is-in' : 'is-out'}`}>
              {fn.inKey ? 'IN KEY' : 'OUTSIDE THE KEY'}
            </span>
          </div>
          {fn.target && <span className="fnblock__target">LEADS TO {fn.target}</span>}
          <p className="fnblock__detail">{fn.detail}</p>
          <span className="fnblock__key">IN {keyDisplay(keyId)} MAJOR</span>
          {fn.foundation ? (
            <a className="fnblock__link" href={`#lessons?foundation=${fn.foundation}`}>
              WHAT IS THIS? →
            </a>
          ) : null}
        </div>
      )}

      {showPiano && (
        <PianoExample
          pcs={showing.pcs}
          accentPc={showing.root ?? null}
          label={`Keyboard showing ${showing.name}`}
        />
      )}
    </div>
  )
}
