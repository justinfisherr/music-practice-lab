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
