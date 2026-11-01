import { useEffect, useState } from 'react'
import Navigation from './components/Navigation.jsx'
import PracticeTracker from './components/PracticeTracker.jsx'
import MidiTrainer from './components/MidiTrainer.jsx'
import FreePlay from './components/FreePlay.jsx'
import QuizManager from './components/QuizManager.jsx'
import SessionTab from './components/SessionTab.jsx'
import SessionRun from './components/SessionRun.jsx'
import SessionSummary from './components/SessionSummary.jsx'
import Ledger from './components/Ledger.jsx'
import LedgerDetail from './components/LedgerDetail.jsx'
import { MidiProvider } from './hooks/MidiContext.jsx'
import { useSession } from './session/useSession.js'
import { navigate, parseHash } from './session/route.js'

// Single source of truth for the app's primary sections. SESSION is the
// default; the existing tabs keep their ids and components.
const ROUTES = [
  { id: 'session', label: 'SESSION', component: SessionTab },
  { id: 'practice', label: 'PRACTICE', component: PracticeTracker },
  { id: 'freeplay', label: 'FREE PLAY', component: FreePlay },
  { id: 'dim7', label: 'DRILLS', component: MidiTrainer },
  { id: 'quizzes', label: 'QUIZZES', component: QuizManager },
  { id: 'stats', label: 'LEDGER', component: Ledger },
]

export default function App() {
  const [route, setRoute] = useState(() => parseHash())
  const practice = useSession()

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const active = ROUTES.find((row) => row.id === route.view) ?? ROUTES[0]

  function changeView(view) {
    navigate(view === 'session' ? 'session' : view)
  }

  function startSession() {
    practice.start()
    navigate('session/run')
  }

  function playAgain() {
    practice.reset()
    practice.start()
    navigate('session/run')
  }

  function done() {
    practice.reset()
    navigate('stats')
  }

  function openRun(id) {
    navigate(`stats/${encodeURIComponent(id)}`)
  }

  function filterKey(key) {
    navigate(key ? `stats?key=${encodeURIComponent(key)}` : 'stats')
  }

  let content
  if (route.view === 'session') {
    if (route.sub === 'run') {
      content = (
        <SessionRun
          practice={practice}
          onFinished={() => navigate('session/summary')}
          onExit={() => navigate('session')}
        />
      )
    } else if (route.sub === 'summary') {
      content = (
        <SessionSummary
          session={practice.session}
          syncState={practice.syncState}
          onDone={done}
          onAgain={playAgain}
        />
      )
    } else {
      content = (
        <SessionTab
          session={practice.session}
          onStart={startSession}
          onResume={() => navigate('session/run')}
          onReview={() => navigate('session/summary')}
          onOpenLedger={() => navigate('stats')}
        />
      )
    }
  } else if (route.view === 'stats') {
    content = route.id ? (
      <LedgerDetail id={route.id} onBack={() => navigate('stats')} />
    ) : (
      <Ledger
        filterKey={route.key}
        onFilter={filterKey}
        onOpen={openRun}
        onStartSession={() => navigate('session')}
        syncState={practice.syncState}
      />
    )
  } else {
    const Active = active.component
    content = <Active />
  }

  return (
    <MidiProvider>
      <div className="app">
        <header className="masthead">
          <h1 className="masthead__title">BRUTALIST MUSIC LAB</h1>
          <p className="masthead__sub">PRACTICE MACHINE · v1</p>
        </header>
        <Navigation routes={ROUTES} view={route.view} onChange={changeView} />
        <main className="view">{content}</main>
      </div>
    </MidiProvider>
  )
}
