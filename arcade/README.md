# Motion arcade

These games consume **logical pulses** from the `motion-input-grid` npm package.
They never infer a gesture themselves. Most games map left/right wrist raises to
two actions. Pop-up Panic uses six commands: each anatomical wrist controls its
own stack with screen-left, up and screen-right. The preview mirrors once.
Move into a direction box and settle briefly. Direct changes work without a home
return; repeating one direction only needs an exit and re-entry. Held poses do not
repeat. Lights acknowledge accepted moves rather than latching readiness.

## Run the site

With Node.js 22.12 or newer, from the repository root:

```sh
npm ci
npm run prepare:assets
npm run dev
```

`prepare:assets` copies the installed package's browser runtime and licenses to
`vendor/motion-input-grid`. The import map exposes its original entry point as
`motion-input-grid`. Opening a game starts its camera setup and downloads camera
models and recognition WASM; ordinary profile browsing does neither. The browser
still asks for camera permission. Keyboard / touch only cancels the camera session.
The static site needs no server build.

## Files to start with

- `catalog.js`: the three games associated with each visual era, their goals and controls.
- `games/`: trusted game logic, grouped by theme.
- `games/popup-panic.js`: directional batch clears, pressure, preview bags and animated settling.
- `core/audio.js`: original synthesized cues and a mute control, with no audio downloads.
- `core/game.js`: the small lifecycle used by every game.
- `core/runner.js`: simulation time, tutorial, manual pause, restart and end conditions.
- `core/game-config.js`: shared built-in profile, cooldown and HUD-label selection
  (`livesLabel`: Lives for survival games, Attempts for round puzzles, hidden for
  one-life or lifeless engines such as Tile Drop, Pop-up Panic and Link Maze).
- `core/results.js`: shared scores, name entry, challenge comparison and share UI.
- `core/challenges.js`: validated friend links and a separate browser-session target.
- `core/pressure.js`: explicit survival/round policies for all 33 engines.
- `themes.css`: arcade typography, era-specific materials and responsive presentation.
- `lessons.js`: short control explanations and optional game tips for every engine.
- `core/input.js`: keyboard, touch and accepted motion events share the same route.
- `room.js`: the dialog, camera preview, controls and single animation loop.
- `mig/profile.js`: native schema-v2 occupancy and trigger regions with continuous dwell.
- `mig/camera.js`: `MIGSession`, frame health, status, recalibration and disposal.
- `mig/bindings.js`: native configuration validation, local assignments and logical command routing.

## Game contract

A trusted factory receives an environment with a seeded `random()` function,
`pace`, `message(text)` and `finish(text)`. It returns:

```js
{
    state: { score: 0, lives: 3, time: 0 },
    start(),
    input({ action, source, timestamp }), // action comes from catalog.controls; six commands also include wrist/direction
    update(seconds),                    // simulation time, never wall-clock timers
    render(painter),
    pause(),
    resume(),
    dispose()
}
```

Use `game(state, handlers)` to implement this contract without boilerplate. Keep
rules in `input` / `update` and drawing in `render`. A game must not open another
camera, start its own animation loop, attach global listeners or change the page.
The host owns those resources and destroys the game on exit or theme change.

## Recognition and timing

The profile uses close, broad body-relative direction boxes with a small gap,
native Single Press and 120 ms continuous occupancy. Terminal regions extend
outward to the schema limits so travelling farther does not create a far-edge miss. Each simultaneous step
has Required and Trigger constraints in the same rectangle. Since npm 1.1.0
(unchanged since), a trigger-only step does not reset its hold timer on brief exits; the Required
constraint is what makes dwell continuous. No finger inference is required.
Shoulders and the acting wrist suffice; the other wrist and legs may be absent.
GestureGate deduplicates native deliveries and drops ambiguous same-wrist
batches. Pop-up Panic also selects a 200 ms cooldown for each wrist/direction pair.
Changing direction never waits for another direction's cooldown, and one wrist
never blocks the other. Rejected events are discarded rather
than replayed, and tracking flicker does not reset the cooldown. Other games keep
the default zero extra cooldown. There is no neutral readiness latch or mandatory home return.
After observation loss, a reacquired wrist can produce one new settled pulse;
continuous visible occupancy never streams repeated presses.
Packaged-WASM tests cover close reaches for both wrists, 0.75/1.33/1.78 camera
aspects, narrow/wide shoulder crops, short boundary jitter, holds and loss.

