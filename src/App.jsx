import { useState } from 'react'
import Navigation from './components/Navigation.jsx'
import PracticeTracker from './components/PracticeTracker.jsx'
import MidiTrainer from './components/MidiTrainer.jsx'
import FreePlay from './components/FreePlay.jsx'
import { MidiProvider } from './hooks/MidiContext.jsx'

// Single source of truth for the app's sections. Add a feature = add a row.
// Navigation and routing are both driven off this list.
const ROUTES = [
  { id: 'practice', label: 'PRACTICE', component: PracticeTracker },
  { id: 'freeplay', label: 'FREE PLAY', component: FreePlay },
  { id: 'dim7', label: 'DIM7 DRILL', component: MidiTrainer },
]

export default function App() {
  const [view, setView] = useState(ROUTES[0].id)
  const active = ROUTES.find((r) => r.id === view) ?? ROUTES[0]
  const Active = active.component

  return (
    <MidiProvider>
      <div className="app">
        <header className="masthead">
          <h1 className="masthead__title">BRUTALIST MUSIC LAB</h1>
          <p className="masthead__sub">PRACTICE MACHINE · v1</p>
        </header>
        <Navigation routes={ROUTES} view={view} onChange={setView} />
        <main className="view">
          <Active />
        </main>
      </div>
    </MidiProvider>
  )
}
