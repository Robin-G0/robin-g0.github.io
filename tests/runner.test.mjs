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
    assert.equal(runner.phase, 'paused', 'A stalled frame does not teleport the game');
    runner.restart();
    assert.equal(runner.game.state.hits, 0);
    runner.finish(); runner.tutorial();
    assert.equal(runner.phase, 'tutorial');
    assert.equal(runner.started, false, 'Help after a completed round prepares a fresh round');
    runner.dispose(); runner.router.dispatch('left');
    assert.equal(runner.phase, 'closed');
});

test('camera uses public package callbacks and rejects ambiguous same-frame directions', async () => {
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
    options.onAction({ action: 'left' }); options.onFrame(frame);
    assert.deepEqual(actions, ['left']);
    options.onAction({ action: 'left' }); options.onAction({ action: 'right' }); options.onFrame(frame);
    assert.deepEqual(actions, ['left']);
    assert.equal(statuses.at(-1), 'Lift one wrist at a time.');
    options.onAction({ action: 'right' }); options.onFrame({ coordinate: () => null });
    assert.deepEqual(actions, ['left']);
    assert.equal(frames.at(-1).visible, false);
    camera.stop();
    options.onAction({ action: 'right' }); options.onFrame(frame);
    assert.deepEqual(actions, ['left']);
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
