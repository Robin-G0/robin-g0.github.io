# Motion arcade

These games consume **logical pulses** from the `motion-input-grid` npm package.
They never infer a gesture themselves. Most games map left/right wrist raises to
two actions. Pop-up Panic uses six commands: each anatomical wrist controls its
own stack with screen-left, up and screen-right. The preview mirrors once.
Return the acting wrist to chest height between commands; a lit dot confirms
native neutral detection. Holding or moving between targets never repeats.

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
- `core/runner.js`: simulation time, tutorial, pause, restart and round duration.
- `lessons.js`: short control explanations and optional game tips for every engine.
- `core/input.js`: keyboard, touch and accepted motion events share the same route.
- `room.js`: the dialog, camera preview, controls and single animation loop.
- `mig/profile.js`: native schema-v2 trigger regions, dwell and neutral confirmations.
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

The profile uses disjoint body-relative trigger regions with deadbands, native
Single Press and occupancy dwell: 60 ms at a direction, 120 ms at neutral.
Shoulders plus the acting wrist suffice; the other wrist and legs may be absent.
The native recognizer emits six direction events and two internal neutral events.
GestureGate sequences those events per wrist: neutral arms one direction; loss or
ambiguity disarms it. It does not classify positions, invent releases or queue moves.
Actual packaged WASM tests cover all six bindings, held targets, direct transitions,
neutral return, observation loss and 33/100/160 ms frame intervals.

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
A sustained tracking loss freezes the simulation and round clock without opening
a pause menu. A returning wrist resumes immediately with no catch-up burst.
Keyboard/touch input takes over without a camera gate. Slow frames are bounded,
not turned into pause dialogs. Manual Pause and Controls remain explicit choices.
The controls window starts directly:
press Start, or lower and raise either wrist for a visible three-second
countdown. There are no practice or readiness gates. Controls pauses an existing
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

A shuffled three-of-each-direction bag and visible upcoming arrows make planning
possible. Clears speed up paired arrivals gradually. Clearing gaps makes remaining
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

## Add or import a game

To add trusted executable code, write a factory in `games/`, register it in
`registry.js`, and add its description to `catalog.js` and its rules to `lessons.js`. There is no dynamic module
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

## Verification

`npm test` runs deterministic engine, input, import and real-WASM tests.
`npm run test:browser` covers the page, touch-sized layouts, keyboard controls,
pause/restart/exit, imports and simulated camera failure. Set `MIG_BROWSER` to an
existing Chromium/Edge executable, or install Playwright Chromium.

Synthetic observations do not establish webcam accuracy, comfort, or smartphone
performance. Those require a real player, camera, lighting and device. Do not
describe the automated tests as physical-camera validation.
