# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Justin, practicing MIDI drills and tracking music practice. At the keyboard, on a laptop with a MIDI controller. Also in bed or on the couch on an iPhone, thumbs only, no hardware. The graded SET is the desktop run; the phone gets SEVENTH HOUSE, a goal-based chord build.

## Product Purpose
A practice tracker, a nightly SESSION, and a set of MIDI drills. It records what was practiced, runs a key-of-the-night warm-up/ear/hook sequence, and keeps a session ledger. On a phone the SESSION is SEVENTH HOUSE: build the key's seven seventh chords twice.

## Positioning
A brutalist practice notebook with real MIDI input, not a gamified course: drills are modules, and practice history is the record.

## Operating Context
Used at an instrument with a MIDI keyboard connected, and on a phone in bed with no keyboard at all. Input is auto-selected and never asked for: a connected MIDI keyboard wins; with no keyboard, a twelve-key touch pad feeds the same note stream. Drills grade pitch classes collected over time, on silence, so one thumb entering a chord one note at a time is a complete input. The CHANGES round scores real octave movement and stays keyboard-only; on the pad it offers SKIP instead of a dead START. Sessions are short and repeatable. New drills are added as modules in code.

On a touch-only device SEVENTH HOUSE is the SESSION. The wheel still sets the key and the run never offers a key chooser. The goal is the seven diatonic sevenths of that key, each built correctly twice — 14 chords, then done. A seeded queue holds the owed clears; a correct answer consumes one, a wrong answer pushes one back onto the end, so only correct answers move the goal and the run always terminates. A chord station freezes the clock and the note stream and is solved at whatever pace he likes; 4–6 single notes of the timed stream sit between stations. Because nothing is on a clock, a stalled frame costs accuracy and never the goal.

## Capabilities and Constraints
Vite + React, Web MIDI, Vercel serverless + GitHub Pages static deploys. New nav sections in ROUTES, drills in src/drills, chord templates in chordData. No accounts. Drill and exercise history stays in local storage; SESSION is client-first and syncs idempotently to practice.sessions through /api/sessions. The daily Music practice habit posts one event to the vault's Postgres through a serverless endpoint, and the vault's Habits page reads it back.

Every finished session earns XP, derived server-side from the stages that passed (first-try playing earns a bonus) and stored on the row; the ledger shows a global XP total. XP drives a ten-level rank ladder from OPENING ACT to BANDLEADER. Each level unlocks a palette skin (PAPER, BLUE NOTE, SMOKE, KRAFT, SAGE, REEL); the wardrobe lives inline in the ledger, and the chosen palette persists and boots before first paint. Skins change color only, never layout.

The ear and hook phrases can be composed by an LLM through /api/plan. Generation is best-effort and time-boxed on both ends: a valid plan is used, and any delay, missing key, or malformed response falls back to the deterministic local composition, so START never waits for the network.

The CRATE spends level progress on loot: each rank level earns one box, and a box contains a record sleeve plus the artist card for that record. The crate is local to the device, uses the bundled jazz dataset, and reads public album art and artist portraits best-effort.

The touch pad (NotePad) is one octave of pitch classes, and it enters notes through the same subscribe() seam as MIDI: a pad tap is injected into the MIDI context, so drills, the session stages, and every subscriber see one note stream and no drill knows which input fired. It renders only when no keyboard is connected on a coarse pointer or a browser without Web MIDI, so desktop behaviour is unchanged and there is no input chooser anywhere in the app.

SEVENTH HOUSE is touch-gated, not width-gated: `START TODAY` opens it when no keyboard is connected on a coarse-pointer or Web MIDI-less device, and the same button keeps the graded set on desktop. Its keys are a real one-octave piano (PianoKeys), and taps enter the same note stream through the same seam. The queue is 14 slots seeded per date and key; a correct station consumes one and a wrong one pushes one back to the end. The run is client-side and writes one ledger row carrying its measured duration; a completed house earns a flat 35 XP and an abandoned one earns none.

On touch the nav drops the FREE PLAY door (the route still renders when deep-linked) and the desk drops the MIDI gate, the CLASSIC SESSION link and the graded stage preview, replaced by SEVENTH HOUSE's three-step plan. Desktop is untouched.

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
6. The input follows the device: keyboard if present, pad if not, never a mode the user has to find.
7. The phone session ends at a countable goal — fourteen chords, not a clock — and shows how many are still owed.

## Accessibility & Inclusion
Secondary text and badges at 4.5:1 or better; keyboard focus; reduced motion respected.