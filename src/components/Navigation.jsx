// Data-driven primary nav. Each route is a door: a hard-ruled block with a
// label and a plain-language subtitle. Active inverts to ink.
export default function Navigation({ routes, view, onChange }) {
  return (
    <nav className="nav" aria-label="Primary">
      {routes.map((route) => {
        const active = view === route.id
        return (
          <button
            key={route.id}
            type="button"
            className={`door${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-pressed={active}
            onClick={() => onChange(route.id)}
          >
            <span className="door__label">{route.label}</span>
            <span className="door__sub">{route.subtitle}</span>
          </button>
        )
      })}
    </nav>
  )
}
