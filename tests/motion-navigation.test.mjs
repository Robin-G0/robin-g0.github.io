import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionNavigation } from '../arcade/core/motion-navigation.js';
import { visiblePoint } from '../arcade/mig/camera.js';

test('a recognised wrist confirms tutorial or pause after a visible countdown', () => {
    for (const phase of ['ready', 'paused']) {
        const navigation = new MotionNavigation();
        assert.equal(navigation.request(phase, false, 1000), false);
        assert.equal(navigation.request(phase, true, 1000), true);
        assert.equal(navigation.request(phase, true, 1300), false, 'Extra gestures cannot reset or queue the countdown');
        assert.deepEqual(navigation.step({ visible: true, lastSeen: 1500 }, 1500), { remaining: 3 });
        assert.deepEqual(navigation.step({ visible: true, lastSeen: 4000 }, 4000), { play: true });
        assert.equal(navigation.step({ visible: true, lastSeen: 4100 }, 4100), null);
    }
});

test('tracking loss, stale frames and explicit cancellation never resume a round', () => {
    const navigation = new MotionNavigation();
    assert.equal(navigation.request('playing', true, 1000), false);
    assert.equal(navigation.request('tutorial', true, 1000), false);
    assert.equal(navigation.request('practice', true, 1000), false);
    assert.equal(navigation.request('learn', true, 1000), false);
    navigation.request('paused', true, 1000);
    assert.deepEqual(navigation.step({ visible: false, lastSeen: 1900, lostSince: 1100 }, 1900), { cancelled: true });
    navigation.request('paused', true, 2000);
    assert.deepEqual(navigation.step({ visible: true, lastSeen: 2000 }, 4000), { cancelled: true });
    navigation.request('ready', true, 5000); navigation.cancel();
    assert.equal(navigation.step({ visible: true, lastSeen: 8000 }, 8000), null);
});

test('placement feedback requires confident coordinates inside the image', () => {
    assert.equal(visiblePoint({ x: .3, y: .7, confidence: .8 }), true);
    for (const point of [null, { x: -.1, y: .5, confidence: 1 }, { x: .4, y: 1.1, confidence: 1 },
        { x: .4, y: .5, confidence: .2 }, { x: NaN, y: .4, confidence: 1 }]) assert.equal(visiblePoint(point), false);
});