The camera shows the six profile rectangles projected into the mirrored preview.
TriggerView matches the shoulder-relative metric and 35 ms grid filter as a live
alignment guide. Since 1.3.0 MIGSession also exposes the engine's smoothed grid
(`session.grid(space)` with `gridPoint`); moving TriggerView onto it is a follow-up.
Box activation comes from the SDK tracker's native active state, not hit testing
in the page. The guide and native profile share their region definitions.
MarkerMotion eases marker positions over display frames with an 85 ms time
constant and a small deadband. Stable badge dimensions prevent label-size wobble.
These visual filters never change points or timestamps sent into recognition.

MIG owns recognition and dwell. The host ignores stale deliveries,
duplicate callbacks, and commands outside active play. It never replays paused
inputs. It does not turn coordinates into a second recognizer. Rhythm games use
explicit generous scoring windows; other games respond immediately. The render
loop bounds simulation steps after a slow frame instead of accumulating a burst.
Callback timestamps measure delivery to the application, not camera capture time;
the host cannot recover inference latency that the package does not report.

The playfield comes first; the camera sits below it. A short controls window opens
over the playfield before a round and can be reopened with the Controls button.
The dialog keeps
a fixed viewport height, feedback reserves space, and gesture-driven focus does
not scroll the page. The camera mirrors the video and wrist markers
together, and reports shoulders and each wrist separately using confident public
`coordinate()` observations inside the image. It does not invent finger tracking.
Missing hands never pause any arcade game. Simulation, clocks and difficulty
continue; missing-input feedback remains beside the camera without covering play.
Keyboard/touch input takes over without a camera gate. Slow frames are bounded,
not turned into pause dialogs. Manual Pause and Controls remain explicit choices.
The initial screen shows Loading until a tracker frame, then a themed animated hand prompt.
Showing either wrist starts a three-second countdown, without an Up gesture.
Start and keyboard/touch remain direct fallbacks; the initial countdown stays latched
when hands disappear. Presence starts only the initial screen, never auto-closes Controls
or resumes manual Pause. There are no practice or readiness gates. Controls pauses an existing
round without resetting its score or position; Start becomes Resume. A wrist raise
can also resume a paused round. The confirmation pulse never enters the game. Loss of
tracking cancels a resume countdown, but never the initial starting countdown. `core/motion-navigation.js` keeps that small flow
separate from the game input router and never recognises a gesture itself.

## Pop-up Panic loop

Both stacks receive windows. Each window has a direction independent of its stack.
Each wrist clears matching up, left or right arrows in its own stack; empty gestures cost nothing
and do not break a chain. Bigger batches earn `10 × count² × chain multiplier × level`.
Consecutive successful clears within 4.5 simulation seconds increase the multiplier,
and an empty board earns another `100 × level`. Waiting builds valuable groups but
risks the visible stack ceiling. Overflow allows 1.2 seconds to recover.
This engine declares `endless: true`: the host shows elapsed survival time and
does not apply the catalog's round duration. Only unresolved stack overflow ends
play. The other arcade engines use the progression policies below; Link Maze
keeps its replenishing clock and repeating maps.

A shuffled three-of-each-direction bag and visible upcoming arrows make planning
possible. Paired arrivals accelerate with simulation time from 1.5 seconds to
0.65 seconds over the first minute, then keep shrinking through a smooth survival
ramp, before the difficulty pace multiplier. The all-clear recovery delay scales
down with the current interval instead of imposing a fixed spawn-rate ceiling.
Manual Pause freezes that ramp; slow frames do not queue spawn bursts.
Different directions from both wrists can clear in the same camera observation,
with independent result plates and tap effects. Clearing gaps makes remaining
windows settle; large sweeps get a burst and a short rising chiptune. Reduced-motion
rendering keeps the rules and random sequence unchanged. A deterministic test
sustains a round with one input every 1.7 seconds; this is not a comfort or webcam
accuracy test. The mobile board uses more logical vertical space so arrows do not
shrink into a landscape letterbox.

