# BRUTALIST MUSIC LAB

A purpose-built, no-nonsense music practice machine. Two tools, one static app,
zero backend. Everything persists in `localStorage` on your device.

- **PRACTICE TRACKER** — spaced-repetition tracker for practice items. Open it,
  see what needs practice, click a status, leave.
- **CHORD TRAINER** — a MIDI-driven diminished-7th drill (with NORMAL, LIGHTNING,
  and SURVIVAL modes) plus a non-MIDI QUIZ fallback.

Built with React + Vite. Plain CSS. No auth, no database, no cloud.

## Practice Tracker

Each item has a name, a status, a last-practiced date, and a computed next-review
date. Statuses drive the spaced-repetition interval:

| Status   | Next review |
| -------- | ----------- |
| New      | +1 day      |
| Good     | +3 days     |
| Mastered | +7 days     |

- Overdue items are flagged **NEEDS FOCUS** and sorted to the top.
- Click **New / Good / Mastered** to log a practice session — this stamps the
  last-practiced date and recomputes the next review.
- Add and delete items freely. Everything survives a refresh.

Seeded exercises: ii–V–I, ii–V–i minor, Turnaround, Intervals,
Up and down C ii–V–I, Diminished 7th chords.

## Chord Trainer

### The three diminished families

A diminished-7th chord stacks minor thirds, so it repeats every 3 semitones —
all 12 chords collapse into 3 pitch-class families:

- **Family 1:** C · Eb · Gb · A  → C°7 = Eb°7 = Gb°7 = A°7
- **Family 2:** C# · E · G · Bb  → C#°7 = E°7 = G°7 = Bb°7
- **Family 3:** D · F · Ab · B   → D°7 = F°7 = Ab°7 = B°7

### MIDI drill

The app shows a target (e.g. `PLAY: Bb°7`). Play it on your keyboard. Recognition
ignores octave and inversion, compares unique pitch classes, and accepts the
notes played all at once or built up one at a time. Once four unique pitch
classes arrive, the answer is graded automatically.

Modes:

- **NORMAL** — endless, no timer.
- **LIGHTNING** — 60 seconds, as many correct chords as possible.
- **SURVIVAL** — 3 lives, one wrong chord costs a life.

Tracked stats: score, current streak, best streak (persisted), accuracy, and
correct/attempted.

### QUIZ (no MIDI required)

Multiple-choice drills: chord name → notes, notes → chord name, and chord name →
family, with an optional 5 / 10 / 15 second timer. Score and streak persist.

## MIDI setup

1. Plug in a USB MIDI keyboard.
2. Open the **CHORD TRAINER** tab and click **CONNECT MIDI KEYBOARD**.
3. Grant the browser's MIDI permission prompt.
4. The first available input is selected automatically; switch inputs from the
   dropdown if needed. A green dot means connected, and held notes show live.

### Recommended browsers

The Web MIDI API works in **Chrome** and **Edge** (desktop). Safari and Firefox
do not support Web MIDI — the app detects this and points you to Quiz mode
instead of crashing.

## Run locally

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

Requires Node 18+ (built and tested on Node 20).

## GitHub Pages deployment

Deployment is automatic via GitHub Actions. On every push to `main`, the workflow
in `.github/workflows/deploy.yml` builds the app and publishes `dist/` to GitHub
Pages — no manual upload of the `dist` folder.

One-time setup: in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions**.

The Vite `base` is set to `/music-practice-lab/` for production builds so asset
URLs resolve correctly under the Pages subpath. Live at:

```
https://justinfisherr.github.io/music-practice-lab/
```
