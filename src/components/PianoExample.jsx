import { noteName } from '../data/diminishedChords.js'

// A small, honest keyboard: highlight the chord notes, accent the target note.
const WHITE = [0, 2, 4, 5, 7, 9, 11, 12]
const BLACK = [
  { pc: 1, left: 1 },
  { pc: 3, left: 2 },
  { pc: 6, left: 4 },
  { pc: 8, left: 5 },
  { pc: 10, left: 6 },
]
const KEY_W = 34
const KEY_H = 104
const BLACK_W = 20
const BLACK_H = 64

function same(a, b) {
  return ((a % 12) + 12) % 12 === ((b % 12) + 12) % 12
}

export default function PianoExample({ pcs = [], accentPc = null, crossPcs = [], label = '' }) {
  const has = (pc) => pcs.some((entry) => same(entry, pc))
  const accent = (pc) => accentPc != null && same(accentPc, pc)
  const cross = (pc) => crossPcs.some((entry) => same(entry, pc))
  const width = WHITE.length * KEY_W

  return (
    <div className="pianoexample" role="img" aria-label={label || 'Keyboard example'}>
      <svg viewBox={`0 0 ${width} ${KEY_H}`} className="pianoexample__svg">
        {WHITE.map((pc, index) => {
          const on = has(pc)
          const hot = accent(pc)
          const fill = hot ? 'var(--signal-ink)' : on ? 'var(--ink)' : 'var(--field)'
          const ink = hot || on ? 'var(--bg)' : 'var(--ink)'
          return (
            <g key={`w-${pc}-${index}`}>
              <rect
                x={index * KEY_W + 1}
                y={1}
                width={KEY_W - 2}
                height={KEY_H - 2}
                fill={fill}
                stroke="var(--line)"
                strokeWidth="2"
              />
              {on || hot ? (
                <text
                  x={index * KEY_W + KEY_W / 2}
                  y={KEY_H - 10}
                  textAnchor="middle"
                  fill={ink}
                  fontSize="11"
                  fontWeight="800"
                >
                  {noteName(pc)}
                </text>
              ) : null}
              {cross(pc) ? (
                <g stroke="var(--signal)" strokeWidth="3">
                  <line
                    x1={index * KEY_W + 8}
                    y1={18}
                    x2={index * KEY_W + KEY_W - 8}
                    y2={KEY_H - 18}
                  />
                  <line
                    x1={index * KEY_W + KEY_W - 8}
                    y1={18}
                    x2={index * KEY_W + 8}
                    y2={KEY_H - 18}
                  />
                </g>
              ) : null}
            </g>
          )
        })}
        {BLACK.map(({ pc, left }) => {
          const on = has(pc)
          const hot = accent(pc)
          const fill = hot ? 'var(--signal-ink)' : on ? 'var(--ok-ink)' : 'var(--ink)'
          return (
            <g key={`b-${pc}`}>
              <rect
                x={left * KEY_W - BLACK_W / 2}
                y={1}
                width={BLACK_W}
                height={BLACK_H}
                fill={fill}
                stroke="var(--line)"
                strokeWidth="2"
              />
              {on || hot ? (
                <text
                  x={left * KEY_W}
                  y={BLACK_H - 8}
                  textAnchor="middle"
                  fill="var(--bg)"
                  fontSize="9"
                  fontWeight="800"
                >
                  {noteName(pc)}
                </text>
              ) : null}
              {cross(pc) ? (
                <g stroke="var(--signal)" strokeWidth="3">
                  <line
                    x1={left * KEY_W - BLACK_W / 2 + 4}
                    y1={10}
                    x2={left * KEY_W + BLACK_W / 2 - 4}
                    y2={BLACK_H - 10}
                  />
                  <line
                    x1={left * KEY_W + BLACK_W / 2 - 4}
                    y1={10}
                    x2={left * KEY_W - BLACK_W / 2 + 4}
                    y2={BLACK_H - 10}
                  />
                </g>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
