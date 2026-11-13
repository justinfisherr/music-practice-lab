import { getAudioContext, unlockAudio } from './audio.js'
import { degreeRootPc, seventhByDegree, TURNAROUND_DEGREES } from './set.js'

// Four-bar generated groove for THE SET: one seventh chord per bar, a click on
// every beat, and a soft bass root + chord stab. The performance clock is the
// shared clock for the UI and the grading; audio is scheduled against it.
export const BARS = 4
export const BEATS_PER_BAR = 4

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12)
}

export function createTransport({
  keyId,
  bpm = 80,
  degrees = TURNAROUND_DEGREES,
  chords = null,
  onBeat,
  onChord,
  onEnd,
} = {}) {
  // A tune brings literal chords; the graded set and the named progressions
  // still come through as degrees. `chords` wins when it is supplied.
  const specs = Array.isArray(chords) && chords.length ? chords : null
  const progression =
    Array.isArray(degrees) && degrees.length ? degrees : TURNAROUND_DEGREES
  const bars = specs ? specs.length : Array.isArray(degrees) && degrees.length ? degrees.length : BARS
  const beatMs = 60000 / bpm
  const barMs = beatMs * BEATS_PER_BAR
  const totalMs = barMs * bars
  const context = getAudioContext()
  const nodes = []
  let running = false
  let muted = false
  let startedAt = 0
  let audioStart = 0
  let timer = null
  let lastBeat = -1
  let lastBar = -1
  let ended = false

  function elapsedMs() {
    if (!running) return 0
    return Math.max(0, performance.now() - startedAt)
  }

  function current() {
    const elapsed = elapsedMs()
    const bar = Math.min(bars - 1, Math.floor(elapsed / barMs))
    const beat = Math.min(BEATS_PER_BAR - 1, Math.floor((elapsed - bar * barMs) / beatMs))
    const degree = progression[bar]
    const spec = specs ? specs[bar] : null
    return {
      elapsedMs: elapsed,
      bar,
      beat,
      beatInBar: beat,
      chordIndex: bar,
      degree: spec ? null : degree,
      label: spec?.label ?? null,
      pcs: spec ? spec.pcs : seventhByDegree(keyId, degree),
      totalMs,
    }
  }

  function tone({ freq, at, duration, gain, type = 'sine' }) {
    if (!context) return
    const osc = context.createOscillator()
    const amp = context.createGain()
    osc.type = type
    osc.frequency.value = freq
    amp.gain.setValueAtTime(0, at)
    amp.gain.linearRampToValueAtTime(gain, at + 0.005)
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    osc.connect(amp)
    amp.connect(context.destination)
    osc.start(at)
    osc.stop(at + duration + 0.02)
    nodes.push(osc)
  }

  function scheduleAudio() {
    if (!context || muted) return
    audioStart = context.currentTime + 0.06
    for (let bar = 0; bar < bars; bar++) {
      const degree = progression[bar]
      const spec = specs ? specs[bar] : null
      // A chart's bass is the root it actually names, not pcs[0].
      const namedRoot = ((Number(spec?.root ?? spec?.pc) || 0) % 12 + 12) % 12
      const root = spec ? namedRoot : degreeRootPc(keyId, degree)
      const pcs = spec ? spec.pcs : seventhByDegree(keyId, degree)
      const barStart = audioStart + (bar * barMs) / 1000
      // Bass root, low and short.
      tone({
        freq: midiToFreq(36 + root),
        at: barStart,
        duration: 0.7,
        gain: 0.12,
        type: 'triangle',
      })
      // Soft chord stab on the downbeat.
      pcs.forEach((pc, index) => {
        tone({
          freq: midiToFreq(60 + pc),
          at: barStart + index * 0.006,
          duration: 0.5,
          gain: 0.045,
          type: 'sine',
        })
      })
      for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
        const at = barStart + (beat * beatMs) / 1000
        tone({
          freq: beat === 0 ? 1760 : 1320,
          at,
          duration: 0.03,
          gain: beat === 0 ? 0.08 : 0.045,
          type: 'square',
        })
      }
    }
  }

  function tick() {
    if (!running) return
    const elapsed = elapsedMs()
    if (elapsed >= totalMs) {
      stop()
      if (!ended) {
        ended = true
        onEnd?.()
      }
      return
    }
    const position = current()
    if (position.bar !== lastBar) {
      lastBar = position.bar
      onChord?.(position.chordIndex, position.degree)
    }
    const absoluteBeat = position.bar * BEATS_PER_BAR + position.beat
    if (absoluteBeat !== lastBeat) {
      lastBeat = absoluteBeat
      onBeat?.(position.beat, position.bar, position.beatInBar)
    }
  }

  async function start() {
    if (running) return
    ended = false
    lastBeat = -1
    lastBar = -1
    startedAt = performance.now()
    running = true
    await unlockAudio()
    scheduleAudio()
    timer = setInterval(tick, 25)
    tick()
  }

  function stop() {
    running = false
    if (timer) clearInterval(timer)
    timer = null
    for (const node of nodes) {
      try {
        node.stop()
      } catch {
        // already stopped
      }
    }
    nodes.length = 0
  }

  function setMuted(next) {
    muted = Boolean(next)
    if (muted) {
      for (const node of nodes) {
        try {
          node.stop()
        } catch {
          // already stopped
        }
      }
      nodes.length = 0
    }
  }

  return {
    start,
    stop,
    setMuted,
    toggleMute() {
      setMuted(!muted)
      return muted
    },
    isMuted() {
      return muted
    },
    isRunning() {
      return running
    },
    elapsedMs,
    current,
    barMs() {
      return barMs
    },
    beatMs() {
      return beatMs
    },
    totalMs() {
      return totalMs
    },
    audioTime() {
      return context ? context.currentTime : 0
    },
    get currentChordIndex() {
      return current().chordIndex
    },
    get bar() {
      return current().bar
    },
    get beat() {
      return current().beat
    },
  }
}
