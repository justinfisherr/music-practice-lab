const TABS = [
  { id: 'practice', label: 'PRACTICE TRACKER' },
  { id: 'trainer', label: 'CHORD TRAINER' },
]

export default function Navigation({ view, onChange }) {
  return (
    <nav className="nav" aria-label="Primary">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`nav__tab${view === tab.id ? ' is-active' : ''}`}
          aria-pressed={view === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
