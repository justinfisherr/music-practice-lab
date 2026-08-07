import { useState } from 'react'
import Navigation from './components/Navigation.jsx'
import PracticeTracker from './components/PracticeTracker.jsx'
import ChordTrainer from './components/ChordTrainer.jsx'

const VIEWS = {
  practice: PracticeTracker,
  trainer: ChordTrainer,
}

export default function App() {
  const [view, setView] = useState('practice')
  const Active = VIEWS[view]

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="masthead__title">BRUTALIST MUSIC LAB</h1>
        <p className="masthead__sub">PRACTICE MACHINE · v1</p>
      </header>
      <Navigation view={view} onChange={setView} />
      <main className="view">
        <Active />
      </main>
    </div>
  )
}
