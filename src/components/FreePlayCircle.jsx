import { MAJOR_KEYS, keyDisplay } from '../data/scales.js'
import { diatonicMarks, sliceAngle, sliceForRoot, targetSlice } from '../data/circle.js'

// A static circle of fifths for FREE PLAY: the selected key at 12 o'clock, its
// diatonic numerals on the slices, and the played chord's slice inked.
const SIZE = 320
const CX = SIZE / 2
const CY = SIZE / 2
const R_OUT = 152
const R_OUT_IN = 112
const R_IN_OUT = 108
const R_IN_IN = 74
const R_OUT_LABEL = 134
const R_OUT_NUM = 119
const R_IN_LABEL = 92
const R_IN_NUM = 80
const HUB_R = 68

function polar(radius, degrees) {
  const rad = ((degrees - 90) * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)]
}

function bandSector(r1, r2, center) {
  const [x1, y1] = polar(r1, center - 15)
  const [x2, y2] = polar(r1, center + 15)
  const [x3, y3] = polar(r2, center + 15)
  const [x4, y4] = polar(r2, center - 15)
  return `M ${x1} ${y1} A ${r1} ${r1} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 0 0 ${x4} ${y4} Z`
}

export default function FreePlayCircle({ keyId = 'C', chord = null, fn = null, activeNotes = [] }) {
  const selected = Math.max(
    0,
    MAJOR_KEYS.findIndex((key) => key.id === keyId),
  )
  const marks = diatonicMarks(keyId)
  const active = chord ? sliceForRoot(chord.root, chord.suffix) : null
  const target = targetSlice(fn, keyId)
  // Same live-note rule as Wheel: a held note fills its own major slice, green
  // in the selected key and red outside it.
  const diatonicPcs = [0, 2, 4, 5, 7, 9, 11].map((step) => (MAJOR_KEYS[selected].tonic + step) % 12)
  const livePcs = new Set((activeNotes || []).map((n) => ((n % 12) + 12) % 12))
  const liveLabel = livePcs.size
    ? `, ${livePcs.size} note${livePcs.size === 1 ? '' : 's'} held`
    : ''

  return (
    <div className="fpc">
      <svg
        className="fpc__svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Circle of fifths in ${keyDisplay(keyId)} major${
          chord ? `, highlighting ${chord.name}` : ''
        }${liveLabel}`}
      >
        <circle cx={CX} cy={CY} r={R_OUT + 6} className="fpc__rim" />

        {MAJOR_KEYS.map((key, index) => {
          const center = sliceAngle(index, selected)
          const activeOuter = active?.index === index && active.ring === 'outer'
          const activeInner = active?.index === index && active.ring === 'inner'
          const targetOuter = target?.index === index && target.ring === 'outer'
          const targetInner = target?.index === index && target.ring === 'inner'
          const mark = marks.get(index) || {}
          const tonic = ((key.tonic % 12) + 12) % 12
          const held = livePcs.has(tonic)
          const hit = held ? (diatonicPcs.includes(tonic) ? ' is-hit' : ' is-hit-out') : ''
          // The inner ring's tonic is this key's relative minor, so it hits on its own note.
          const minorTonic = (tonic + 9) % 12
          const minorHit = livePcs.has(minorTonic)
            ? diatonicPcs.includes(minorTonic)
              ? ' is-hit'
              : ' is-hit-out'
            : ''

          const [mx, my] = polar(R_OUT_LABEL, center)
          const [nx, ny] = polar(R_OUT_NUM, center)
          const [ix, iy] = polar(R_IN_LABEL, center)
          const [px, py] = polar(R_IN_NUM, center)

          return (
            <g key={key.id}>
              <path
                d={bandSector(R_OUT, R_OUT_IN, center)}
                className={`fpc__slice${activeOuter ? ' is-active' : ''}${hit}${
                  targetOuter ? ' is-target' : ''
                }`}
              />
              <path
                d={bandSector(R_IN_OUT, R_IN_IN, center)}
                className={`fpc__slice fpc__slice--inner${activeInner ? ' is-active' : ''}${
                  targetInner ? ' is-target' : ''
                }`}
              />

              <text
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`fpc__key${activeOuter ? ' is-active' : ''}${hit}`}
              >
                {keyDisplay(key.id)}
              </text>
              {mark.outer ? (
                <text
                  x={nx}
                  y={ny}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`fpc__num${activeOuter ? ' is-active' : ''}${hit}`}
                >
                  {mark.outer}
                </text>
              ) : null}

              <text
                x={ix}
                y={iy}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`fpc__minor${activeInner ? ' is-active' : ''}${minorHit}`}
              >
                {key.scale[5]}m
              </text>
              {mark.inner ? (
                <text
                  x={px}
                  y={py}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`fpc__num fpc__num--inner${activeInner ? ' is-active' : ''}${minorHit}`}
                >
                  {mark.inner}
                </text>
              ) : null}
            </g>
          )
        })}

        <circle cx={CX} cy={CY} r={HUB_R} className="fpc__hub" />
        <text x={CX} y={CY - 6} textAnchor="middle" className="fpc__hub-key">
          {keyDisplay(keyId)}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" className="fpc__hub-sub">
          MAJOR
        </text>
        <path d={`M ${CX} 8 L ${CX - 9} 24 L ${CX + 9} 24 Z`} className="fpc__pointer" />
      </svg>
    </div>
  )
}
