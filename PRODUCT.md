# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Justin, practicing MIDI drills and tracking music practice at a keyboard. Desktop or laptop with a MIDI controller runs the graded SESSION; the phone is ledger-reading only.

## Product Purpose
A practice tracker, a nightly SESSION, and a set of MIDI drills. It records what was practiced, runs a key-of-the-night warm-up/ear/hook sequence, and keeps a session ledger.

## Positioning
A brutalist practice notebook with real MIDI input, not a gamified course: drills are modules, and practice history is the record.

## Operating Context
Used at an instrument with a MIDI keyboard connected. Graded SESSION stages need desktop Web MIDI; the phone can read the ledger. Sessions are short and repeatable. New drills are added as modules in code.

## Capabilities and Constraints
Vite + React, Web MIDI, Vercel serverless + GitHub Pages static deploys. New nav sections in ROUTES, drills in src/drills, chord templates in chordData. No accounts. Drill and exercise history stays in local storage; SESSION is client-first and syncs idempotently to practice.sessions through /api/sessions. The daily Music practice habit posts one event to the vault's Postgres through a serverless endpoint, and the vault's Habits page reads it back.

## Brand Commitments
Brutalist music lab: warm paper, black rules, hard offset shadows, signal red, monospace type. No emojis.

## Evidence on Hand
Real drill definitions and practice records stored in the app. No course claims, no testimonials.

## Product Principles
1. The drill is the interface; get to it in one tap.
2. Show what was practiced, not what should be.
3. Hard edges and clear labels beat decoration.
4. Readable at a music stand and in a practice room.
5. The ledger is the record: one row per session, never keystrokes.

## Accessibility & Inclusion
Secondary text and badges at 4.5:1 or better; keyboard focus; reduced motion respected.
