import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../arcade/catalog.js';
import { engines } from '../arcade/registry.js';
import { seededRandom } from '../arcade/core/random.js';
import { Painter } from '../arcade/core/painter.js';
import { containsPoint } from '../arcade/games/field-notes.js';

function create(engine, seed = 123) {
    const result = { finished: false, messages: [] };
    result.game = engines[engine]({ random: seededRandom(seed), pace: 1,
        finish: () => result.finished = true, message: text => result.messages.push(text) });
    result.game.start();
    return result;
}

function painter() {
    const gradient = { addColorStop() {} };
    const context = new Proxy({ createRadialGradient: () => gradient }, {
        get(target, key) { return key in target ? target[key] : () => {}; }
    });
    return new Painter(context, { bg: '#fff', ink: '#123', accent: '#456',
        muted: '#789', border: '#abc', soft: '#def', gold: '#d90', font: 'Arial' });
}

for (const description of games) {
    test(`${description.engine}: deterministic rules, lifecycle and render`, () => {
        assert.equal(typeof engines[description.engine], 'function');
        const runs = [create(description.engine), create(description.engine)];
        for (const run of runs) {
            const g = run.game, p = painter();
            g.render(p);
            for (let frame = 0; frame < 1200 && !run.finished; frame++) {
                if (frame % 31 === 0) g.input({ action: Object.keys(description.controls)[Math.floor(frame / 31) % Object.keys(description.controls).length], source: 'motion' });
                g.update(1 / 30);
                if (frame % 60 === 0) g.render(p);
                assert.ok(Number.isFinite(g.state.score));
                assert.ok(Number.isFinite(g.state.time));
            }
            g.pause();
            const paused = structuredClone(g.state);
            g.input({ action: 'left' }); g.update(5);
            assert.deepEqual(g.state, paused, 'Paused play must ignore inputs and elapsed time');
            g.resume(); g.render(p);
        }
        assert.deepEqual(runs[0].game.state, runs[1].game.state);
        for (const run of runs) {
            run.game.dispose();
            const closed = structuredClone(run.game.state);
            run.game.input({ action: 'right' }); run.game.update(10);
            assert.deepEqual(run.game.state, closed);
        }
    });
}

test('contour scoring distinguishes an enclosed point from a nearby point', () => {
    const polygon = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 1, y: 4 }];
    assert.equal(containsPoint(polygon, { x: 3.5, y: 2.5 }), true);
    assert.equal(containsPoint(polygon, { x: 6, y: 2.5 }), false);
    const { game: g } = create('contour');
    for (const length of [4, 3, 4, 3]) {
        for (let i = 0; i < length; i++) g.input({ action: 'right' });
        g.input({ action: 'left' });
    }
    assert.equal(g.state.score, 100);
});

test('early and delayed rhythm recognition uses a broad explicit window', () => {
    for (const offset of [-.35, .25]) {
        const { game: g } = create('beat');
        g.update(3);
        g.input({ action: 'left', at: 3 + offset });
        assert.ok(g.state.score > 0);
    }
    const { game: g } = create('beat');
    g.update(3); g.input({ action: 'left', at: 2.3 });
    assert.equal(g.state.score, 0);
});
