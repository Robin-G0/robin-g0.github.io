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

test('one direction clears all matching arrows across both stacks without punishing empty moves', () => {
    const messages = [];
    const game = engines.popups({ random: seededRandom(123), pace: .8,
        message: text => messages.push(text), finish() {} });
    game.start(); game.input({ action: 'left' });
    assert.equal(game.state.lastClear.count, 3);
    assert.equal(game.state.inputFeedback.points, 90);
    assert.equal(game.state.windows.some(window => window.action === 'left'), false);
    const score = game.state.score, chain = game.state.chain;
    game.input({ action: 'left' });
    assert.equal(game.state.score, score);
    assert.equal(game.state.chain, chain);
    game.input({ action: 'right' });
    assert.ok(game.state.score > 180, 'Chain and all-clear bonuses reward the next sweep');
    game.dispose();
});
