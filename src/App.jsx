import { useEffect, useState } from 'react'
import Navigation from './components/Navigation.jsx'
import FreePlay from './components/FreePlay.jsx'
import SessionTab from './components/SessionTab.jsx'
import SessionRun from './components/SessionRun.jsx'
import SessionSummary from './components/SessionSummary.jsx'
import Lessons from './components/Lessons.jsx'
import Ledger from './components/Ledger.jsx'
import LedgerDetail from './components/LedgerDetail.jsx'
import ManualBar from './components/ManualBar.jsx'
import { MidiProvider } from './hooks/MidiContext.jsx'
import { useSession } from './session/useSession.js'
import { useRank } from './session/useRank.js'
import { navigate, parseHash } from './session/route.js'

// SESSION is the default; LESSONS is the card library; FREE PLAY is the sandbox
// and LEDGER is the record. The ledger keeps the legacy `stats` route id.
const ROUTES = [
  { id: 'session', label: 'SESSION', subtitle: 'The desk', component: SessionTab },
  { id: 'lessons', label: 'LESSONS', subtitle: 'Theory cards', component: Lessons },
  { id: 'freeplay', label: 'FREE PLAY', subtitle: 'Name what you play', component: FreePlay },
  { id: 'stats', label: 'LEDGER', subtitle: 'The record', component: Ledger },
]

export default function App() {
  const [route, setRoute] = useState(() => parseHash())
  const practice = useSession()
  const rank = useRank()
  const { applyTotalXp } = rank

  // The server is the XP source of truth: a GET's meta.totalXp or a POST's
  // totalXp lands in syncState, and this is the one place it reaches the rank.
  useEffect(() => {
    if (Number.isFinite(practice.syncState.totalXp)) {
      applyTotalXp(practice.syncState.totalXp)
    }
  }, [practice.syncState.totalXp, applyTotalXp])

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

  function startSession(plan = null, keyId = null, variant = 'tonight') {
    practice.start(plan, keyId, variant)
    navigate('session/run')
  }

  function startLesson(type) {
    if (!practice.startLesson(type)) return
    navigate('session/run')
  }

  function startManual(focus) {
    practice.startManual(focus)
  }

  function endManual() {
    practice.finish()
    practice.reset()
    navigate('stats')
  }

  function playAgain() {
    const last = practice.session
    practice.reset()
    if (last?.scope === 'lesson' && last.composition?.modules?.[0]) {
      practice.startLesson(last.composition.modules[0].type, last.keyId)
    } else {
      practice.start()
    }
    navigate('session/run')
  }

  function done() {
    const lesson = practice.session?.scope === 'lesson'
    practice.reset()
    navigate(lesson ? 'lessons' : 'stats')
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
          onOpenWardrobe={() => navigate('stats?wardrobe=open')}
        />
      )
    } else {
      content = (
        <SessionTab
          session={practice.session}
          onStart={startSession}
          onStartManual={startManual}
          onResume={() => navigate('session/run')}
          onReview={() => navigate('session/summary')}
          onOpenLedger={() => navigate('stats')}
          onOpenRun={openRun}
          onOpenWardrobe={() => navigate('stats?wardrobe=open')}
          rank={rank}
          onTotalXp={applyTotalXp}
        />
      )
    }
  } else if (route.view === 'lessons') {
    content = <Lessons type={route.type} onTry={startLesson} />
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
        rank={rank}
        onTotalXp={applyTotalXp}
        wardrobeOpen={route.wardrobe}
      />
    )
  } else {
    const Active = active.component
    content = <Active />
  }

  return (
    <MidiProvider>
      <div className="app">
        <a
          className="skip"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault()
            document.getElementById('main-content')?.focus()
          }}
        >
          SKIP TO CONTENT
        </a>
        <header className="masthead">
          <h1 className="masthead__title">BRUTALIST MUSIC LAB</h1>
          <p className="masthead__sub">PRACTICE MACHINE · v3</p>
        </header>
        <Navigation routes={ROUTES} view={route.view} onChange={changeView} />
        {practice.session?.kind === 'manual' && practice.session.status === 'active' ? (
          <ManualBar session={practice.session} onEnd={endManual} />
        ) : null}
        <main className="view" id="main-content" tabIndex={-1}>
          {content}
        </main>
      </div>
    </MidiProvider>
  )
}
