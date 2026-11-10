import { useEffect, useRef, useState } from 'react'
import { MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import { noteName } from '../data/diminishedChords.js'
import {
  angleForKey,
  bonusForKey,
  loadSpun,
  markSpun,
  rotationTo,
} from '../session/wheel.js'

const SIZE = 320
const CX = SIZE / 2
const CY = SIZE / 2
const R_OUT = 118
const R_IN = 78
const LABEL_R = 98
const HUB_R = 52
const SPIN_MS = 2200
const SETTLE_MS = 90

function polar(radius, degrees) {
  const rad = (degrees * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)]
}

function sectorPath(a1, a2) {
  const [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_OUT, a2)
  const [x3, y3] = polar(R_IN, a2)
  const [x4, y4] = polar(R_IN, a1)
  return `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${R_IN} ${R_IN} 0 0 0 ${x4} ${y4} Z`
}

const SECTOR = sectorPath(-105, -75)

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function Wheel({
  date,
  tonightKey,
  activeKey,
  bonusKey,
  variant = 'tonight',
  activeNotes = [],
  disabled = false,
  phone = false,
  spinnable = true,
  onBonus,
  onTonight,
  onStartBonus,
}) {
  const reduced = useReducedMotion()
  const [rotation, setRotation] = useState(() => angleForKey(tonightKey))
  const [spinning, setSpinning] = useState(false)
  const [settling, setSettling] = useState(false)
  const spinningRef = useRef(false)
  const lastKeyRef = useRef(tonightKey)
  const timersRef = useRef([])

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
    },
    [],
  )

  function queue(fn, wait) {
    timersRef.current.push(setTimeout(fn, wait))
  }

  function settle() {
    if (!spinningRef.current) return
    spinningRef.current = false
    setSpinning(false)
    setSettling(true)
    queue(() => setSettling(false), SETTLE_MS)
  }

  // One authored spin per LA date on mount, landing tonight's sector at 12.
  useEffect(() => {
    if (!tonightKey) return
    if (!spinnable || reduced || loadSpun(date)) {
      setRotation(angleForKey(tonightKey))
      return
    }
    spinningRef.current = true
    setSpinning(true)
    setRotation((current) => rotationTo(current, tonightKey, 1))
    queue(() => {
      markSpun(date)
      settle()
    }, SPIN_MS)
    queue(() => settle(), SPIN_MS + 1500)
  }, [date, tonightKey, reduced, spinnable])

  // When the parent switches between tonight and bonus, rotate to the new
  // sector without unwinding. A spin in flight owns the rotation.
  useEffect(() => {
    if (!activeKey || lastKeyRef.current === activeKey) return
    lastKeyRef.current = activeKey
    if (spinningRef.current) return
    const turns = reduced ? 0 : variant === 'bonus' ? 2 : 1
    setRotation((current) => rotationTo(current, activeKey, turns))
  }, [activeKey, variant, reduced])

  function spin() {
    if (!spinnable || disabled || spinningRef.current) return
    const next = bonusForKey(date, tonightKey, bonusKey && bonusKey !== tonightKey ? bonusKey : null)
    if (next === tonightKey) return
    lastKeyRef.current = next
    spinningRef.current = true
    setSpinning(true)
    const turns = reduced ? 0 : 2
    setRotation((current) => rotationTo(current, next, turns))
    onBonus?.(next)
    if (reduced) {
      settle()
      return
    }
    queue(() => {
      markSpun(date)
      settle()
    }, SPIN_MS)
    queue(() => settle(), SPIN_MS + 1500)
  }

  const active = activeKey || tonightKey
  const label = variant === 'bonus' ? 'BONUS' : 'TODAY'

  const activeIndex = MAJOR_KEYS.findIndex((k) => k.id === active)
  const activeKeyObj = MAJOR_KEYS[activeIndex] || MAJOR_KEYS[0]
  const diatonicPcs = [0, 2, 4, 5, 7, 9, 11].map((step) => (activeKeyObj.tonic + step) % 12)
  const livePcs = new Set((activeNotes || []).map((n) => ((n % 12) + 12) % 12))
  const liveOutside = [...livePcs].some((pc) => !diatonicPcs.includes(pc))

  return (
    <div className="wheel">
      <div className="wheel__head">
        <span className="wheel__kicker">CIRCLE OF FIFTHS</span>
        <span className="wheel__meta">{keyDisplay(active)} MAJOR</span>
      </div>

      <div className="wheel__stage">
        <svg
          className="wheel__svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Circle of fifths, ${keyDisplay(active)} major selected`}
        >
          <circle cx={CX} cy={CY} r={R_OUT + 10} className="wheel__rim" />
          <g
            className={`wheel__ring${spinning ? ' is-spinning' : ''}`}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {MAJOR_KEYS.map((key, index) => {
              const isActive = key.id === active
              const tonic = ((key.tonic % 12) + 12) % 12
              const held = livePcs.has(tonic)
              const hitClass = held ? (diatonicPcs.includes(tonic) ? ' is-hit' : ' is-hit-out') : ''
              const dist = Math.min(
                (index - activeIndex + 12) % 12,
                (activeIndex - index + 12) % 12,
              )
              return (
                <g
                  key={key.id}
                  className={`wheel__sector${isActive ? ' is-active' : ''}${hitClass}`}
                  style={{ '--dist': dist }}
                  transform={`rotate(${index * 30} ${CX} ${CY})`}
                >
                  <path d={SECTOR} className="wheel__sector-fill" />
                  <line
                    x1={CX}
                    y1={CY - R_OUT}
                    x2={CX}
                    y2={CY - R_OUT - 8}
                    className="wheel__tooth"
                  />
                  <g transform={`translate(${CX} ${CY - LABEL_R})`}>
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`wheel__label${isActive ? ' is-active' : ''}${hitClass}`}
                    >
                      {keyDisplay(key.id)}
                    </text>
                    {key.id === tonightKey ? (
                      <text
                        x={0}
                        y={12}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={`wheel__tonight${isActive ? ' is-active' : ''}`}
                      >
                        TODAY
                      </text>
                    ) : null}
                  </g>
                  <g transform={`translate(${CX} ${CY - 66})`}>
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="wheel__minor"
                    >
                      {key.scale[5]}m
                    </text>
                  </g>
                </g>
              )
            })}
          </g>

          <circle cx={CX} cy={CY} r={HUB_R} className="wheel__hub" />
          <text x={CX} y={CY - 6} textAnchor="middle" className="wheel__hub-key">
            {keyDisplay(active)}
          </text>
          <text x={CX} y={CY + 16} textAnchor="middle" className="wheel__hub-sub">
            {label}
          </text>
          <path
            d={`M ${CX} 12 L ${CX - 10} 30 L ${CX + 10} 30 Z`}
            className={`wheel__pointer${settling ? ' is-settling' : ''}`}
          />
        </svg>
      </div>

      <p className="wheel__readout" aria-live="polite">
        {spinning
          ? `SPINNING TO ${label}…`
          : `${keyDisplay(active)} MAJOR · ${label}${bonusKey && bonusKey !== tonightKey ? ` · BONUS ${keyDisplay(bonusKey)}` : ''}`}
      </p>
      {activeNotes.length ? (
        <p className={`wheel__live${liveOutside ? ' is-outside' : ''}`}>
          LIVE · {activeNotes.map((n) => noteName(n)).join(' ')} · {liveOutside ? 'OUTSIDE THE KEY' : 'IN KEY'}
        </p>
      ) : null}

      {spinnable ? (
        <div className="wheel__actions">
          <button type="button" className="btn btn--ghost" onClick={spin} disabled={disabled}>
            {spinning ? 'SPINNING…' : 'SPIN'}
          </button>
          {variant === 'bonus' ? (
            <button type="button" className="btn" onClick={onTonight} disabled={disabled || spinning}>
              BACK TO TODAY
            </button>
          ) : bonusKey && bonusKey !== tonightKey ? (
            <button
              type="button"
              className="btn btn--signal"
              onClick={() => onStartBonus?.(bonusKey)}
              disabled={disabled || spinning}
            >
              {phone ? `PLAY BONUS · ${keyDisplay(bonusKey)}` : 'START BONUS'}
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="wheel__foot">
        SHADED BY FIFTHS FROM {keyDisplay(active)} · NEAR → FAR
        <br />
        TODAY {keyDisplay(tonightKey)}
        {bonusKey && bonusKey !== tonightKey ? ` · BONUS ${keyDisplay(bonusKey)}` : ''}
      </p>
    </div>
  )
}
