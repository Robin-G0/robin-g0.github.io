# Material rework (2026-11-20)

Theme entry `games/material.js` re-exports three engines from `games/material/`: `tangram.js`,
`golf.js`, `balance.js`. `display.js` holds the Material drawing kit (paper sheets with a two-shadow
elevation, surface tint by dp in dark mode, ink ripple, chips, linear progress indicator, FAB,
snackbar, standard/decelerate/accelerate curves, Roboto canvas type). `tutorials.js` exports
`diagrams`, `captions` and `lessons` (three SVG cards per engine, class `material-diagram`).
Room styling lives in `arcade/themes/material.css`.

All three: `illustrated:true`, engine-owned feedback and sound (`feedback → hideAll`), portrait
board, simulation-time animation, seeded `env.random` for rules only, bounded bursts (6), effects
(16) and snackbars (2). Hand loss never pauses. Reduced motion only removes movement (ripples become
a steady tint, entrances and flights jump to their end); state and scores are identical (tested).

## Identity

- Palette: the site's Material theme from `assets/profile.json` through the painter (bg, ink,
  muted, border, accent, soft). Pieces/cards use Material 500 tones in light and 200 tones in dark
  (`swatch()`), with white or near-black text accordingly. The canvas floor is bg tinted 45% toward
  soft in light mode so white sheets read as raised paper; dark mode uses the theme bg with the 2019
  dark-theme white overlay per elevation.
- Type: Roboto (OFL, latin variable subset, `assets/fonts/roboto.woff2`, licence `roboto-OFL.txt`,
  recorded in `SOURCES.json`) for room, cards and canvas; buttons use uppercase medium tracking.
- Room: app bar in the accent colour, dialog at 24 dp, raised buttons that lift 2 → 8 dp with a CSS
  ink ripple when the host pulses an accepted input, flat text buttons for Back/Skip/Challenge,
  stepper circles, the walkthrough card entering on the decelerate curve. Phones get a taller stage
  (`clamp(300px, 100dvh − 330px, 500px)`), and the engines lay out by the resulting height.
- Motion vocabulary only: ink ripples at the touched object, elevation lift on press, shared-element
  flights (piece into outline, card into tray), staggered entrances, snackbars for stage unlocks.

## Paper Tangram (`tangram`, score rules v2, survival, six-direction input, precision `full`)

Turn a loose paper piece until it matches a dashed outline pressed into a sheet; it drops in by
itself. Sweep ← turns counter-clockwise, sweep → clockwise, raise ↑ flips it over (screen-space
mirror: R(t)·F^m → R(−t)·F^(m+1)). Wrong turns are harmless; only the piece's clock (the linear
progress bar on its sheet) costs a heart.

- Clock `max(4.5, 8 / pace)` s, ×1.6 per piece in the two-piece stage. Timeout: crumple, −1 heart,
  combo reset, the other piece's clock waits 0.9 s so one lapse never costs two hearts.
- Fit: 10, plus 10 when done in the fewest moves (breadth-first over the eight orientations), times
  combo `min(4, 1 + floor((streak − 1) / 4))`. Drop-in lock 0.45 s (inputs harmless).
- Stages by fits: 0 turns only (4 tier-0 shapes, start upright, outline turned 1–3 quarter turns);
  5 mirrored outlines (balanced bag of 2 plain / 2 mirrored); 12 two pieces, the left wrist owns the
  left piece and the right wrist the right one; 24 five-square shapes join. Snackbar on each unlock.
- All eight shapes are chiral (tested), so a mirrored outline always needs a flip; any outline is
  at most three moves away.
- Why six directions: turning a piece is naturally a sideways sweep and flipping is a distinct raise;
  wrist ownership makes the late stage a two-handed decision. It uses the existing popupProfile with
  its 200 ms per wrist/direction cooldown. Precision `full` because six regions depend on clean
  lateral reaches (the Full/Heavy model helps there).

## Ripple Golf (`golf`, score rules v2, 24 s score rounds, two raises, precision `low`)

A straight paper fairway of cells. L chips one cell, R drives three. Ripple pads push the ball one
more cell (chained). The ball must stop exactly in the cup. A shot into water or past the end of
the sheet costs the stroke plus a penalty stroke and sends the ball back to the tee. Two chips on the
fairway (filled = safe, red outline with ✕ = lost) preview where each club stops now.

- Par = fewest strokes (breadth-first). Holing out at par scores 50 + 10 per previous consecutive par
  (capped +50), one over 30, otherwise 10. Holing out renews the host round clock (24 s, shrinking by
  the shared pressure factor); the clock waits while the ball drops (`solved`). Timeouts spend
  attempts.
- Stages by holes: 0 4–6 cells, no hazards; 2 water (1); 5 6–10 cells, 1–2 water, up to 1 pad;
  9 8–12 cells, 2–3 water, up to 2 pads. Some resting cells are dead ends (both shots lost), so the
  obvious drive-first line can fail: `TRAP_SHARE = [0, .25, .5, .6]` of holes per stage are generated
  so it does (`greedyFails`). Measured: drive-first is trapped or over par on ~45–60% of late holes.
- A scorecard row of chips under the sheet shows the last six holes (par filled, +n outlined).
- The previous version (power cycle + stroke) had no decision worth repeating.

## Paper Balance (`balance`, score rules v2, survival, two raises, precision `low`)

A hanging mobile with two trays. Each weight card (numeral plus pips) falls down the middle for
`max(1.8, 4.5 / pace)` s; raise L or R to lay it in that tray (a shared-element flight). Unplaced
cards fall into the lower (heavier) tray, right when level, so idle play tips.

- When both trays weigh the same the mobile levels and clears: `5 × cards²`, ×2 per gold card (cap
  ×4). Building a bigger level is the risk: it tips (−1 heart, both trays spill, 1.2 s recovery)
  when the sides differ by more than 4 or a tray takes a sixth card. Five capacity dots under each
  tray, the beam turns amber one step from tipping, and a Material discrete slider (−4…4, red ends,
  value pin) shows the imbalance. The next card is shown at the top right.
- Stages by levels: weights 1–2; 3 → 1–3; 8 → 1–4; 14 → one gold card per bag. Bags are balanced
  (two of each weight) and seeded.

## Tests

`tests/material.test.mjs` (14 tests): orientation algebra and chirality; tangram turn/flip/fit
scoring, harmless wrong turns, timeout and idle Game over, stage unlocks and wrist ownership; a
planned tangram player at one input per second for 300 s (3 seeds, >40 fits after the first minute,
no loss); golf landings, par, hole generation over 40 seeds × 5 stages, scoring/penalty/back-to-tee,
idle Time up through the real GameRunner, a planning player sustaining ≥40 holes in 300 s at one shot
per second and out-scoring drive-first; balance levels, gold, tipping, capacity, auto-landing, idle
Game over, reduced-motion state equality, a preview-aware player placing 1 s after each card for
300 s without losing (≥60 levels) while random placement tips out earlier; catalog/config/score
version/challenge isolation; pause and restart through GameRunner.
`tests/browser/material.spec.mjs`: cards, profiles (six inputs for tangram, two raises otherwise),
local pulse feedback without the generic bubble, HUD labels, pause, phone/landscape fit with 44 px
targets, unattended Game over / Time up with v2 scores, challenge link and replay, Roboto in dark mode.
`MATERIAL_SHOTS=<folder>` adds a screenshot pass (light/dark × desktop/phone, every card).

These are synthetic cadence checks. They do not establish webcam comfort or fun.
`tests/challenges.test.mjs` now expects `directional` to follow `inputScheme`, not the popups id.
