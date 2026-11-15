import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRunner } from '../arcade/core/runner.js';
import { game } from '../arcade/core/game.js';
import { MotionCamera } from '../arcade/mig/camera.js';

test('runner discards paused/tutorial inputs and bounds a slow simulation frame', () => {
    let now = 1000;
    const runner = new GameRunner({ duration: 60, seed: 1, difficulty: 'gentle' },
        () => game({ hits: 0 }, { input: state => state.hits++, render() {} }), { clock: () => now });
    runner.router.dispatch('left');
    assert.equal(runner.game.state.hits, 0);
    runner.play(); now += 150; runner.step(now);
    assert.ok(runner.elapsed <= .100001);
    runner.router.dispatch('left');
    runner.pause(); runner.router.dispatch('right');
    const pausedTime = runner.elapsed;
    now += 8000; runner.step(now);
    assert.equal(runner.elapsed, pausedTime);
    runner.play();
    assert.equal(runner.game.state.hits, 1);
    now += 1500; runner.step(now);
    assert.equal(runner.phase, 'playing', 'A slow frame must not create a blocking pause menu');
    const held = runner.elapsed;
    now += 5000; runner.step(now, { hold: true });
    assert.equal(runner.elapsed, held, 'Tracking holds freeze gameplay and the round clock');
    now += 20; runner.step(now);
    assert.ok(runner.elapsed - held < .021, 'Recovery has no catch-up burst');
    runner.restart();
    assert.equal(runner.game.state.hits, 0);
    runner.finish(); runner.tutorial();
    assert.equal(runner.phase, 'tutorial');
    assert.equal(runner.started, false, 'Help after a completed round prepares a fresh round');
    runner.dispose(); runner.router.dispatch('left');
    assert.equal(runner.phase, 'closed');
});

test('camera adapter accepts native pulses with one visible wrist, including simultaneous actions', async () => {
    let options, disposed = 0;
    class Session {
        constructor(value) { options = value; this.state = { running: false }; }
        subscribe(listener) { this.listener = listener; listener(this.state); return () => {}; }
        async importJSON(text) { assert.equal(JSON.parse(text).tracking.hands, false); }
        async start() { this.state.running = true; this.listener(this.state); }
        dispose() { disposed++; }
    }
    const actions = [], statuses = [], frames = [];
    const camera = new MotionCamera({ onInput: action => actions.push(action),
        onTracking: frame => frames.push(frame), onStatus: text => statuses.push(text),
        loadPackage: async () => ({ MIGSession: Session }), clock: () => 1000 });
    await camera.start({}, {});
    const frame = { coordinate: () => ({ x: .5, y: .5, confidence: 1 }) };
    options.onAction({ action: 'left_neutral' }); options.onFrame(frame); options.onAction({ action: 'left_up' }); options.onFrame(frame);
    assert.deepEqual(actions, ['left_up']);
    options.onAction({ action: 'left_neutral' }); options.onAction({ action: 'right_neutral' }); options.onFrame(frame);
    options.onAction({ action: 'left_up' }); options.onAction({ action: 'right_up' }); options.onFrame(frame);
    assert.deepEqual(actions, ['left_up', 'left_up', 'right_up']);
    const leftOnly = { coordinate: index => index === 16 ? null : ({ x: .5, y: .5, confidence: 1 }) };
    options.onAction({ action: 'left_neutral' }); options.onFrame(frame); options.onAction({ action: 'left_up' }); options.onFrame(leftOnly);
    options.onAction({ action: 'right_neutral' }); options.onFrame(frame); options.onAction({ action: 'right_up' }); options.onFrame(leftOnly);
    assert.deepEqual(actions, ['left_up', 'left_up', 'right_up', 'left_up']);
    assert.equal(frames.at(-1).visible, true);
    options.onAction({ action: 'right_neutral' }); options.onFrame(frame); options.onAction({ action: 'right_up' }); options.onFrame({ coordinate: () => null });
    assert.deepEqual(actions, ['left_up', 'left_up', 'right_up', 'left_up']);
    assert.equal(frames.at(-1).visible, false);
    camera.stop();
    options.onAction({ action: 'right_neutral' }); options.onFrame(frame); options.onAction({ action: 'right_up' }); options.onFrame(frame);
    assert.deepEqual(actions, ['left_up', 'left_up', 'right_up', 'left_up']);
    assert.equal(disposed, 1);
});

test('closing during package load cannot reopen the camera', async () => {
    let resolvePackage, constructed = 0;
    const camera = new MotionCamera({ onInput() {}, onTracking() {}, onStatus() {},
        loadPackage: () => new Promise(resolve => resolvePackage = resolve) });
    const start = camera.start({}, {});
    camera.stop();
    resolvePackage({ MIGSession: class { constructor() { constructed++; } } });
    await start;
    assert.equal(constructed, 0);
});
