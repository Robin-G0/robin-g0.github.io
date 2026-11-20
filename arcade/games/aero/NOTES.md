# Frutiger Aero games (reworked 2026-11-20)

`games/aero.js` re-exports three engines from `games/aero/`: `school.js`, `bubbles.js`,
`garden.js`. `display.js` holds the canvas materials (glass panels with a specular band,
glossy gel orbs, clear bubbles, Vista aurora ribbons, aquarium water with light shafts and
caustics, a sky meadow with lens light, fish, jellyfish, ring timers, bounded bursts/effects).
`tutorials.js` exports `diagrams`, `captions` and `lessons` keyed by engine. All three are
`illustrated:true` (engine-owned feedback and sound, portrait board), survival progression in
`core/pressure.js`, three lives, `Game over` through `display.loseLife`, score rules v2.
Decoration reads simulation time only and never touches `env.random`; reduced motion freezes
decoration (time 0 for shafts, bubbles, sway) and keeps rules, timing and randomness identical.
The canvas follows the site appearance: `isDark(p)` reads `data-mode` (or a dark `--bg`) and
swaps daylight water/sky for a night aquarium/meadow with a green-cyan aurora.

## School Rescue (`school`, six commands, precision `full`)

Three lanes; rows drift down to the school line. `inputScheme:'wrist-directions'`: either
wrist's sweep left/right moves the school one lane (edge bumps harmless); either wrist's raise
spends a pearl on a 1.6 s bubble shield (harmless without a pearl). Rows: strays (+1 fish,
+5 each), jellyfish, and every 5th row a glass reef gate with one green gap. Through the gap:
`10 x fish` points and a pearl (max 3). A sting or coral costs a life and half the followers
(`afterHit`, leader stays), 1.2 s recovery; a shield absorbs one hit instead. Each row's safe
lane is within one lane of the last and of any off-path stray (`makeRow`), so one sweep per
row always suffices. Travel `max(2.6, 4.4/pace)` s, rows every `max(1.7, 2.8/pace)` s; first
two rows are calm. Stages: 50 s twin-jellyfish rows, 75 s golden strays (+3 fish), 100 s
crowded reef (two jellyfish per row, a gate every 4th row). School capped at 15.
Precision `full`: sideways sweeps use the six-box popup profile and benefit from the heavier model.

## Bubble Cascade (`bubbles`, two raises, precision `low`)

Three touching columns hang under the surface, 8 rows each. A bubble rises in the centre pipe
for `max(1.6, 3.6/pace)` s: raise L sends it up the left column, raise R the right, doing
nothing floats it up the centre (idle play overflows the centre). Groups of 3+ touching
same-colour bubbles pop (up/down and sideways) for `10 x size^2 x cascade step`; columns float
up and new groups pop as the next step (`landBubble` returns replay frames, shown .36 s
apart). A cascade (2+ steps) earns one rainbow bubble that takes the colour above it (else
beside it). A column longer than 8 vents and costs a life. Stages: 3 colours, 45 s grey
pebbles every 8th bubble (they crack beside a pop), 90 s 4th colour, 120 s pebbles every 6th,
150 s 5th colour. Colours carry glyphs (drop, leaf, star, flower, diamond); pebbles are matte.
Was 18 s score rounds (v1); now survival. Precision `low`: only two raises.

## Living Garden (`garden`, two raises, precision `low`)

Beds ask for rain (drop) or sun with a ring timer `max(4, 9/pace)` s; a need appears every
`max(1.4, 3.2/pace)` s on a free bed from a shuffled 2+2 bag. Raise L rains on the whole
garden, raise R shines: every plant asking for it is served, a batch of n scores `10 x n^2`,
and every opposite plain need loses 35 % of its remaining time. The cloud and sun show how
many plants wait for them. Three served needs bloom a plant (+50, butterfly). A timer running
out wilts the plant: one life. Stages: 4 beds, 40 s 5th bed, 65 s rainbow plants every 5th
need (need both weathers, 1.4x time), 90 s 6th bed. Precision `low`: only two raises.

## Tests

`tests/aero.test.mjs`: row generation invariants over 600 rows; school/bubble/garden rules and
scoring; cross-column pops, two-step cascades, pebbles, rainbow colour and overflow; weather
batches, stress, bloom, wilt and staged beds; idle runs reach Game over (school/garden < 120 s,
bubbles < 200 s at pace 1) with reduced-motion state equality and bounded arrays; simulated
players with >= 1 s between inputs (school 240 s with >= 15 homes, bubbles >= 140 s,
garden 300 s); catalog/host policy, score v2 isolation, challenge rules, pause/restart.
`tests/browser/aero.spec.mjs`: cards, native profiles (six inputs for school, two for the
others), local pulses with no generic overlay, phone/landscape fit, unattended Game over with v2
links and replay, light/dark room and night canvas. These are synthetic cadence checks, not
evidence of webcam comfort or fun.
