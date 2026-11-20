# Field Notes games: rules and tuning (reworked 2026-11-20)

`games/field-notes.js` re-exports three engines from `games/field-notes/`: `clockwork.js`,
`contour.js` (also exports `containsPoint`) and `stars.js` (engine id `stars`, export
`constellations`). `display.js` holds the notebook materials (Caveat handwriting, Georgia
print, fountain-pen ink with a faint bleed, pencil, hatching, rubber stamps, ink blots, tags,
bursts, effects) and `tutorials.js` the three SVG cards, captions and Controls lessons per engine.
All three are `illustrated:true` (engine-owned feedback and sound, portrait board) and draw only
with the site palette tokens from `assets/profile.json` (bg paper, ink, muted pencil, border grid,
accent pen ink, soft wash, gold brass) plus the room's red margin rule, so light and dark follow
the site. Decoration never draws gameplay RNG; effects run on simulation time; reduced motion
freezes decoration only. Bursts are capped at 6, effects at 12.

Precision recommendation (`precision` in the catalog): Clockwork `low` (two raises, timing
matters more than placement), Contour `medium` (two raises, but a missed turn walks the pencil off
the sheet, so reliable raises pay off), Constellations `full` (six-command sweeps benefit from the
Full model on GPU).

## Clockwork (`clockwork`, survival, score rules v2, two raises)

A regulator pendulum swings by itself (half swing 1.25 s; angle = A cos(pi t / 1.25)). Each swing
carries the bob into the left or right brass pallet band (|angle| >= 24 degrees). Raise L while the
bob is in the left band, R in the right one: +10 and +3.2 degrees of swing. Within 4.5 degrees of
the turning point (the jewel) a strike is worth +20 and +6.5 degrees. One strike per visit; a strike
up to .18 s after the bob leaves still counts (never as a jewel). Early, repeated or wrong-side
raises are harmless. A visit let pass breaks the run. Swing decays by min(4.6, 1.9 x pace) degrees
per half swing (max 42, start 34; amplitude eases at 18 deg/s). When the swing falls below the
pallets the clock stops: -1 life, rewound after 1.4 s. Twelve strikes in a row chime: +60 and a
life back (cap 3). Stages by total strikes: from 12, a pallet may carry a gold jewel (+50 at the
jewel, 30%); from 36, grit (22%, never twice running) must be let pass (striking it: -5 degrees,
run broken). Marks are chosen when the previous visit to that side closes (about one swing of
warning). Pace only raises decay; plain strikes sustain early play, jewel strikes always sustain.

## Contour Survey (`contour`, 36 s score rounds, score rules v2, two raises)

A pencil walks a 12 x 8 cell survey sheet (13 x 9 vertices) one segment every .7 / pace s
(.875 s gentle), starting at (6,6) heading up. L/R queue a relative quarter turn for the next step;
the latest raise replaces the queue. Meeting its own line closes a loop: n summits inside score
25 x n x n; a brass trig pillar counts as two (from five surveys). From two surveys marshes appear
(1, +1 every two surveys, max 5, never beside a summit); a loop around a marsh scores nothing and
costs an attempt. Walking off the sheet costs one and respawns after 1.3 s. Only the last 26
segments of line remain. Three summits are always on the sheet. The round clock renews on score.

## Constellations (`stars`, 24 s score rounds, score rules v2, six commands)

Uses `inputScheme:'wrist-directions'` (popupProfile, per wrist/direction cooldown). A figure of
4 stars (+1 per figure, max 8) is inked stroke by stroke (.55 s per link, .9 s hold) and fades;
the round clock waits while it is shown. Retrace it from memory: the candidates for the next star
are circled and tagged with the move that picks them: sweep left or right toward it with either
wrist; from the third figure a third candidate sits above and is picked with a raise. +10 per star;
a finished figure adds 10 per link, doubled without a mistake. A wrong star blots the chart, costs
an attempt and the figure is shown again. Figures keep room for every decoy; decoys only avoid the
stars visible at that step. Generation never fell back to the fixed zigzag in 1,000 seeds per size.

## Phone layout

All three draw a compact layout when `painter.compact` (stage under 480 CSS px): logical text >= 28
(about 14 CSS px on a 370 px stage), tags, bob, summits and candidate rings >= 46 logical, nothing
critical in the outer 16 logical px. Contour keeps its 12 x 8 sheet in portrait (rules never depend
on layout) and grows cells to 56. `arcade/themes/field-notes.css` only skins (colours, fonts,
borders); the six-command pad's phone layout is left to the shared player shell.

## Tests

`tests/field-notes.test.mjs`: band/jewel/grace/one-strike rules, chimes, gold and grit stages,
decay bounds, a jewel-timing player with >= 1 s between raises alive for 240 s (>= 8 chimes), idle
loss and reduced-motion state equality; Contour stepping, loop closure, 25 n^2 scoring, marsh and
edge penalties, marsh/summit spacing, trig pillars, a planning player turning at most once per two
steps surveying >= 12 summits in 180 s, idle loss; Constellations generation over 200 seeds,
show/retrace/clean/replay rules, a 1 s-cadence player through the real round clock, idle Time up;
catalog/config/precision/score versions, pause/restart via the runner, bounded arrays.
`tests/browser/field-notes.spec.mjs`: cards, native profiles (two raises; six commands for
Constellations), local feedback without the generic label, pause freezes the canvas, phone and
landscape fit, unattended Game over with v2 scores and a challenge link, Caveat and dark palette.
Simulated players prove cadence, not webcam comfort.
