import test from 'node:test';
import assert from 'node:assert/strict';
import { popups, batchPoints, STACK_LIMIT, spawnInterval } from '../arcade/games/popup-panic.js';
import { seededRandom } from '../arcade/core/random.js';

function create(reducedMotion = false) {
    const result = { finished: false, sounds: [], messages: [] };
    result.game = popups({ random: seededRandom(8), pace: .8, reducedMotion,
        finish: () => result.finished = true, sound: event => result.sounds.push(event),
        message: text => result.messages.push(text) });
    result.game.start(); return result;
}
function advance(run, seconds) {
    for (let frame = 0; frame < seconds * 60 && !run.finished; frame++) run.game.update(1 / 60);
}

test('batch rewards favour planned large clears over repeated single-window clears', () => {
    assert.ok(batchPoints(6) > 6 * batchPoints(1));
    assert.ok(batchPoints(4, 3) > batchPoints(4, 1));
    assert.equal(batchPoints(0, 5), 0);
    const run = create(), g = run.game;
    g.input({ action: 'left_left' });
    assert.equal(g.state.lastClear.count, 1);
    assert.ok(g.state.windows.every(window => window.stack !== 0 || window.direction !== 'left'));
    const before = { score: g.state.score, chain: g.state.chain, next: g.state.next };
    g.input({ action: 'left_left' });
    assert.deepEqual({ score: g.state.score, chain: g.state.chain, next: g.state.next }, before);
    assert.equal(run.sounds.length, 1, 'Empty gestures create no error sound or penalty');
    for (const action of ['left_up', 'left_right', 'right_left', 'right_up', 'right_right']) g.input({ action });
    assert.equal(g.state.lastClear.perfect, true);
    assert.equal(g.state.lastClear.points, batchPoints(1, 6) + 100);
});

test('both stacks grow with a preview, settle after clears and retain an overflow recovery window', () => {
    const run = create(), g = run.game;
    advance(run, 2);
    for (const stack of [0, 1]) assert.equal(g.state.windows.filter(window => window.stack === stack).length, 4);
    assert.equal(g.state.queue.length, 4);
    for (const stack of [0, 1]) for (let i = 0; i < STACK_LIMIT + 1; i++) {
        g.state.windows.push({ id: 100 + stack * 30 + i, stack, direction: 'left', row: i, born: g.state.time });
    }
    advance(run, .5); assert.equal(run.finished, false, 'Near-overflow allows a last-second recovery');
    g.input({ action: 'left_left' });
    g.input({ action: 'right_left' });
    advance(run, .3); assert.equal(g.state.fullAt, null); assert.equal(run.finished, false);
    assert.ok(g.state.bursts.length > 0);
    advance(run, .7); assert.equal(g.state.bursts.length, 0);
    const unattended = create(); advance(unattended, 15);
    assert.equal(unattended.finished, true, 'Only a full stack ends this game early');
});

test('comfortable discrete inputs can sustain a round, and reduced-motion rendering does not change rules', () => {
    const runs = [create(false), create(true)];
    for (const run of runs) {
        let next = 1.7;
        for (let i = 0; i < 3600 && !run.finished; i++) {
            run.game.update(1 / 60);
            const s = run.game.state;
            if (s.time >= next) {
                const counts = new Map();
                for (const w of s.windows) { const action = (w.stack ? 'right_' : 'left_') + w.direction; counts.set(action, (counts.get(action) || 0) + 1); }
                const action = [...counts].sort((a,b) => b[1] - a[1])[0]?.[0];
                if (action) run.game.input({ action });
                next += 1.7;
            }
        }
        assert.equal(run.finished, false, 'One comfortable pulse every 1.7 seconds should remain viable');
        assert.ok(run.game.state.level > 2);
        assert.ok(run.game.state.score > 1000);
    }
    assert.equal(runs[0].game.state.score, runs[1].game.state.score);
    assert.deepEqual(runs[0].game.state.queue, runs[1].game.state.queue);
});

test('paired spawns keep accelerating past a minute and freeze while paused',()=>{
    assert.ok(spawnInterval(30)<spawnInterval(0));
    assert.ok(spawnInterval(60)<spawnInterval(30));
    assert.ok(spawnInterval(120)<spawnInterval(60));
    assert.ok(spawnInterval(600)<spawnInterval(120));
    assert.ok(spawnInterval(3600)>0);
    assert.equal(spawnInterval(30,.8),spawnInterval(30)/.8);
    const run=create(),g=run.game,born=[];
    let serial=g.state.serial;
    for(let frame=0;frame<3600;frame++){
        g.update(1/60);
        if(g.state.serial!==serial){
            assert.equal(g.state.serial-serial,2,'Each arrival adds one popup to each stack');
            born.push(g.state.time);serial=g.state.serial;
        }
        // Isolate the scheduler from overflow and clear bonuses.
        g.state.windows=[];
    }
    assert.ok(born.at(-1)-born.at(-2)<(born[1]-born[0])*.6);
    const paused={time:g.state.time,next:g.state.next,serial:g.state.serial};
    g.pause();g.update(30);
    assert.deepEqual({time:g.state.time,next:g.state.next,serial:g.state.serial},paused);
});

test('two different wrist moves retain separate clear feedback and stack ownership',()=>{
    const {game:g}=create();
    g.input({action:'left_left'});g.input({action:'right_up'});
    assert.equal(g.state.lastClears.left.direction,'left');
    assert.equal(g.state.lastClears.right.direction,'up');
    assert.deepEqual(Object.keys(g.state.taps),['left','right']);
    assert.equal(g.state.windows.some(w=>w.stack===0&&w.direction==='left'),false);
    assert.equal(g.state.windows.some(w=>w.stack===1&&w.direction==='up'),false);
    assert.equal(g.state.score,23);
});
