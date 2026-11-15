import test from 'node:test';
import assert from 'node:assert/strict';
import { engines } from '../arcade/registry.js';
import { games } from '../arcade/catalog.js';
import { lessonFor } from '../arcade/lessons.js';
import { seededRandom } from '../arcade/core/random.js';

test('every game has a specific two-control summary and optional game tips', () => {
    for (const description of games) {
        const instructions = lessonFor(description.engine);
        assert.ok(instructions.left.length > 15 && instructions.right.length > 15 && instructions.tip.length > 40);
    }
});

test('every popup command clears only the matching direction in its own stack', () => {
    const g = engines.popups({ random: seededRandom(123), pace: .8, message() {}, finish() {} });
    g.start();
    for (const wrist of ['left', 'right']) for (const direction of ['left', 'up', 'right']) {
        const other = structuredClone(g.state.windows.filter(w => w.stack !== (wrist === 'left' ? 0 : 1)));
        g.input({ action: wrist + '_' + direction });
        assert.equal(g.state.lastClear.count, 1);
        assert.deepEqual(g.state.windows.filter(w => w.stack !== (wrist === 'left' ? 0 : 1)), other);
        const score = g.state.score, chain = g.state.chain;
        g.input({ action: wrist + '_' + direction });
        assert.equal(g.state.score, score); assert.equal(g.state.chain, chain);
    }
    assert.equal(g.state.lastClear.perfect, true);
    g.dispose();
});