The loop is an adaptation of [Tetris's scoring and rising pressure](https://play.tetris.com/games/),
not a claim of proven retention. [Xbox input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107)
informed the low repetition requirement. [Xbox text guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101)
informed the large, sparse labels. [Game-feel research](https://arxiv.org/abs/2011.09201)
informed feedback at the affected object. Synthesized sound follows
[Web Audio's user-gesture and mute guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

Each engine supplies a small `feedback(state, event)` hook returning a logical
`{ x, y }` position on the affected game object. The shared lifecycle records the
action and score change, and the painter displays a short callout at that target.
Keep the hook visual: it must not change game rules. Rule messages also appear
inside the playfield, including reasons why a recognised input cannot act yet.
Pop-up clears use local arrow/count plates, settling windows and short bursts.

## Link Maze memory loop

The host seeds game randomness from the visitor's local `Date.now()` when a room
opens; explicit imported seeds remain reproducible. Each new maze consumes that
local random stream. Forward-only branches can rejoin shared pages, with at most
six pages per row. This bounds rendering and keeps deeper maps readable on phones.
Every branch terminates; shortcuts and longer routes have different costs.
Maps grow to 8, 10 and 12 rows, then retain the third level's size bounds.
Each half of the map gets approximately 25% bonus pages, 30% penalty pages and
45% ordinary pages. Positions and effect types are shuffled independently of
creation order. The protected route cannot receive penalties, but is no longer
filled with bonuses; the renderer never styles or prints that route specially.

The full map grows upward from START at the bottom to END at the top. Screen-left
and screen-right keep their horizontal meaning in both preview and navigation.
The map appears for 9/11/13 seconds, without a written or highlighted solution. Memorisation
and the short arrival celebration do not spend the time bank. The hidden map
then accepts left/right wrist raises, keyboard or touch. L/R labels identify the
wrist to raise rather than suggesting sideways hand motion. Link backgrounds
highlight in the colour of the effect, without a circle over their text.

Six original pixel-art effects have looping GIF companions in assets/art and PNG
frame strips used by the canvas. The renderer selects frames using simulation
time and freezes the first frame for reduced motion. Regenerate them with
Python and Pillow: scripts/create-link-maze-art.py.

A run starts with 45 seconds. Home adds 8 seconds and points, then generates a
new map. Pages can add 40 points or 5 seconds, reveal destinations for two
choices, subtract 25 points or 5 seconds, or swap the next two destinations.
Those are first-round penalties. Each later round adds 25 points to the tax,
2 seconds to the time penalty (capped at 20), and another swapped choice every
two rounds (capped at six). Preview and PEEK labels use the same round values.
From round 4, both halves can contain clearly marked DIE pages that end the run
immediately; their red pixel-skull cue is drawn locally. A fully penalty-free
path remains available in every map, including later rounds.
A peek displays the destinations actually selected by the current swap state.
The bank caps at 90 seconds and score floors at zero; time exhaustion ends play.

A trusted engine may expose `remainingSeconds()` to own a replenishable clock.
The runner displays that value and lets the engine end the round; engines without
it use an explicit arcade progression policy. A host without an arcade engine
policy can still use a fixed duration. All clocks and previews freeze on manual
Pause or Controls, and continue when hands disappear. Tests exercise real game rules separately from browser
SDK-event fixtures; the latter do not establish physical recognition accuracy.

## Arcade progression and visual identity

`PRESSURE_RULES` maps each engine to a survival loop, repeating score goals, or its
own progression. Survival games receive a smoothly increasing `env.pace`, cached
once per simulation step. Puzzle score windows shorten over time, renew on score
rather than button presses, and cost a life on expiry. Sequence playback and a
solved puzzle's brief celebration retain their viewing time. A loss, not the
catalog's old 60-second duration, ends an arcade run. Link Maze keeps capped map
dimensions while later rounds offer less memorisation time.

These policies never change camera inference rates, native gesture dwell or
command cooldowns. Manual pause freezes both simulation and progression. Trusted
arcade engines select their own survival/round policy.

The eleven era screens use distinct materials, buttons and font families. Four
small local WOFF2 fonts include licenses and source records in `assets/fonts`;
no font-service requests occur at runtime. Canvas previews and games wait for
their own typography before a final repaint, retaining a readable fallback.
Intro motion respects reduced motion and stops being rendered during play.

## Add a game

To add trusted executable code, write a factory in `games/`, register it in
`registry.js`, and add its description to `catalog.js`, its pressure policy to
`core/pressure.js` and its rules to `lessons.js`. There is no dynamic module
path in imported data.

For a small first experiment, copy a factory such as `binary` in `games/matrix.js`.
It has no physics or timing requirement: one pulse rotates the register, the other
flips a bit. Register the copied factory explicitly, then add its goal and the two
action labels to the catalog. `mig/camera.js` already handles the package session;
the new game only needs `event.action` and should never inspect camera landmarks.

## Import and assign motion bindings

Use Import bindings to open a schema-v2 JSON export from Motion Input Grid.
The deployed native engine validates it without starting a camera or models.
Open any game, choose Bindings, and assign an imported input to each logical
control. Blank selections retain the game's default. Apply updates the session
and guides; Game defaults restores the original controls on Apply. The profile
and per-engine selections are saved in this browser, with a memory-only fallback.
Replacing a configuration clears old assignments. Reset all bindings clears both.

`mig/bindings.js` copies only the selected rules into a runtime profile with stable
logical IDs. Original input names/actions need not match game controls. A source
binding can drive multiple controls. Recognition remains native; the host only
routes/deduplicates pulses and preserves independent cooldowns. Keyboard/touch,
game rules, scoring and difficulty stay game-owned. Importing games is no longer
supported. Body-space regions have a camera guide; calibrated and mirrored
inputs still work natively but are labelled as having no body preview.

The tutorial's controls card and downloadable profile reflect custom assignments.
The other two cards still explain the actual game loop and rewards/hazards.

## Friend challenges

Every engine finishes through the shared results component. Challenge a friend
copies a link carrying the game's best local score, that record's name and the
difficulty. If clipboard access fails, a selectable link appears. A recipient
sees an invitation, explicitly starts the game, and gets a higher/tied/lower
comparison on finish. Their target stays separate from personal records and
persists for retries in the tab's session. Dismiss removes it and the URL payload.

These are friendly, editable score claims. Links do not promise identical random
boards, verified rankings, or automatic replies. All behavior is static browser
JavaScript; there is no backend or peer library. New engines inherit the UI by
using the existing runner/finish contract instead of implementing separate results.

## Runtime efficiency

The camera uses up to 20 inference frames/second during active play and 10 in
menus, pauses and Link Maze memorisation. Capture requests 640 by 480, while wrist
markers and the game have their own display budget of about 60 Hz. The hidden SDK
debug canvas is disabled and pose-only sessions do not initialise a hand model.
Paused/tutorial boards retain their paint; the maze tree is cached independently
from its animated icons. Covered theme animations and GIF backgrounds suspend
while the room is open and restore on close.

The site depends on the motion-input-grid 1.3.0 release (the npm archive attached to the
GitHub release until the npm publication), which ships
these session options natively. `prepare:assets` copies the installed package's
runtime unchanged into vendor/motion-input-grid; no upstream source override or
private recognizer is involved.

Tests count render/inference work and exercise gesture/navigation behaviour.
These budgets do not establish a temperature or battery saving on every device.

## Verification

`npm test` runs deterministic engine, input, import and real-WASM tests.
`npm run test:browser` covers the page, touch-sized layouts, keyboard controls,
pause/restart/exit, imports and simulated camera failure. Set `MIG_BROWSER` to an
existing Chromium/Edge executable, or install Playwright Chromium.

Synthetic observations do not establish webcam accuracy, comfort, or smartphone
performance. Those require a real player, camera, lighting and device. Do not
describe the automated tests as physical-camera validation.


## Phosphor engines

`games/phosphor/` separates Invaders, Lander and Snake rules from their CRT display
helpers and three-card SVG tutorials. All three use the two-input wrist-Up profile. Lander maps raises to left/right
engines: each slows descent and steps sideways; both together brake centrally.
A short simulation-time chord window tolerates slightly staggered detection.
Portrait rendering and game-owned outcome feedback are explicit host settings.
Invaders uses scoreVersion 3, Lander v4, and Snake v2. Prior records stay stored separately, and
old challenge links are rejected with a compatibility message. Keep versioned
boards and links aligned when changing scoring in another engine.


## Windows 95 engines

`games/desktop95.js` keeps Folder Sort, Window Stack and Ski Run on the shared host.
`desktop95-art.js` draws responsive original desktop materials, while
`desktop95-tutorials.js` supplies specific three-card teaching. The engines use two
native wrist-Up bindings, their own object feedback and outcome cues, and score
rules v2. Window Stack's marked snap band matches the actual acceptance rule even
for narrow windows. Portrait projection keeps logical rules and timing unchanged.

## Metro engines

`games/metro.js` re-exports three modules in `games/metro/`. `display.js` draws flat
colour tiles, white glyphs, square lives and light Segoe-style text; where Segoe UI
Light is absent the bundled Open Sans 300 (OFL, by Segoe's designer) stands in, so
phones keep the identity. `tutorials.js` holds the three cards per engine. All three
use the pose-only wrist-up profile, engine-owned feedback and sound, portrait boards
and score rules v2; older boards and friend links stay separate.

- Live Tiles (`memory`): a blue/purple sequence that starts at two tiles. Watching is
  free time. A tile whose flash has started can be answered live for 20; repeating
  after the show pays 10. Finishing adds 10 per tile, doubled when every tile was
  live. Unrevealed inputs are harmless. A wrong tile costs a heart and replays the
  same order; cadence shrinks from 1.1 s to .55 s with rounds. 24 s score rounds.
  The slot row under the tiles is the sequence: it fills with lettered tiles as
  they flash, empties for the repeat and marks the current slot, so the number
  of moves and the moment the order grows are explicit.
- Tile Drop (`merge`, score rules v4): survival on a 5 by 6 board of bottom-up
  columns. L/R move the waiting tile one column; both raises within .12 s drop it
  now; otherwise it drops when its bar runs out, max(1.8, 4.2/pace) seconds. It
  joins every equal tile it touches (below, left, right) and doubles once per
  tile: two make x2, three x4, four x8, announced as TRIPLE / QUAD; then the
  whole board keeps merging while equal tiles touch, including tiles that just
  fell, lowest and leftmost first. A merge scores 10 per power of two of the tile
  it makes (4 is 20, 8 is 30, 1k is 100) times its chain step, so the score tracks
  the exponent and stays a safe integer however far the run goes (v3 scored raw
  values, which overflowed `Number.isSafeInteger` after a few hundred drops and
  could not be saved). Retirements settle the board at once as further chain
  steps, so no pair is left touching for the next landing to "earn". `landTile`
  returns the story as frames (`land`, `merge`, `retire`), each with the board it
  leaves; the engine replays them (`s.replay`) so the canvas shows the landing,
  then one merge per .14 s with a flat pop, a square ripple, a named burst
  (`+20`, `CHAIN ×2 +60`, `TRIPLE ×4 +30`) and a rising cue, and a .45 s
  clear-out in which retired tiles shrink flat into their colour outline before
  the columns settle; a chain's total replaces the header detail for 1.6 s.
  The replay never touches rules or RNG. Spawns are the floor and the next 2 to 4 powers of two (variety grows
  with retirements). When the best tile reaches 128 times the floor, tiles below
  the doubled floor clear, so the board never saturates. One life: a full column
  ends the run. Each real move refunds .2 s to the deadline, at most four times
  per tile, so crossing the board is always affordable but stalling is not.
  Simulation: random columns lose after about 75 drops, a greedy player after
  1,400 to 3,000, so skill decides and time pressure is the ceiling. Values show
  as 2k, 1M and so on.
- Metro Line (`rail`, score rules v3): survival on a growing tree. Trains leave by
  themselves from a departures board every max(1.4, 3/pace) seconds and travel
  max(2.4, 4.4/pace) seconds; several are on the track at once. L toggles junction
  1 (read at 40% of the trip); R toggles junction 2 on the branch junction 1 is
  open to (read at 70%). Stations A and B exist from the start; C opens behind a
  second junction at 40 s and D behind a third at 90 s (hard-coded stages); slots
  never move. Arrivals pay 20, a same-station arrival within 1.6 s adds a 10
  convoy bonus, a wrong station costs a heart. R is harmless while the open branch
  has no second junction.

Deterministic tests cover live/repeat scoring, the show-phase clock, drop merges,
chords, retirements, overflow, the policy comparison, junction timing, convoys,
overflow, idle loss and reduced-motion equivalence. These are simulated cadence
checks, not evidence of physical comfort or webcam accuracy.

## Matrix, Y2K, Aqua, Aero, Material, Glass and Field Notes engines

Each of these eras keeps its engines in `games/<theme>/` (`display.js`, one module
per game, `tutorials.js` for the three cards, captions and Controls lessons) and
re-exports them from `games/<theme>.js`. Their rules, constants, stage timings,
precision reasoning and phone notes live next to the code:

| Era | Games | Notes |
|---|---|---|
| Matrix | Construct Parry (six commands), Binary Lock, Gravity Switch | [games/matrix/NOTES.md](games/matrix/NOTES.md) |
| Y2K | Orbital Breaker, Chrome Beat (six commands), Reactor Balance | [games/y2k/NOTES.md](games/y2k/NOTES.md) |
| Aqua | Marble Gates, Gel Factory, Dock Bounce (six commands) | [games/aqua/NOTES.md](games/aqua/NOTES.md) |
| Aero | School Rescue (six commands), Bubble Cascade, Living Garden | [games/aero/NOTES.md](games/aero/NOTES.md) |
| Material | Paper Tangram (six commands), Ripple Golf, Paper Balance | [games/material/NOTES.md](games/material/NOTES.md) |
| Glass | Prisms, Abyss Drift (six commands), Orbital Assist | [games/glass/NOTES.md](games/glass/NOTES.md) |
| Field Notes | Clockwork, Contour Survey, Constellations (six commands) | [games/field-notes/NOTES.md](games/field-notes/NOTES.md) |

All of them use score rules v2, engine-owned feedback and sound, seeded rule
randomness and staged depth (new mechanics arrive by time or progress rather than
by speed alone). Six-command games set `inputScheme:'wrist-directions'` and
recommend Full precision; two-raise games recommend Low.

## Tracking precision

`mig/precision.js` defines the presets the welcome dialog offers: Low (Lite on the
processor), Medium (Full), Medium fast (Full on the graphics card), Full (Heavy)
and Full fast (Heavy on the graphics card); phones get Low, Medium and Full. Each
catalog line declares `precision` (`low`, `medium` or `full`); the room shows when
the current preset is below it and offers Change. `mig/pose-models.js` downloads
Full and Heavy once from Google's model storage, checks size and SHA-256, keeps
them in Cache Storage and falls back from GPU to CPU when WebGL inference fails.

## Phone player

`phone.css` (loaded after every theme) turns the player into a full-screen app on
screens up to 640 px wide and on landscape phones: header, scores, the board in
all remaining height, a one-line camera strip, the toolbar and the touch controls
in the thumb zone. Nothing scrolls. Camera opens the setup sheet over the board;
tutorials, results and bindings take the whole play area. In landscape the left
and right controls sit on either side of the board. Theme room stylesheets only
skin these elements; layout stays in `phone.css`. `tests/browser/phone.spec.mjs`
and `mobile-games.spec.mjs` hold the contract.
