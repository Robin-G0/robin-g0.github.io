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

test('closing a pop-up leaves an object-level confirmation and empty sides explain themselves', () => {
    const messages = [];
    const game = engines.popups({ random: seededRandom(123), pace: .8,
        message: text => messages.push(text), finish() {} });
    game.start(); game.input({ action: 'left' });
    assert.equal(game.state.closed.side, 'left');
    assert.equal(game.state.inputFeedback.points, 10);
    assert.equal(game.state.windows.some(window => window.side === 'left'), false);
    game.input({ action: 'left' });
    assert.equal(messages.at(-1), 'That side is clear.');
    game.input({ action: 'right' });
    assert.equal(game.state.score, 20);
    game.dispose();
});
