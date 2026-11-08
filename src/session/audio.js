import { saveSound } from './store.js'

let ctx = null
// loadSound() is true when sound is ON. Track that, not its inverse — the old
// `muted = loadSound()` booted the app muted and made every HEAR button silent.
let soundOn = true // boot with audio ON; a stale inverted value must never mute the drills

export const SILENT_HINT = 'IPHONE SILENT SWITCH MUTES THIS — FLIP IT ON.'

function getContext() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

// Shared with the groove transport so there is one AudioContext per page.
export function getAudioContext() {
  return getContext()
}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12)
}

export function isMuted() {
  return !soundOn
}

// Create/resume the singleton from a real click, before any MIDI-driven replay
// needs it. Safe to call repeatedly.
export async function unlockAudio() {
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state === 'suspended') await audio.resume()
  } catch {
    // the browser can still refuse; the drills remain playable without tone
  }
}

export function setMuted(next) {
  soundOn = !next
  saveSound(soundOn)
}


// Play a set of pitch classes together as one block chord.
export function playChord(pcs, { duration = 0.7 } = {}) {
  if (!soundOn || !pcs?.length) return
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state === 'suspended') audio.resume()
    const t0 = audio.currentTime + 0.04
    pcs.forEach((pc) => {
      if (pc == null) return
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'triangle'
      osc.frequency.value = midiToFreq(60 + (((pc % 12) + 12) % 12))
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.15, t0 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
      osc.connect(gain)
      gain.connect(audio.destination)
      osc.start(t0)
      osc.stop(t0 + duration + 0.05)
    })
  } catch {
    // audio can be blocked without a gesture; the drill still works
  }
}

// Four quiet square clicks, then resolve one bar later. The caller shows a
// COUNT IN state and starts the transport on the first click of the next bar.
// When sound is off we still wait, so the timing stays the same.
export async function playCountIn(bpm = 80, beats = 4) {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 80
  const count = Number.isFinite(beats) ? Math.max(1, Math.floor(beats)) : 4
  const gapMs = 60000 / safeBpm
  const audio = getContext()
  if (soundOn && audio) {
    try {
      if (audio.state === 'suspended') await audio.resume()
      const t0 = audio.currentTime + 0.05
      for (let beat = 0; beat < count; beat++) {
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        const at = t0 + (beat * gapMs) / 1000
        osc.type = 'square'
        osc.frequency.value = beat === 0 ? 1760 : 1320
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(beat === 0 ? 0.085 : 0.05, at + 0.004)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
        osc.connect(gain)
        gain.connect(audio.destination)
        osc.start(at)
        osc.stop(at + 0.08)
      }
    } catch {
      // audio can be blocked without a gesture; the wait still keeps time
    }
  }
  await new Promise((resolve) => setTimeout(resolve, gapMs * count + 60))
}

export async function playPhrase(pcs, { gap = 0.45 } = {}) {
  if (!soundOn || !pcs?.length) return
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state === 'suspended') await audio.resume()
    const t0 = audio.currentTime + 0.04
    pcs.forEach((pc, index) => {
      if (pc == null) return
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const start = t0 + index * gap
      osc.type = 'triangle'
      osc.frequency.value = midiToFreq(60 + ((pc % 12) + 12) % 12)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
      osc.connect(gain)
      gain.connect(audio.destination)
      osc.start(start)
      osc.stop(start + 0.4)
    })
  } catch {
    // Web Audio can be blocked without a gesture; the drill still grades.
  }
}
