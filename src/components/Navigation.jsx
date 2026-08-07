// Data-driven primary nav. Renders one tab per route; scrolls horizontally on
// narrow screens so it keeps working as more features are added.
export default function Navigation({ routes, view, onChange }) {
  return (
    <nav className="nav" aria-label="Primary">
      {routes.map((route) => (
        <button
          key={route.id}
          type="button"
          className={`nav__tab${view === route.id ? ' is-active' : ''}`}
          aria-pressed={view === route.id}
          onClick={() => onChange(route.id)}
        >
          {route.label}
        </button>
      ))}
    </nav>
  )
}
