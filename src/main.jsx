import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.jsx'

// Bump on every deploy that changes stage layout: a stale saved run would
// otherwise keep a removed section on screen.
const BUILD = '2026-11-06-g'
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
