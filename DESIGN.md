---
name: Brutalist Music Lab
description: MIDI practice drills with a brutalist practice ledger.
colors:
  paper: "#f2f0e9"
  panel: "#f7f6f1"
  ink: "#111111"
  muted: "#6a6a63"
  signal: "#e5342b"
  due: "#8a4a06"
  ok: "#14893b"
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

## Typography

Monospace throughout at a readable floor, with large tracked masthead type and small uppercase labels.

## Layout

Single 860px column of bordered blocks. Navigation is a row of hard-edged tabs that scrolls on narrow screens.

## Shapes

Square corners, 3px borders, and hard 4px offset shadows. No rounded cards.

## Practice habit

The first block on the Practice tab is a single dark-outlined paper card: `DAILY HABIT`, the live status, a heavy `MUSIC PRACTICE` heading, one full-width signal-red button, and the same button in sage green once today is logged. It is the one cloud-connected control in the app; the exercise ledger stays local.

## Do's and Don'ts

**Do** keep the hard geometry, keep states as stamps, and keep labels literal.
**Don't** soften the world with gradients, glass, or large radii, and don't put white text on mustard.
