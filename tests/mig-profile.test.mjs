import test from 'node:test';
import assert from 'node:assert/strict';
import createMIG from '../vendor/motion-input-grid/runtime/mig.mjs';
import { arcadeProfile } from '../arcade/mig/profile.js';

const wasm = await createMIG();

function harness() {
    const tracker = new wasm.Tracker();
    assert.equal(tracker.load(JSON.stringify(arcadeProfile)), '');
    assert.equal(tracker.trackHands(), false);
    let time = 0, sequence = 0;
    const events = [];
    const frame = (left, right = 8.5, gap = 40) => {
        time += gap;
        const body = tracker.bodyBuffer(); body.fill(0);
        const put = (i, x, y) => body.set([x, y, 0, 1, 0, 0, 0, 1], i * 8);
        put(11, .65, .45); put(12, .35, .45);
        if (left != null) put(15, .62, .45 + (left - 3.5) * .06);
        if (right != null) put(16, .38, .45 + (right - 3.5) * .06);
        const count = tracker.update(time, ++sequence, 1, 0, 0);
        assert.ok(count >= 0);
        for (let i = 0; i < count; i++) events.push(tracker.eventAction(i));
    };
    for (let i = 0; i < 30; i++) frame(8.5);
    return { tracker, frame, events, close: () => tracker.delete() };
}

test('real packaged WASM recognizes broad fast sweeps, then waits for release', () => {
    for (const gap of [33, 100, 160, 180]) {
        const h = harness();
        try {
            h.frame(5.5);
            h.frame(2.5, 8.5, gap);
            assert.deepEqual(h.events, ['left']);
            for (let i = 0; i < 30; i++) h.frame(2.5);
            assert.equal(h.events.length, 1, 'A raised wrist is not a stream of presses');
            h.frame(8.5); h.frame(8.5); h.frame(5.5); h.frame(2.5);
            assert.equal(h.events.length, 2, 'A visible return rearms the next raise');
        } finally { h.close(); }
    }
});

test('tracking loss, finish-only poses and cooldown paths do not invent actions', () => {
    const h = harness();
    try {
        h.frame(5.5); h.frame(2.5, 8.5, 181);
        assert.equal(h.events.length, 0, 'An overlong gap invalidates the sweep');
        for (let i = 0; i < 8; i++) h.frame(null);
        for (let i = 0; i < 8; i++) h.frame(2.5);
        assert.equal(h.events.length, 0, 'Reappearing at the finish is insufficient');
        h.frame(8.5); h.frame(5.5); h.frame(2.5);
        assert.equal(h.events.length, 1);
        h.frame(8.5); h.frame(5.5); h.frame(2.5);
        for (let i = 0; i < 30; i++) h.frame(2.5);
        assert.equal(h.events.length, 1, 'A path in cooldown is not queued');
        h.frame(8.5); h.frame(8.5, 5.5); h.frame(8.5, 2.5);
        assert.deepEqual(h.events, ['left', 'right']);
    } finally { h.close(); }
});
