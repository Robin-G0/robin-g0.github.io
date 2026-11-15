import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../arcade/catalog.js';
import { engines } from '../arcade/registry.js';
import { seededRandom } from '../arcade/core/random.js';
import { Painter } from '../arcade/core/painter.js';
import { collapse } from '../arcade/games/metro.js';
import { traceMirrors, probeRoute } from '../arcade/games/glass.js';
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

test('merge preserves value and never merges a resulting tile twice', () => {
    assert.deepEqual(collapse([2, 2, 2, 2, 0]), { row: [4, 4, 0, 0, 0], points: 8 });
    assert.deepEqual(collapse([2, 2, 4, 0, 0]).row, [4, 4, 0, 0, 0]);
});

test('all rotated optical puzzles have a valid ray route', () => {
    const run = create('prisms'), g = run.game;
    for (let rotation = 0; rotation < 4; rotation++) {
        g.input({ action: 'left' }); g.input({ action: 'right' });
        g.input({ action: 'right' }); g.input({ action: 'left' });
        assert.equal(traceMirrors(g.state.mirrors, g.state.rotation).hit, true);
        assert.equal(g.state.score, (rotation + 1) * 100);
        g.update(1.1);
    }
});

test('every orbital aim is a physically reachable destination', () => {
    for (const angle of [-.1, 0, .1]) {
        const route = probeRoute(angle, 450000), end = route.at(-1);
        assert.ok(end.x >= 625);
        assert.ok(end.y > 40 && end.y < 380);
        assert.ok(route.every(point => Math.hypot(point.x - 360, point.y - 210) >= 50));
    }
    const run = create('orbit');
    const correct = [-.1, 0, .1].findIndex(angle => Math.abs(probeRoute(angle, 450000).at(-1).y - run.game.state.target.y) < 1);
    while (run.game.state.selected !== correct) run.game.input({ action: 'left' });
    run.game.input({ action: 'right' });
    for (let i = 0; i < 400 && !run.game.state.score; i++) run.game.update(.02);
    assert.equal(run.game.state.score, 75);
});

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
