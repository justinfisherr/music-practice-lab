import { MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import { angleForKey } from '../session/wheel.js'

const SIZE = 260
const CENTER = SIZE / 2
const RADIUS = 96

export default function Wheel({ keyId, bonusKey = null, onSelect, disabled = false }) {
  const active = keyId || 'C'
  const shown = bonusKey || active
  const rotation = angleForKey(MAJOR_KEYS.findIndex((key) => key.id === shown))

  return (
    <div className="wheel">
      <div className="wheel__head">
        <span className="wheel__kicker">CIRCLE OF FIFTHS</span>
        {bonusKey && bonusKey !== active ? (
          <button
            type="button"
            className="btn btn--ghost wheel__spin"
            onClick={() => onSelect?.(bonusKey)}
            disabled={disabled}
          >
            SPIN TO BONUS
          </button>
        ) : (
          <span className="wheel__meta">{keyDisplay(active)} MAJOR</span>
        )}
      </div>

      <div className="wheel__stage">
        <svg
          className="wheel__svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Circle of fifths, ${keyDisplay(active)} major selected`}
        >
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 18} className="wheel__rim" />
          <circle cx={CENTER} cy={CENTER} r={RADIUS - 22} className="wheel__inner" />
          <g className="wheel__ring" style={{ transform: `rotate(${rotation}deg)` }}>
            {MAJOR_KEYS.map((key, index) => {
              const rad = ((index * 30 - 90) * Math.PI) / 180
              const x = CENTER + RADIUS * Math.cos(rad)
              const y = CENTER + RADIUS * Math.sin(rad)
              return (
                <g key={key.id}>
                  <line x1={CENTER} y1={CENTER} x2={x} y2={y} className="wheel__spoke" />
                  <circle
                    cx={x}
                    cy={y}
                    r={key.id === active ? 7 : 4}
                    className={`wheel__dot${key.id === active ? ' is-active' : ''}`}
                  />
                </g>
              )
            })}
          </g>
          <circle cx={CENTER} cy={CENTER} r={4} className="wheel__dot" />
        </svg>
        {MAJOR_KEYS.map((key, index) => {
          const rad = ((index * 30 - 90) * Math.PI) / 180
          const x = 50 + (RADIUS / SIZE) * 100 * Math.cos(rad)
          const y = 50 + (RADIUS / SIZE) * 100 * Math.sin(rad)
          return (
            <button
              key={key.id}
              type="button"
              className={`wheel__key${key.id === active ? ' is-active' : ''}${
                key.id === bonusKey && bonusKey !== active ? ' is-bonus' : ''
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-pressed={key.id === active}
              disabled={disabled}
              onClick={() => onSelect?.(key.id)}
            >
              {keyDisplay(key.id)}
            </button>
          )
        })}
      </div>
      <p className="wheel__foot">
        {keyDisplay(active)} MAJOR · POSITION {MAJOR_KEYS.findIndex((key) => key.id === active) + 1} OF 12
        {bonusKey && bonusKey !== active ? ` · BONUS ${keyDisplay(bonusKey)}` : ''}
      </p>
    </div>
  )
}
