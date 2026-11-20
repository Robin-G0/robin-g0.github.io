# Glass / Fluent games (reworked 2026-11-20)

`games/glass.js` re-exports three engines from `games/glass/`: `prisms.js`, `abyss.js`, `orbit.js`.
`display.js` holds the theme materials (scene backdrops with parallax layers, acrylic panels with a fixed
noise tile, the reveal light, refraction ripples, header pill, shapes, bounded bursts/effects).
`tutorials.js` exports `diagrams`, `captions`, `lessons` (three SVG cards per engine, class `glass-diagram`).
Room, walkthrough, action buttons and card animations: `arcade/themes/glass.css`.

All three: `illustrated:true`, scoreVersion 2, engine-owned feedback (`hideAll`) and sound, portrait boards,
seeded `env.random` for rules only (decoration reads simulation time and fixed hashes), bounded arrays
(bursts 6, effects 16, plus per-game caps), hand loss never pauses, reduced motion only freezes drift,
shimmer and glides. Canvas status lives in an acrylic header pill (round/stage/chain), never the game title or
lives. Every colour cue has a shape: rose triangle, mint square, sky circle; beacons/crystals are hexagons;
hazards are jagged shards with a `!` or red edge.

## Prisms (engine `prisms`, two raises, rounds 32 s, precision `low`)

A central prism sends three rays on neighbouring spokes of an 8-spoke dial: rose on spoke r, mint r+1,
sky r+2. L turns one spoke anticlockwise, R clockwise (`PRISMS.spokes = 8`). A crystal lights when the ray
of its colour points at it (`orientationFor = spoke - colour`). One turn lighting n crystals scores
10 × n². Lighting the whole set adds 20, plus 20 PERFECT when turns ≤ par (BFS `parMoves`, shown as
"par · turns"). The set rests 1 s (`solved`, host clock paused) and a new set is dealt.
Stages by sets cleared: 2 crystals, 3 from set 3, 4 from set 6 (`crystalCount`); from set 4
(`shardFrom: 3`) one dark-glass shard per set: if any ray touches it, it cracks for one attempt and
shatters. `makeSet` never lights anything for free, never puts the rotation inside the shard's forbidden arc
and always leaves every crystal reachable without touching the shard. Shared orientations (35 %) create
double/triple chances. Host round clock: each crystal is a score gain and renews the deadline; timeouts
cost attempts (`livesLabel` = Attempts). The old mirror grid (cycle-select + rotate, brute-forceable) was
replaced.

## Abyss Drift (engine `abyss`, six directions, survival, precision `full`)

Uses the Pop-up Panic six-command scheme (`inputScheme:'wrist-directions'`, popupProfile, 200 ms
per-wrist/direction cooldown, six buttons). Either wrist: sweep ← / → swims one lane in that screen
direction (walls harmless); raise ↑ pulses the bell. The jellyfish sinks through 4 lanes; objects rise at
min(1.9, .9 × pace) depth units/s from depth 4.6, one wave every max(1.3, 2.4/pace) s. Positions are lanes and
depth units, so phone and desktop are identical.
- Pulse catches every mote in the jellyfish's lane with |depth| ≤ .55 (the dashed ring). 10 × multiplier,
  multiplier 1 + floor(chain/4) up to ×4; a mote that passes uncaught ends the chain.
- Glow 100 drains 2.5/s; each pulse costs 3; motes +16 (violet +30). Glow 0: one life, refill to 60.
- Reef contact (|depth| ≤ .32, lane covered): one life, 1.3 s recovery.
- Stages: 0 s single-lane reefs and motes; 40 s two-lane reefs and trailing mote pairs; 80 s violet
  motes (×3) placed beside reefs (risk/reward); 130 s currents that push one lane when they pass.
- `makeWave` keeps a reef's open lane reachable from the previous reef's open lanes at one lane per 1.05 s.
- Precision `full`: sideways sweeps are the core move and benefit from the heavier pose model.

## Orbital Assist (engine `orbit`, two raises, survival, precision `low`)

Four rings with angular speeds [1.3, .95, .65, .4] rad/s (inner faster). L drops one ring, R climbs one;
each transfer takes .45 s at the mean speed; a raise during a transfer is kept once and flown on arrival;
edge rings are a harmless bump. Arriving on a beacon's ring within .28 rad collects it: 20 × chain (chain
up to ×4); gold relays ×3. A beacon lives max(10, 16/pace) s (gold 7 s); fading ends the chain only.
Beacons are placed so that staying on the current ring lines them up in 2.5-8 s (first stage: always a
neighbouring ring), so "wait, then change orbit" is always available. Stages: 0 s one beacon, no hazards;
30 s retrograde debris (.9 s dashed warning, one every max(2.6, 6.5/pace) s, at most 3, opposite the probe
when on its ring); 75 s two beacons and gold relays on the inner ring; 120 s debris every max(2.6, 4.6/pace) s.
Debris within .17 rad on a settled probe's ring costs a life (1.4 s recovery); probes in transfer are clear.
Moved from 24 s rounds to survival (`core/pressure.js`). Precision `low`: only two raises; timing, not
placement, matters.

## Tests

`tests/glass.test.mjs` (deterministic): rules and scoring per game; staging tables; generator fairness
(every Prisms set solvable around its shard over all rotations; reef waves always leave a reachable lane);
host-runner players with ≥ 1 s between inputs (Prisms: ≥ 25 sets in 240 s without cracks; Abyss: three
seeds survive 200 s catching ≥ 45 motes; Orbit: three seeds survive 200 s collecting ≥ 12 beacons); idle
runs lose (Prisms Time up, Abyss/Orbit Game over); reduced-motion state equality; pause/resume; bounded
arrays; render in both layouts; catalog flags, profiles, precision, versioned scores and challenge links.
`tests/browser/glass.spec.mjs`: cards, native profiles (two raises / six directions), local pulse feedback,
HUD labels, pause, phone/landscape fit and 44 px targets, unattended Game over/Time up with v2 links,
fonts and the gold fix in both appearances. These are synthetic cadence checks, not webcam comfort proof.

## Appearance

The site's glass theme is a dark acrylic in both appearance modes (its body variables override the light
root values), so the canvas and room keep the profile's dark chart in both; `display.mode()` would switch
to the light chart only if the room background became light. Light mode used to inherit the light gold
(#84612c) on the dark HUD; `glass.css` pins the dark chart on `#arcade-player`. Open Sans (bundled, OFL)
stands in for Segoe UI Variable.
