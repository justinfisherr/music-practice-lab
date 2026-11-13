import { keyDisplay } from '../data/scales.js'
import TuneGrid from './TuneGrid.jsx'

// What Spotify is playing, read in the app's key, with the tune's changes in a
// playable grid. Presentational: every state is a shape it was handed, and the
// key machine lives in FREE PLAY.
const STALE_MS = 45000

function clock(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function ago(at) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  return seconds < 60 ? `${seconds}S AGO` : `${Math.floor(seconds / 60)}M AGO`
}

export default function NowPlaying({
  now,
  tune,
  view,
  analyzing,
  keyId,
  keySource,
  overriddenTrack,
  presetActive,
  jamPhase,
  onRefresh,
  onJam,
  onClearTune,
}) {
  const data = now?.data || null
  const track = data?.track || null
  const connected = Boolean(data?.connected)
  const tuneKey = tune?.key || null
  const tempo = tune?.tempo || null
  const cells = view?.cells || []
  const applied = keySource === 'tune'
  const notApplied = Boolean(track && keySource === 'manual' && overriddenTrack === track.id)
  const jamRunning = Boolean(jamPhase && jamPhase !== 'idle')
  // A chart is jammable in any key: the round plays the literal chords, and the
  // OUT marks are information, not a veto.
  const canJam = Boolean(tuneKey && cells.length && !analyzing)
  const stale = Boolean(now?.at) && Date.now() - now.at > STALE_MS
  const stamp = now?.at ? (stale ? `STALE · ${ago(now.at)}` : `AS OF ${ago(now.at)}`) : ''

  return (
    <section className="np" aria-labelledby="np-title">
      <div className="np__head">
        <h2 className="np__title" id="np-title">
          NOW PLAYING
        </h2>
        <span className="np__connected">{connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
        <span className={`np__stamp${stale ? ' is-stale' : ''}`}>{stamp}</span>
        <button
          type="button"
          className="btn btn--ghost np__refresh"
          onClick={onRefresh}
          disabled={now?.refreshing}
        >
          REFRESH
        </button>
      </div>

      {!data ? null : !connected ? (
        <div className="np__strip">
          <span className="np__word">NOT CONNECTED</span>
          <span className="np__note">SPOTIFY IS NOT CONNECTED</span>
          <span className="np__note">ADD THE THREE SPOTIFY ENV VARS, THEN REDEPLOY.</span>
        </div>
      ) : !track ? (
        <div className="np__strip">
          <span className="np__word">NOTHING PLAYING</span>
          <span className="np__note">PRESS PLAY IN SPOTIFY, THEN REFRESH.</span>
        </div>
      ) : (
        <div className="np__panel">
          <div className="np__track">
            {track.art ? (
              <img className="np__art" src={track.art} alt="" width="72" height="72" />
            ) : (
              <span className="np__art np__art--none">NO ART</span>
            )}
            <div className="np__id">
              <span className="np__state">{data.playing ? 'PLAYING' : 'PAUSED'}</span>
              <span className="np__ttl" title={track.title}>
                {track.title}
              </span>
              <span className="np__artist" title={track.artist}>
                {track.artist}
              </span>
              <span className="np__album" title={track.album}>
                {track.album}
              </span>
              <span className="np__clock">
                {clock(track.progressMs)} / {clock(track.durationMs)}
              </span>
            </div>
          </div>

          <div className="np__keyband">
            <div className="np__row">
              <span className="np__label">KEY</span>
              {analyzing ? (
                <span className="np__keychip np__keychip--wait">ANALYZING</span>
              ) : tuneKey && view ? (
                <span className="np__keychip">{view.label}</span>
              ) : (
                <span className="np__keychip np__keychip--none">KEY UNKNOWN</span>
              )}
              {!analyzing && tuneKey ? (
                <span
                  className={`np__prov${tuneKey.source === 'audio' ? ' is-measured' : ' is-guessed'}`}
                >
                  {tuneKey.source === 'audio' ? 'KEY MEASURED' : 'KEY GUESSED'}
                </span>
              ) : null}
              {applied && view ? (
                <button type="button" className="btn btn--ghost np__pick" onClick={onClearTune}>
                  PICK MY OWN
                </button>
              ) : null}
            </div>

            <div className="np__row">
              <span className="np__label">TEMPO</span>
              <span className="np__tempchip">{tempo ? tempo.bpm : '—'}</span>
              <span className="np__unit">BPM</span>
              {tempo ? (
                <span
                  className={`np__prov${tempo.source === 'audio' ? ' is-measured' : ' is-guessed'}`}
                >
                  {tempo.source === 'audio' ? 'TEMPO MEASURED' : 'TEMPO GUESSED'}
                </span>
              ) : null}
            </div>

            {!analyzing && applied && view ? (
              <span className="np__tuneline">
                {`KEY FROM TUNE · ${keyDisplay(keyId)} MAJOR${
                  view.mode === 'minor' ? ` (${view.label})` : ''
                }`}
              </span>
            ) : notApplied ? (
              <span className="np__tuneline">KEY FROM TUNE · NOT APPLIED</span>
            ) : null}

            {!analyzing && !tuneKey ? (
              <span className="np__note">THE AUDIO HAD NO KEY AND THE MODEL DIDN'T GUESS ONE.</span>
            ) : null}
          </div>

          <div className="np__gridband">
            <div className="np__row">
              <span className="np__label">
                {analyzing ? 'CHANGES · —' : cells.length ? `CHANGES · ${cells.length}` : 'CHANGES · NONE'}
              </span>
              {cells.length ? (
                <span className="np__prov">
                  {tuneKey?.source === 'audio' && tune?.changes?.known
                    ? 'FROM THE AUDIO'
                    : 'FROM THE MODEL'}
                </span>
              ) : null}
            </div>

            {analyzing ? <TuneGrid skeleton={8} /> : cells.length ? <TuneGrid cells={cells} /> : null}

            {!analyzing && !cells.length ? (
              <span className="np__note">
                {tune?.reason === 'no_api_key'
                  ? 'NO CHORD MODEL. THE KEY AND TEMPO STILL READ; THE CHANGES DO NOT.'
                  : 'CHORDS UNAVAILABLE'}
              </span>
            ) : null}

            <div className="np__actions">
              <button
                type="button"
                className="btn btn--signal"
                onClick={onJam}
                disabled={!canJam || jamRunning}
              >
                {jamRunning ? 'JAM RUNNING' : 'JAM THESE'}
              </button>
              {presetActive ? (
                <button type="button" className="btn btn--ghost" onClick={onClearTune}>
                  CLEAR TUNE
                </button>
              ) : null}
            </div>

            {!analyzing && !canJam ? (
              <span className="np__note">
                {!tuneKey
                  ? 'NO KEY TO JAM IN. PICK A KEY OR TAP A CELL.'
                  : !cells.length
                    ? 'NO CHANGES TO JAM.'
                    : ''}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
