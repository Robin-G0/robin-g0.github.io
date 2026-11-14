import test from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial } from '../arcade/core/tutorial.js';
import { engines } from '../arcade/registry.js';
import { games } from '../arcade/catalog.js';
import { lessonFor } from '../arcade/lessons.js';

test('every game has specific instructions and an isolated practice engine', () => {
    for (const description of games) {
        const instructions = lessonFor(description.engine);
        assert.ok(instructions.left.length > 15 && instructions.right.length > 15 && instructions.tip.length > 40);
        const lesson = new Tutorial(engines[description.engine]);
        assert.equal(lesson.stage, 'learn');
        assert.equal(lesson.input({ action: 'left' }), false);
        lesson.next();
        for (let i = 0; i < 20; i++) {
            lesson.input({ action: i % 2 ? 'left' : 'right' }); lesson.update(.05);
        }
        assert.equal(lesson.stage, 'practice', 'Testing controls never starts or arms a round');
        assert.equal(lesson.game.state.lives, 3);
        assert.equal(lesson.tried.size, 2);
        const feedback = lesson.game.state.inputFeedback;
        assert.ok(Number.isFinite(feedback.x) && Number.isFinite(feedback.y), description.engine);
        lesson.next(); assert.equal(lesson.stage, 'ready');
        const time = lesson.game.state.time;
        lesson.update(20); assert.equal(lesson.game.state.time, time);
        assert.equal(lesson.input({ action: 'right' }), false);
        lesson.dispose();
    }
});

test('closing a pop-up leaves an object-level confirmation and empty sides explain themselves', () => {
    const messages = [];
    const lesson = new Tutorial(engines.popups, text => messages.push(text));
    lesson.next(); lesson.input({ action: 'left' });
    assert.equal(lesson.game.state.closed.side, 'left');
    assert.equal(lesson.game.state.inputFeedback.points, 10);
    assert.equal(lesson.game.state.windows.some(window => window.side === 'left'), false);
    lesson.input({ action: 'left' });
    assert.equal(messages.at(-1), 'That side is clear.');
    lesson.input({ action: 'right' });
    assert.equal(lesson.tried.size, 2);
    lesson.reset();
    assert.equal(lesson.stage, 'learn'); assert.equal(lesson.tried.size, 0);
    lesson.dispose();
});
