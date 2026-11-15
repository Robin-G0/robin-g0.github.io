import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRunner } from '../arcade/core/runner.js';
import { game } from '../arcade/core/game.js';
import { MotionCamera } from '../arcade/mig/camera.js';
import { popups, STACK_LIMIT } from '../arcade/games/popup-panic.js';
import { WRIST_COMMANDS } from '../arcade/core/commands.js';

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
    let options, disposed = 0, delivery = 1000;
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
        loadPackage: async () => ({ MIGSession: Session }), clock: () => delivery += 150 });
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

test('Pop-up Panic survives beyond the round limit and ends only on stack overflow',()=>{
    let now=1000,last;
    const runner=new GameRunner({duration:60,seed:8,difficulty:'gentle',controls:Object.fromEntries(WRIST_COMMANDS.map(a=>[a,a]))},
        popups,{clock:()=>now,changed:state=>last=state});
    runner.play();
    for(let tick=0;tick<900;tick++){
        now+=100;runner.step(now);
        if(tick%6===0)for(const wrist of ['left','right'])runner.router.dispatch(`${wrist}_${['left','up','right'][Math.floor(tick/6)%3]}`);
    }
    runner.publish();
    assert.equal(runner.phase,'playing');assert.ok(runner.elapsed>89);
    assert.equal(last.remaining,null);assert.ok(last.elapsed>=89);
    const elapsed=runner.elapsed;
    now+=2000;runner.step(now,{hold:true});assert.equal(runner.elapsed,elapsed);
    runner.pause();now+=2000;runner.step(now);assert.equal(runner.elapsed,elapsed);runner.play();
    for(let tick=0;tick<300&&runner.phase==='playing';tick++){now+=100;runner.step(now);}
    assert.equal(runner.phase,'finished');
    assert.ok([0,1].some(stack=>runner.game.state.windows.filter(w=>w.stack===stack).length>STACK_LIMIT));
    runner.restart();assert.equal(runner.elapsed,0);assert.equal(runner.phase,'playing');
    assert.equal(runner.game.state.fullAt,null);runner.dispose();
});

test('ordinary timed engines still finish at their configured duration',()=>{
    let now=0,last;
    const runner=new GameRunner({duration:1,seed:1},()=>game({}, {render(){}}),
        {clock:()=>now,changed:state=>last=state});
    runner.play();
    for(let tick=0;tick<12;tick++){now+=100;runner.step(now);}
    assert.equal(runner.phase,'finished');assert.equal(last.remaining,0);
    assert.ok(Math.abs(runner.elapsed-1)<.000001);runner.dispose();
});
