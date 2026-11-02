---
name: Brutalist Music Lab
description: MIDI practice drills with a brutalist practice ledger.
colors:
  paper: "#f2f0e9"
  panel: "#f7f6f1"
  ink: "#111111"
  muted: "#6a6a63"
  signal: "#e5342b"
  signal-ink: "#b3241c"
  due: "#8a4a06"
  ok: "#14893b"
  ok-ink: "#0f6b2e"
  muted-on-ink: "#b9b6ac"
typography:
  display:
    fontFamily: "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, monospace"
    fontSize: "clamp(22px, 6vw, 40px)"
    fontWeight: 700
    letterSpacing: "2px"
  body:
    fontFamily: "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
spacing:
  sm: "8px"
  md: "14px"
  lg: "20px"
---

# Design System: Brutalist Music Lab

## Overview

**Creative North Star: "The Practice Room Bulletin"**

A monospace, hard-edged practice board. Black rules, warm paper, signal red for focus, and offset block shadows. It is deliberately blunt: every control is a labeled block, every state is a stamp.

## Colors

Warm paper ground, black ink, signal red for active focus, ochre for due items, green for done. White is never placed on ochre.

Small red and green text uses the ink variants, never the display fills: `--signal-ink: #b3241c` reads 5.78:1 on paper and `--ok-ink: #0f6b2e` reads 5.82:1 on paper. `--signal` and `--ok` are display fills only. `--muted-on-ink: #b9b6ac` reads 9.31:1 on `--ink` and is the only secondary text colour used on dark surfaces.

## Typography

Monospace throughout at a readable floor, with large tracked masthead type and small uppercase labels.

## Layout

Single 860px column of bordered blocks. Navigation is a row of hard-edged tabs that scrolls on narrow screens.

## Shapes

Square corners, 3px borders, and hard offset shadows. The standard block shadow is 4px; the tonight block and sticky session bar use `--shadow-heavy: 6px 6px 0 var(--ink)`. No rounded cards.

## Motion

State changes snap, they do not bounce. `--t-snap: 110ms` and `--t-stamp: 90ms` with `--ease-snap: cubic-bezier(.2, 0, 0, 1)` keep feedback immediate. `prefers-reduced-motion: reduce` collapses every animation, transition, and smooth scroll to effectively zero. No page-load choreography.

## Practice habit

The first block on the Practice tab is a single dark-outlined paper card: `DAILY HABIT`, the live status, a heavy `MUSIC PRACTICE` heading, one full-width signal-red button, and the same button in sage green once today is logged. It is the one cloud-connected control in the app; the exercise ledger stays local.

## Session & Ledger

The SESSION tab opens on an ink block: the LA-local date, the key of the night from the circle of fifths, its key number, and the deterministic seed. Graded stages are desktop-only; an unsupported browser gets a ledger link instead of a dead START button. The run has a sticky ink bar with the key, a tabular timer, SOUND, and an inline LEAVE confirm. Warm-up is a scale strip, a seven-step progress spine, and three-note chord prompts. Ear check shows four note cells and grades order. The HOOK is the one inverted surface: a two-bar grid, six notes, and solid/slashed/dashed diff marks on paper cells.

The LEDGER is a paper surface with four block meters, a 12-cell key heat grid in circle-of-fifths order, key filter chips drawn only from keys that have runs, and clickable rows. Detail is the same ledger vocabulary plus a back control, a stage table, and the hook notes. No nested cards: rows and cells are ruled, not boxed inside boxes.

## Do's and Don'ts

**Do** keep the hard geometry, keep states as stamps, and keep labels literal.
**Don't** soften the world with gradients, glass, or large radii, and don't put white text on mustard.

## Rank & XP

Each finished session earns XP on the server (`practice.sessions.xp`): warm-up 10 (+5 first try), ear 20 (+10), hook 35 (+15), plus 15 for finishing. The first occurrence of each stage counts, only passed stages count, and the total clamps to 1000 per session. `meta.totalXp` is the global sum across every session, and it is the single number the client trusts.

The rank ladder is `L1 0 · L2 120 · L3 300 · L4 560 · L5 900 · L6 1320 · L7 1840 · L8 2460 · L9 3180 · L10 4000`, with titles OPENING ACT (L1-2), SIDE PLAYER (L3-4), SESSION PLAYER (L5-6), HEADLINER (L7-8), BANDLEADER (L9-10). `RankLine` sits inside the ink TONIGHT block; `XpBand` is a hard-ruled floor-to-next bar with tabular numbers; `RankCard` heads the Ledger; `LevelUpBlock` appears on the summary only when the session crossed a level.

## Skins

Six palettes are defined as `[data-skin]` blocks after `:root` — color tokens only, never component selectors. Skins change palette only: geometry, type, shadows, spacing, and motion are identical, so every surface stays legible in every skin.

| skin | level | scheme | ground / ink | signal |
| --- | --- | --- | --- | --- |
| PAPER | 1 | light | `#f2f0e9` / `#111111` | `#e5342b` |
| BLUE NOTE | 2 | light | `#edf0f4` / `#0d1b2a` | `#2f5ce0` |
| SMOKE | 3 | light | `#e7e5e1` / `#171717` | `#c14a3a` |
| KRAFT | 5 | light | `#e8dcc8` / `#231a10` | `#b8451f` |
| SAGE | 7 | light | `#e6e9e0` / `#141a15` | `#3a7a48` |
| REEL | 9 | dark | `#121212` / `#ece9df` | `#ff6a4d` |

Each block sets `--scheme`, `--bg`, `--panel`, `--field`, `--ink`, `--muted`, `--line`, `--focus`, `--signal`, `--signal-ink`, `--ok`, `--ok-ink`, `--due`, `--muted-on-ink`, `--on-fill`, `--accent-soft`, `--warn-soft`, `--neutral-soft`, `--row-hover`, `--dot-off`, and `--heat-1..4`. The stored preference (`mpl.skin` / `mpl.skinMin` / `mpl.level`) is read by an inline boot script before first paint; a locked skin silently falls back to PAPER without erasing the preference.

REEL inverts by construction: `--ink` becomes light, so the masthead, TONIGHT block, HOOK, session bar, and active nav flip. `--muted-on-ink` is dark (`#3a3833`) there, and `--on-fill` is near-black (`#101010`) so fills keep readable text.

## Tokens and the fixed signal

`--signal` is now defined in `:root` and every skin; it had been referenced by the START button without a value, leaving the primary action unfilled. Small signal text uses `--signal-ink`, never `--signal`. `--on-fill` is text placed on a filled control; `--field` is an input/raised surface, distinct from `--panel`. `color-scheme: var(--scheme)` lets form controls follow the active skin's light/dark scheme.
