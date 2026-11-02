import { useEffect, useState } from 'react'
import { applySkin, loadSkin, markLevel, reconcile, saveSkin, SKINS } from '../session/skin.js'

// Two rows of hard tiles. Unlocked palettes apply on click; locked ones stay
// disabled until their level is earned. Inline in the Ledger, never a modal.
export default function Wardrobe({ level }) {
  const [active, setActive] = useState(() => reconcile(level))

  useEffect(() => {
    setActive(reconcile(level))
  }, [level])

  const current = SKINS.find((skin) => skin.id === active) || SKINS[0]

  function choose(skin) {
    if (skin.minLevel > level) return
    saveSkin(skin.id)
    markLevel(level)
    applySkin(skin.id)
    setActive(skin.id)
  }

  return (
    <div className="wardrobe" aria-label="Skin wardrobe">
      <div className="wardrobe__head">
        <span className="wardrobe__title">WARDROBE</span>
        <span className="wardrobe__status">
          IN USE · {current.label}
          {loadSkin() !== current.id ? ` · ${loadSkin().toUpperCase()} RE-LOCKED` : ''}
        </span>
      </div>
      <div className="wardrobe__grid">
        {SKINS.map((skin) => {
          const locked = skin.minLevel > level
          const inUse = skin.id === active
          return (
            <button
              type="button"
              className={`wardrobetile${inUse ? ' is-active' : ''}${
                locked ? ' is-locked' : ''
              }`}
              key={skin.id}
              disabled={locked}
              aria-pressed={inUse}
              onClick={() => choose(skin)}
            >
              <span className="wardrobetile__swatch" data-skin={skin.id} aria-hidden="true" />
              <span className="wardrobetile__label">{skin.label}</span>
              <span className="wardrobetile__meta">
                {locked ? `LOCKED · LV ${skin.minLevel}` : inUse ? 'IN USE' : `LV ${skin.minLevel}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
