## Aqua engines (reworked 2026-11-20)

`games/aqua.js` re-exports three modules in `games/aqua/`. `display.js` draws the
Mac OS X Aqua materials on the canvas: pinstriped window bodies, brushed-metal bars,
lickable gel capsules (rim, deep body, caustic glow, specular cap), glass marbles,
traffic-light buttons (red ×, yellow −, green +), the candy-striped progress bar,
an original rainbow wait cursor, the genie curve, the Dock "poof" and an
iTunes-style status display in a brushed toolbar. Canvas text uses the Lucida
Grande stack (Lucida Grande, Lucida Sans Unicode on Windows, then Verdana and the
already bundled Open Sans); no font or Apple artwork was added. Colours follow
the theme palette in `assets/profile.json`; dark appearance draws the same
materials in graphite. `tutorials.js` holds three SVG cards per engine (class
`aqua-diagram`, animated by `themes/aqua.css`: default-button throb, tilt and
roll, gel growth, Dock bounce and magnification, wait-cursor spin; frozen for
reduced motion), captions and the Controls lessons. All three set
`illustrated:true` (engine-owned feedback and sound, portrait boards) and score
rules v2; the v1 boards and friend links stay separate.

Screen hygiene: the toolbar display shows live status only (gates, sheets,
answered; streak or the next unlock), never the title or lives.

- Marble Gates (`marble`, two raises, survival, precision `low`): brushed-metal
  shelves rise toward a striped ceiling at `.3 x pace` rows/s. A raise tilts the
  tray; the marble rolls 2.6 lanes/s that way and drops through the FIRST gate it
  meets on that side (7 lanes). The tray levels on landing unless a tilt was
  raised during the fall. A shelf reaching the ceiling (row .2) crushes the
  marble: one life, 1.4 s grace, respawn near row 2.6. With nothing below, the
  marble rests on the floor (row 5) until a solid shelf rises under it. Gates:
  blue plain 10; green + zoom 30 (from 15 s); red × close costs a life (from
  35 s); yellow − minimise falls through the next shelf too, 20 (from 60 s).
  Five safe drops in a row raise the multiplier (x2, x3, up to x4); a life loss
  resets it. Generation: a shelf's gates never sit under the previous shelf's
  gates (every normal drop lands on metal) and a red gate is always the middle of
  three, so from any landing one side's first gate is safe. Decision: which side's
  first gate to take, with its kind, distance and the next shelf in view.
- Gel Factory (`gel`, two raises, 18 s score rounds, precision `low`): a gel
  button is extruded and grows from .14 to 1.0 of its width in
  `max(1.8, 2.6 - .05 x sheets)` s, then pops harmlessly. An order hangs from a
  window title bar as an Aqua sheet with slots S/M/XL (.40/.63/.86; XL rather than L so sizes never read as the L wrist), drawn at true
  size. L stamps the leftmost empty slot, R the rightmost (one slot: either).
  The stamp is judged at the gesture's timestamp (`event.at`): within .03 exact
  (40), within .085 fits (20), otherwise "too small/too big" (0, no life, loses
  the clean bonus). Every stamp starts a new button after a .5 s refill (raises
  during the refill or while a sheet ships are harmless), so the order of stamps
  is the plan. A full sheet ships (slides up, `solved` pauses the round clock for
  .8 s): slot points plus a clean bonus 20, 30, 40 ... capped 60 for clean sheets
  in a row. Stages: one slot for the first three sheets, then two, from the
  eighth sheet two or three. The tick marks under the button and the slot glow
  (default-button throb) show when it fits. Timeouts spend Attempts (host).
- Dock Bounce (`dock`, six directions, survival, precision `full`; replaces Dock
  Shuffle): seven original glossy icons on a translucent Dock with
  magnification and a name tag at the pointer. Either wrist's sideways sweep
  (`*_left` / `*_right`) glides one icon (the ends are harmless); `left_up` opens
  the bouncing app under the pointer, `right_up` force-quits a hung one (wait
  cursor). A wrong verb only breaks the streak; clicking a quiet icon is
  harmless. Requests never spawn under the pointer, every `max(3.4, 4.6/pace)` s
  with fuse `max(8, 12/pace)` s shown as a candy-striped bar. Points: open 20,
  quit 30, plus up to 20 for speed; urgent ! requests x2 with a .7 fuse. A
  request that runs out costs a life; every eighth answer restores one (cap 3).
  Stages: one request at a time; two at once from 20 s; hung apps from 40 s
  (40%); urgent apps and three at once from 70 s. Opening genies a window out of
  the icon; quitting poofs.

Precision recommendations (`precision` in the catalog): Marble and Gel use two
raises with broad Up boxes and judge time, not hand placement, so `low` (Lite
model) is enough. Dock uses the six-box popup profile where sideways sweeps must
be separated from raises: `full`.

Host integration: `pressure.js` moves `dock` from rounds to survival (marble
survival, gel 18 s rounds unchanged). Dock's catalog line sets
`inputScheme:'wrist-directions'` and a six-command `controls` map, so
game-config selects `popupProfile`, its per-wrist/direction cooldown, buttons and
guides. The shared `tests/challenges.test.mjs` assertion was generalised from
"only popups is directional" to "`inputScheme` decides directional".

Tests: `tests/aqua.test.mjs` covers gate generation over 600 shelves (no aligned
gates, red only between safe gates, stage unlocks), first-gate rolling, kinds,
minimise, crush/grace/floor pick-up, gel sizing/fit bands/slot ownership/staged
sheets, latency-compensated stamps, refill and ship harmlessness, clean bonus,
Dock verbs, wrong-verb and edge harmlessness, timeouts, heart restore, stage
concurrency, hangs and urgency; idle loss for all three (Marble and Dock within
a minute, Gel through three round timeouts), reduced-motion state equality,
bounded arrays, pause/resume/restart through the runner, catalog/profile/score
version wiring. Simulated players with at least 1 s between inputs: a
nearest-safe-gate reader keeps all lives for 300 s with 100+ gates while random
tilting loses with under a third of the score; a stamper with +/-.08 s timing
error ships 40+ sheets in 300 s without timing out; a nearest-feasible Dock
player lasts 120 s+ and answers 30+ apps (typically 150-200 s). These are
synthetic cadence checks, not evidence of webcam comfort or fun.
`tests/browser/aqua.spec.mjs` covers cards, native profiles (two raises / six
directions), local pulse feedback, canvas-local feedback, phone/landscape fit,
unattended Game over with v2 scores and a challenge link, and dark appearance.

Phone and cost notes: compact (painter.compact) layouts use logical text of 28 or
more (about 14 CSS px on a 370 px stage) and objects of 48 or more; tutorial SVG
labels never go below 15 units. The pinstripe backdrop is one cached pattern per
appearance; small gel items use an offset shadow instead of shadowBlur and
hairline streaks are only drawn on bars at least 20 units tall. A simulated
10 s of play costs about the same browser time as Metro Tile Drop under
Playwright's fake clock. `themes/aqua.css` is skin only (colours, borders,
fonts, shadows); the one layout value kept is `flex: 0 0 auto` on
`.guide-figure`, as in Metro, so a card never overlaps its title. Known shared
gap: at 320 px the six Dock buttons overflow by a few pixels because
`arcade.css` narrows the six-button row only for `[data-engine=popups]`.
