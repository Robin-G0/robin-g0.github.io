# Two-input arcade

These games consume **logical pulses** from the `motion-input-grid` npm package.
They never infer a gesture themselves. A left or right wrist raise produces one
command. Lower the wrist below the green start band before raising it again;
holding it at the finish does not produce more commands.

## Run the site

With Node.js 22.12 or newer, from the repository root:

```sh
npm ci
npm run prepare:assets
npm run dev
```

`prepare:assets` copies the installed package's browser runtime and licenses to
`vendor/motion-input-grid`. The import map exposes its original entry point as
`motion-input-grid`. Nothing is compiled or downloaded when the ordinary site opens.
Camera models are loaded only after the player explicitly starts the camera.

## Files to start with

- `catalog.js`: the three games associated with each visual era, their goals and controls.
- `games/`: trusted game logic, grouped by theme.
- `core/game.js`: the small lifecycle used by every game.
- `core/input.js`: keyboard, touch and accepted motion events share the same route.
- `mig/profile.js`: a readable schema-v2 profile derived from MIG's wrist-raise example.
- `mig/camera.js`: `MIGSession`, frame health, status, recalibration and disposal.
- `core/import-game.js`: strict validation of declarative game files.

## Game contract

A trusted factory receives an environment with a seeded `random()` function,
`pace`, `message(text)` and `finish(text)`. It returns:

```js
{
    state: { score: 0, lives: 3, time: 0 },
    start(),
    input({ action, source, timestamp }), // action is "left" or "right"
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

The profile uses body-relative wrist regions, no finger-sign requirement, ordered
Required → Trigger regions, a Low tolerance, Single Press and a 700 ms cooldown.
The published package requires a visible return **below** the start band to rearm;
staying in the start band is insufficient. Synthetic tests exercise the actual
packaged WASM, including gaps of 33–180 ms, loss of observations and cooldown.

MIG owns recognition and physical rearming. The host ignores stale deliveries,
duplicate callbacks, and commands outside active play. It never replays paused
inputs. It does not turn coordinates into a second recognizer. Rhythm games use
explicit generous scoring windows; other games respond immediately. The render
loop bounds simulation steps after a slow frame instead of accumulating a burst.

The minimal camera view marks wrists using public `coordinate()` observations.
It does not draw fingers when finger tracking is disabled. A sustained tracking
loss pauses the round; recovery never silently resumes it.

## Add or import a game

To add trusted executable code, write a factory in `games/`, register it in
`registry.js`, and add its description to `catalog.js`. There is no dynamic module
path in imported data.

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
