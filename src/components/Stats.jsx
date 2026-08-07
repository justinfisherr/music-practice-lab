export default function Stats({ score, streak, best, correct, attempted, extra }) {
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const cells = [
    { label: 'SCORE', value: score },
    { label: 'STREAK', value: streak },
    { label: 'BEST', value: best },
    { label: 'ACCURACY', value: `${accuracy}%` },
    { label: 'CORRECT', value: `${correct}/${attempted}` },
    ...(extra || []),
  ]
  return (
    <div className="stats">
      {cells.map((c) => (
        <div className="stat" key={c.label}>
          <span className="stat__value">{c.value}</span>
          <span className="stat__label">{c.label}</span>
        </div>
      ))}
    </div>
  )
}
