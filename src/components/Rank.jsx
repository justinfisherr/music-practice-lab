import { SKINS } from '../session/skin.js'
import { levelFor, titleFor } from '../session/rank.js'

export function XpBand({ rank }) {
  const pct = Math.max(0, Math.min(100, rank.pct || 0))
  return (
    <div className="xpband">
      <div
        className="xpband__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={rank.next == null ? 'Max rank' : `${pct}% to level ${rank.level + 1}`}
      >
        <div className="xpband__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="xpband__nums">
        <span>{rank.floor} XP</span>
        <span>{rank.next == null ? 'MAX' : `${rank.next} XP`}</span>
      </div>
    </div>
  )
}

export function RankLine({ rank }) {
  if (!rank) return null
  return (
    <p className="rankline">
      LV {rank.level} · {rank.title} · {rank.totalXp} XP
      {rank.next == null
        ? ' · MAX RANK'
        : ` · ${rank.toNext} TO LV ${rank.level + 1}`}
    </p>
  )
}

export function RankCard({ rank, onOpenWardrobe }) {
  if (!rank) return null
  const nextSkin = SKINS.find((skin) => skin.minLevel > rank.level)
  return (
    <div className="rankcard">
      <div className="rankcard__top">
        <span className="rankcard__title">{rank.title}</span>
        <span className="rankcard__lv">LV {rank.level}</span>
      </div>
      <XpBand rank={rank} />
      <div className="rankcard__foot">
        <span>
          NEXT UNLOCK ·{' '}
          {nextSkin ? `${nextSkin.label} · LV ${nextSkin.minLevel}` : 'ALL SKINS UNLOCKED'}
        </span>
        <button type="button" className="linkbtn" onClick={onOpenWardrobe}>
          OPEN WARDROBE
        </button>
      </div>
    </div>
  )
}

export function LevelUpBlock({ before, after, onOpenWardrobe }) {
  if (!Number.isFinite(after)) return null
  const fromLevel = levelFor(before ?? 0)
  const toLevel = levelFor(after)
  if (toLevel <= fromLevel) return null
  const unlocked = SKINS.filter(
    (skin) => skin.minLevel > fromLevel && skin.minLevel <= toLevel,
  )
  return (
    <div className="levelup">
      <span className="levelup__kicker">LEVEL UP</span>
      <span className="levelup__title">
        LV {toLevel} · {titleFor(toLevel)}
      </span>
      <p className="levelup__skins">
        {unlocked.length
          ? `NEW SKIN UNLOCKED · ${unlocked.map((skin) => skin.label).join(' · ')}`
          : 'NEW RANK REACHED'}
      </p>
      <button type="button" className="btn btn--signal" onClick={onOpenWardrobe}>
        OPEN THE WARDROBE
      </button>
    </div>
  )
}
