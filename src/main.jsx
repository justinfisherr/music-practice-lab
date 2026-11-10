import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.jsx'
import { armAudio } from './session/audio.js'

// Audio stays locked until a gesture. Arm the shared context on the first one so
// every later HEAR / chord / backing call has a running context.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', armAudio, { capture: true })
  window.addEventListener('keydown', armAudio, { capture: true })
  window.addEventListener('touchstart', armAudio, { capture: true, passive: true })
}

// Bump on every deploy that changes stage layout: a stale saved run would
// otherwise keep a removed section on screen.
const BUILD = '2026-11-10-set-one-stage'
try {
  if (localStorage.getItem('mpl.build') !== BUILD) {
    localStorage.removeItem('mpl.session.current')
    localStorage.setItem('mpl.build', BUILD)
  }
} catch {
  // storage off: nothing to clear
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
