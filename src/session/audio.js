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
