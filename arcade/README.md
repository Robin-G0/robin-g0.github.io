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
- `core/pressure.js`: explicit survival/round policies for all 33 engines.
- `themes.css`: arcade typography, era-specific materials and responsive presentation.
- `lessons.js`: short control explanations and optional game tips for every engine.
- `core/input.js`: keyboard, touch and accepted motion events share the same route.
- `room.js`: the dialog, camera preview, controls and single animation loop.
- `mig/profile.js`: native schema-v2 occupancy and trigger regions with continuous dwell.
- `mig/camera.js`: `MIGSession`, frame health, status, recalibration and disposal.
- `core/import-game.js`: strict validation of declarative game files.

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
has Required and Trigger constraints in the same rectangle. In npm 1.1.0,
a trigger-only step does not reset its hold timer on brief exits; the Required
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
The published session does not expose its calibrated grid, so TriggerView matches
the shoulder-relative metric and 35 ms grid filter as a live alignment guide.
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
The initial screen shows one large "Say hi (with hand) to start" prompt.
Showing either wrist starts a three-second countdown, without an Up gesture.
Start and keyboard/touch remain direct fallbacks; disappearing hands cancel the
countdown. Presence starts only the initial screen, never auto-closes Controls
or resumes manual Pause. There are no practice or readiness gates. Controls pauses an existing
round without resetting its score or position; Start becomes Resume. A wrist raise
can also resume a paused round. The confirmation pulse never enters the game. Loss of
tracking cancels the countdown. `core/motion-navigation.js` keeps that small flow
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
command cooldowns. Manual pause freezes both simulation and progression. Imported
duration metadata remains supported for compatibility, but trusted arcade engines
select their own survival/round policy.

The eleven era screens use distinct materials, buttons and font families. Four
small local WOFF2 fonts include licenses and source records in `assets/fonts`;
no font-service requests occur at runtime. Canvas previews and games wait for
their own typography before a final repaint, retaining a readable fallback.
Intro motion respects reduced motion and stops being rendered during play.

## Add or import a game

To add trusted executable code, write a factory in `games/`, register it in
`registry.js`, and add its description to `catalog.js`, its pressure policy to
`core/pressure.js` and its rules to `lessons.js`. There is no dynamic module
path in imported data.

For a small first experiment, copy a factory such as `binary` in `games/matrix.js`.
It has no physics or timing requirement: one pulse rotates the register, the other
flips a bit. Register the copied factory explicitly, then add its goal and the two
action labels to the catalog. `mig/camera.js` already handles the package session;
the new game only needs `event.action` and should never inspect camera landmarks.

Visitors import JSON descriptions targeting an installed engine. Only the listed
schema fields are accepted: id, engine, title, goal, duration, seed and difficulty,
plus `schema_version: 1`. Files are limited to 32 KB, durations to 30–90 seconds,
and text to short single lines. URLs, HTML execution, scripts and unknown fields
are not accepted. Imported games inherit the current theme and engine controls.

## Runtime efficiency

The camera uses up to 20 inference frames/second during active play and 10 in
menus, pauses and Link Maze memorisation. Capture requests 640 by 480, while wrist
markers and the game have their own display budget of about 60 Hz. The hidden SDK
debug canvas is disabled and pose-only sessions do not initialise a hand model.
Paused/tutorial boards retain their paint; the maze tree is cached independently
from its animated icons. Covered theme animations and GIF backgrounds suspend
while the room is open and restore on close.

The npm dependency still supplies 1.1.0's WASM/models. Pending the next registry
release, asset preparation uses the exact upstream JavaScript source revision in
mig/runtime-source.json, verifies SHA-256 hashes and records that provenance in
vendor/motion-input-grid/package.json. Re-running prepare:assets can reuse those
verified files offline. No private recognizer is introduced.

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
