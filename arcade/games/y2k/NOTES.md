# Y2K Chrome games: rules and tuning (reworked 2026-11-20)

`games/y2k.js` re-exports three engines from `games/y2k/`: `orbital.js`, `beat.js`, `reactor.js`, with
`display.js` (Orbitron canvas text, chrome gradients with the site header's banding, translucent candy
plastic, starbursts, lens flares, a palette-wash backdrop, bounded bursts/effects, chrome shatter) and
`tutorials.js` (three SVG cards per engine, class `y2k-diagram`, captions and Controls lessons). Room,
card and result styling lives in `arcade/themes/y2k.css`. All three use the illustrated host policy
(engine-owned feedback and sound, portrait board), survival pressure (`core/pressure.js`, unchanged)
and score rules **v2** (v1 was the previous prototype rules). Colours come from the theme palette in
`assets/profile.json` through painter tokens (`accent` = left / indigo, `gold` = right / grape), so the
canvas, cards and room follow light and dark appearance; chrome stops are fixed like the site header.
Reduced motion freezes decoration only (shield easing, lava blobs, spectrum bars, shatter motion).

## Orbital Breaker (`orbital`, two raises, precision `low`)

A chrome shield orbits a candy planet in six sectors. L turns it one sector anticlockwise, R clockwise
(the shield's end chips are labelled L and R so the direction is readable at any angle). Comets fly in
along the sector lines; the ring lights where one will land. The shield breaks a comet that reaches its
sector; a comet reaching the planet costs a life and the streak.

- Schedule: first comet at 3.5 s; gap `max(1.5, 2.9/pace) × (1 + .25 r)`; travel `max(3.4, 6/pace)`.
  The next sector is within `min(3, floor(gap / 1.1))` of the previous one, so every comet is reachable
  at one turn per 1.1 s.
- Points 10 × level, level `min(4, 1 + floor(streak/6))`; every 15 breaks in a row restore a life.
- Stages add choices, not speed: star shards from 20 s (optional, 30 × level, anywhere: detour or not);
  solar flares from 45 s between comets, in a sector at least two away from both neighbouring comets
  (never on the short path), harmless unless they meet the shield, which costs a life.
- Precision `low`: only two coarse raises; no fine placement.

## Chrome Beat (`beat`, six commands, precision `full`)

Two Winamp-style lanes, one per wrist (`inputScheme:'wrist-directions'`, popupProfile and its 200 ms
per wrist/direction cooldown via game-config). Notes slide to chrome pads; play the move each note shows:
raise = tap ↑ (pill), sideways sweep = scratch ← / → (vinyl disc). Chords (wide L+R bar) need both raises.
Static (hollow zig-zag with ✕) must be left alone.

- Window ±.40 s GOOD 10, ±.15 s PERFECT 25 (the note rings white while touching the line); chords pay ×2.
  Multiplier `min(4, 1 + floor(streak/8))`; every 16 in a row restore a life.
- An empty, early or wrong-direction move only breaks the streak (spamming is not free, but costs no life);
  a wrong move leaves the note playable. A missed note or touched static costs a life.
- One note per beat, beat `max(1.05, 1.6/pace)` s (≥1 s between decisions always), lead `max(1.6, 2.4/pace)`.
  Fixed opening L, R, L, R at 3/4.6/6.2/7.8 s; warm-up: misses before 12 s cost no life.
- Stages: chords 15 s, scratches 30 s, static 50 s; rest 12 %, chord 20 %, scratch 35 %, static 15 %.
- Precision `full`: scratches are sideways sweeps into the side boxes; the six-region profile benefits from
  the heavier model. Keyboard: A/W/D left wrist, J/I/L (or arrows) right wrist.

## Reactor Balance (`reactor`, two raises + chord, precision `low`)

Plasma orbs drop into a chute one at a time; L pours into the left core, R into the right. A core at
exactly 10 FUSES (100 × fusion streak up to ×4, empties, +1 vent charge up to 3); above 10 it MELTS DOWN
(a life, empties, streak reset). Each fill scores 5. The dashed mark in each core shows where the current
orb would land (starburst at an exact 10, ! above it) and "need N" what is missing. Two orbs are previewed.

- Both raises within .12 s (either order, Lander grammar) vent the orb for one charge; with no charge the
  vent is refused and the orb stays. A single raise pours after the .12 s window, flushed early if the
  fuse is about to run out. Pause clears a pending pour.
- Fuse `max(1.8, 3.6/pace)` s, .45 s between orbs. An orb left past its fuse spills (a life).
- Seeded shuffled bags per stage: 0 s {1,1,2,2,3,3}; 30 s {1,2,2,3,3,4,4,−3 coolant}; 60 s adds 5 and spark
  orbs (2 and 3) that double the fusion they complete. Every 5 fusions restore a life.
- Precision `low`: two raises; the chord needs no extra precision.

## What the tests prove (`tests/y2k.test.mjs`, `tests/browser/y2k.spec.mjs`)

Unit: turning/wrap, block/miss/shard/flare scoring, comet reachability over six seeds and staged arrivals;
Beat windows, PERFECT, wrong wrist/move, empty raise, chords, scratches, static, warm-up, staged content
and ≥1.05 s spacing; Reactor pour rule, chord window both orders, duplicates, refused vent, spill, last-
moment flush, pause clearing, staged bags and sparks. For each game a simulated player with ≥1 s between
decisions sustains play (Orbital and Beat 180 s without losing, Reactor ≥18 fusions over ≥120 s) and an
idle run ends in Game over; reduced motion leaves state identical; the shared runner pauses, restarts and
finishes with Game over; bounded arrays; catalog/profile/precision/score-version/challenge checks.
`tests/games.test.mjs` and `tests/challenges.test.mjs` were adjusted for Beat's six commands.

Browser: three chrome cards per game with real captions; two-raise profile (orbital, reactor) and the
six-command profile (beat); local pulses without the generic playfield label; pause holds the clock;
phone/landscape fit, tutorial buttons inside the card on 320×640, 44 px touch targets; an unattended
Orbital run ends in Game over with v2 scores and a challenge link; Orbitron and the chrome header in dark mode.

These are synthetic cadence checks. They do not establish webcam comfort, sweep reliability on real
cameras or fun; the Beat scratch timing in particular needs real-player testing.
