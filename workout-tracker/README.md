# Road to 21K — Workout Tracker

A personal training tracker for a runner preparing for a 21km (half marathon) race, combining a progressive running plan with a home dumbbell strength program.

## Features

- **Countdown & phase tracking** — days remaining to race day and the current training phase (base, build, peak, taper, race week).
- **Auto-generated training plan** — a running + strength schedule that adapts week to week as race day approaches: builds long-run distance towards a peak, then tapers, ending in a race-week schedule and a Race Day card.
- **Home dumbbell strength program** — two alternating full-body sessions (Strength A & B) with warm-up, cool-down, sets/reps and form tips, designed around running-specific needs (single-leg stability, glutes/hamstrings, calves, core).
- **Logging** — check off each day's workout; for runs, log distance and time to get an automatic pace calculation.
- **History & totals** — total km run, sessions completed, longest run, and current streak.
- **Configurable race date/name** — change these any time in Settings.

## Running it

No build step or dependencies — it's a static site.

```
open index.html
```

or serve the folder with any static file server (e.g. `npx serve .`) and open it in a browser. It also works as-is on GitHub Pages.

## Data

All data (settings + logged workouts) is stored in the browser's `localStorage`. Nothing is sent to a server — it's fully client-side and private to your browser.
