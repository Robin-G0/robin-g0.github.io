import test from 'node:test';
import assert from 'node:assert/strict';
import { InputRouter } from '../arcade/core/input.js';
import { parseGameFile } from '../arcade/core/import-game.js';
import { games } from '../arcade/catalog.js';

test('inputs are immediate, phase-gated, and never replayed on resume', () => {
    let now = 1000;
    const accepted = [], feedback = [];
    const router = new InputRouter({ accept: event => accepted.push(event),
        feedback: kind => feedback.push(kind), clock: () => now });
    router.dispatch('left');
    assert.equal(accepted.length, 0);
    assert.equal(feedback.at(-1), 'practice');
    router.setPhase('playing');
    assert.equal(router.dispatch('left', { source: 'motion' }), true);
    now += 25;
    assert.equal(router.dispatch('left', { source: 'motion' }), false);
    assert.equal(router.dispatch('right', { source: 'motion' }), true);
    now += 700;
    assert.equal(router.dispatch('left', { source: 'motion' }), true);
    router.setPhase('paused');
    router.dispatch('right');
    router.setPhase('playing');
    assert.equal(accepted.length, 3);
    assert.equal(router.dispatch('right', { timestamp: now - 251 }), false);
    assert.equal(router.dispatch('right', { timestamp: now - 200 }), true);
    assert.equal(router.dispatch('right', { timestamp: now + 100 }), false);
});

test('game imports accept bounded data, not code, asset URLs or prototype fields', () => {
    const base = { schema_version: 1, id: 'my-snake', engine: 'snake',
        title: 'My snake', goal: 'Collect signals.', duration: 60, seed: 7 };
    const parsed = parseGameFile(JSON.stringify(base), games, 'aero');
    assert.equal(parsed.theme, 'aero');
    assert.equal(parsed.controls.left, 'Turn left');
    for (const change of [{ script: 'alert(1)' }, { assets: ['https://example.com/a.svg'] },
        { engine: './external.js' }, { duration: 900 }, { seed: -1 }, { title: '\u0000' },
        { difficulty: 'unlimited' }]) {
        assert.throws(() => parseGameFile(JSON.stringify({ ...base, ...change }), games, 'aero'));
    }
    assert.throws(() => parseGameFile('x'.repeat(32769), games, 'aero'));
    assert.throws(() => parseGameFile('{"schema_version":1,"__proto__":{}}', games, 'aero'));
});

test('the collection has exactly three genuinely named engines per era', () => {
    assert.equal(games.length, 33);
    assert.equal(new Set(games.map(game => game.engine)).size, 33);
    for (const theme of new Set(games.map(game => game.theme))) {
        assert.equal(games.filter(game => game.theme === theme).length, 3);
    }
});
