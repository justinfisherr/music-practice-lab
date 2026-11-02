// Skins are palettes only. Level gates which palette a player may wear; the
// stored preference is never destroyed, so a palette re-locks if the level
// drops (it should not) and comes back automatically when it is earned again.
export const SKINS = [
  { id: 'paper', label: 'PAPER', minLevel: 1 },
  { id: 'blue-note', label: 'BLUE NOTE', minLevel: 2 },
  { id: 'smoke', label: 'SMOKE', minLevel: 3 },
  { id: 'kraft', label: 'KRAFT', minLevel: 5 },
  { id: 'sage', label: 'SAGE', minLevel: 7 },
  { id: 'reel', label: 'REEL', minLevel: 9 },
]

export const SKIN_IDS = new Set(SKINS.map((skin) => skin.id))
const DEFAULT_SKIN = 'paper'
const KEY = 'mpl.skin'
const KEY_MIN = 'mpl.skinMin'
const KEY_LEVEL = 'mpl.level'

function read(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // private mode / quota: the session still runs on the default palette
  }
}

export function loadSkin() {
  const id = read(KEY)
  return SKIN_IDS.has(id) ? id : DEFAULT_SKIN
}

export function applySkin(id) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.skin = SKIN_IDS.has(id) ? id : DEFAULT_SKIN
}

export function saveSkin(id) {
  const skin = SKINS.find((row) => row.id === id)
  if (!skin) return false
  write(KEY, skin.id)
  write(KEY_MIN, String(skin.minLevel))
  return true
}

export function markLevel(level) {
  write(KEY_LEVEL, String(Math.max(0, Math.round(level) || 0)))
}

// Pick the wear-able palette for this level: the stored one if unlocked,
// otherwise PAPER. The stored preference is left intact.
export function reconcile(level = 0) {
  const stored = loadSkin()
  const skin = SKINS.find((row) => row.id === stored)
  const allowed = skin && skin.minLevel <= level ? skin.id : DEFAULT_SKIN
  applySkin(allowed)
  return allowed
}
