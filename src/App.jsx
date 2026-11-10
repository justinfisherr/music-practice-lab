import { lazy, Suspense, useEffect, useState } from 'react'
import Navigation from './components/Navigation.jsx'
import FreePlay from './components/FreePlay.jsx'
import SessionTab from './components/SessionTab.jsx'
import SessionRun from './components/SessionRun.jsx'
import SessionSummary from './components/SessionSummary.jsx'
import Lessons from './components/Lessons.jsx'
import Ledger from './components/Ledger.jsx'
import LedgerDetail from './components/LedgerDetail.jsx'
import ManualBar from './components/ManualBar.jsx'
import House from './components/House.jsx'
import { MAJOR_KEYS } from './data/scales.js'
import { MidiProvider } from './hooks/MidiContext.jsx'
import { useSession } from './session/useSession.js'
import { useRank } from './session/useRank.js'
import { navigate, parseHash } from './session/route.js'

// The crate carries the bundled jazz dataset, so it stays out of the first bundle.
const Crate = lazy(() => import('./components/Crate.jsx'))

// SESSION is the default; LESSONS is the card library; FREE PLAY is the sandbox
// and LEDGER is the record. The ledger keeps the legacy `stats` route id.
const ROUTES = [
  { id: 'session', label: 'SESSION', subtitle: 'The desk', component: SessionTab },
  { id: 'lessons', label: 'LESSONS', subtitle: 'Theory cards', component: Lessons },
  { id: 'freeplay', label: 'FREE PLAY', subtitle: 'Name what you play', component: FreePlay },
  { id: 'crate', label: 'CRATE', subtitle: 'Records & artists', component: Crate },
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

  function startSet(keyId = null) {
    practice.startSet(undefined, keyId)
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
    } else if (last?.composition?.version === 4) {
      practice.startSet(undefined, last.keyId)
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
    } else if (route.sub === 'game') {
      content = (
        <House
          keyId={MAJOR_KEYS.some((key) => key.id === route.key) ? route.key : undefined}
          onExit={() => navigate('session')}
          onSubmit={practice.submitRun}
        />
      )
    } else {
      content = (
        <SessionTab
          session={practice.session}
          onStart={startSession}
          onStartSet={startSet}
          onStartManual={startManual}
          onResume={() => navigate('session/run')}
          onReview={() => navigate('session/summary')}
          onOpenLedger={() => navigate('stats')}
          onOpenRun={openRun}
          onOpenWardrobe={() => navigate('stats?wardrobe=open')}
          onOpenArcade={(key) =>
            navigate(key ? `session/game?key=${encodeURIComponent(key)}` : 'session/game')
          }
          rank={rank}
          onTotalXp={applyTotalXp}
        />
      )
    }
  } else if (route.view === 'test') {
    // `#test/falling` is a read-only alias for the same view.
    content =
      route.sub === 'falling' ? (
        <House onExit={() => navigate('session')} onSubmit={practice.submitRun} />
      ) : null
  } else if (route.view === 'lessons') {
    content = (
      <Lessons type={route.type} foundation={route.foundation} onTry={startLesson} />
    )
  } else if (route.view === 'crate') {
    content = (
      <Suspense fallback={<div className="emptyblock">OPENING THE CRATE…</div>}>
        <Crate rank={rank} recordId={route.id} />
      </Suspense>
    )
  } else if (route.view === 'freeplay') {
    content = (
      <FreePlay
        session={practice.session}
        onStartManual={startManual}
      />
    )
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
        onRetrySync={practice.retrySync}
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
      <div
        className={
          'app' +
          (route.view === 'session' && (route.sub === 'run' || route.sub === 'game')
            ? ' app--run'
            : '')
        }
      >
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
