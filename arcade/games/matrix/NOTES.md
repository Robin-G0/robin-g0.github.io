# Matrix / Construct rework (2026-11-20)

`games/matrix.js` re-exports three engines from `games/matrix/`: `parry.js`, `binary.js`,
`gravity.js`, with `display.js` (terminal text in Share Tech Mono, block cursor, code rain,
Construct floor grid, ripples, square-cell meters) and `tutorials.js` (three SVG cards per
engine, class `matrix-diagram`, plus captions and Controls lessons). Room, card and greeting
styling is in `themes/matrix.css`. All three are `illustrated:true` (engine-owned feedback and
sound, portrait boards) and use score rules v2; v1 boards and links stay separate.

Appearance: every canvas, card and room colour is a palette token (`bg ink muted border accent
soft gold` from `assets/profile.json`), so light and dark appearance both stay phosphor-green on
near-black, as the site theme does. Gold is the danger/heavy colour; shape always carries the
same meaning (chevrons, hatching, hollow vs. lit cells). Decoration (rain, cursor blink, ripples,
ghost trails) is a pure function of simulation time and never touches gameplay RNG; reduced
motion freezes it without changing rules (tests compare whole states).
Era animations kept deliberately few: blinking block cursor, code rain, bullet-time ripples and
afterimages, code decoding into register cells, a padlock shackle lifting.

## Construct Parry (`parry`, survival, six commands, precision `full`)

The Agent telegraphs a strike for .7 s (blinking block at its hand, lit arm), then it flies to
the player's left or right hand. Each anatomical wrist guards its own side and must answer the
chevron the strike carries: `↑` block, `←`/`→` sweep. Answers count only in the solid guard zone
(last 45% of the path, from p=.55): 10 at the edge rising to 30, a parry at p>=.92 or during the
.25 s real-time contact grace scores 50. One move answers every matching strike on that side.
Wrong or empty moves are harmless. A landed strike costs one life, clears the board and gives
1 s recovery (simultaneous hits cost one life).
Stages (simulation seconds): 0 jabs (`↑` only), 20 outward sweeps, 40 inward sweeps, 60 heavy
strikes (centre path, gold double chevron, slower travel x1.4, zone from .45, need both wrists
`↑` within 1.2 s in either order, score x2, followed by an extra 1.2 s gap), 85 flurries (a
second matching strike .45 s behind; one move takes both). Six answers in a row start 4 s of
bullet time: world time runs at .5 (strikes, spawns, rain), with afterimages.
Travel max(1.8, 2.6/pace) s, spawns every max(1.3, 2.3/pace) s, at most 8 strikes.
Why six commands: a sideways sweep is the natural parry gesture and adds a read (which arrow)
on top of timing, while the up-block stays the first, easiest move. It uses the host's
`popupProfile`, per wrist/direction cooldown, six touch buttons and camera guides through
`inputScheme:'wrist-directions'`. Precision `full` because sideways reaches benefit most from the
heavier model.

## Binary Lock (`binary`, 24 s score rounds, two raises, precision `low`)

L rotates the register one cell left (the head bit wraps to the end); R flips the head bit under
the blinking cursor. Make the register equal the KEY. Every lock is generated with an exact
shortest solution by breadth-first search (`shortest`, `makeLock`), shown as `par`; `| / x`
marks between rows show equal / different cells. Score 20 x par, doubled when solved in par
(`CLEAN`); three clean locks in a row restore an attempt (cap 3). The host round clock (24 s
divided by base pace and the shared pressure factor, 3 s minimum) renews on each unlock and waits
during the 1.1 s opening animation (`state.solved`). A timeout spends an attempt (HUD:
Attempts) and the engine loads a fresh lock (`TRACE LOST`). Stages by lock number: 4 bits with
par 2-3, 5 bits from lock 4, one sealed (hatched) cell from lock 7 (a flip at a sealed head is
refused harmlessly; the seal travels with its bit), 6 bits from lock 11; par target
min(bits+2, 2+floor((lock-1)/2)). Precision `low`: two plain raises, no placement.

## Gravity Switch (`gravity`, survival, two raises, precision `low`)

A wall run up a shaft of code. Raise L: gravity pulls to the left wall; raise R: right wall
(raising the current wall is harmless). Switching takes .32 s. Rows stream down at
min(2, pace) units/s from a 3-unit horizon, one every max(1.1, 2.4/pace) s. Ledges cover their
wall up to 55% of the shaft (be on the other wall; mid-switch is hit); from 30 s beams cover the
middle 70% (be on either wall, never mid-switch as one passes). Code pickups score 10 x chain
(chain up to x5; a pickup passed on the other wall resets it); safe-side code from the start,
far-wall lure code from 15 s. Every eighth pickup is a hardline: +100 and a life (cap 3). Each
ledge/beam passed is +10. A hit costs a life with 1.2 s recovery. Ledges lean to alternate
sides (65%) so the shaft keeps asking for switches; idle play loses within a minute.

## Tests

`tests/matrix.test.mjs` (deterministic, seeded): per-side answers and arrow matching, zone and
contact scoring, flurries, heavy both-wrist window in both orders, single-life hits, stages and
bullet time; Binary move rules, BFS par, generated locks at stated par for every stage, scoring,
clean-run attempt, ignored inputs while opening, sealed refusal, host timeouts loading fresh
locks; Gravity collisions, switch timing, chain/hardline scoring, recovery. Simulated players
with at least 1 s between inputs survive 150 s of Parry (all stages, >1500 points), 180 s of
Gravity, and a BFS planner moving every 1.5 s opens 20+ locks over 300 s. Idle play loses in all
three; reduced motion leaves state identical; pause/restart; versioned scores and links.
These are simulated cadences, not evidence of physical comfort or webcam accuracy.
`tests/browser/matrix.spec.mjs`: cards, native profiles (six commands for Parry, two raises
otherwise), local pulse feedback without the generic playfield label, canvas hygiene (no game
title), phone/landscape fit and 44 px buttons, unattended Game over with v2 links and replay,
bundled font in both appearances; `MATRIX_SHOTS=<dir>` saves review captures.

Two isMobile/touch captures (390x844 portrait, 844x390 landscape) step through the three cards,
play with taps and wait for the result screen for every game, and assert that every opaque canvas
text is at least 14 CSS px (scale = canvas CSS width / 720). Layout is host-owned: `themes/matrix.css`
only skins (colours, borders, fonts, shadows) and sets no size or position on the player, stage,
inputs, toolbar, camera dock or overlays. Boards place everything in proportion to the logical
height, so a ~370x380 CSS px stage (logical ~720x740, compact) keeps key objects at 24+ CSS px
(strikes ~33, register cells ~45, pickups ~27, ledges ~24 high).

Precision: Parry `full` (six commands with sideways reaches gain most from the heavier model);
Binary and Gravity `low` (two plain raises, no placement within a box).

Shared test change: `tests/challenges.test.mjs` asserted that only `popups` is directional; it
now checks `inputScheme === 'wrist-directions'`, which Parry also declares.
