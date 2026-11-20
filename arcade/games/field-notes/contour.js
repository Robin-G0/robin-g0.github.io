import { game } from '../../core/game.js?v=eras-4';
import { header, page, write, ink, pencil, hatch, blot, addBurst, bursts, pruneBursts, addEffect, pruneEffects, loseLife } from './display.js?v=eras-4';

// Contour Survey: a pencil walks the dot grid of a survey sheet by itself, one segment per step.
// L and R queue a quarter turn (relative to the pencil) for the next step; the latest raise replaces
// the queued one. When the pencil meets its own line, the loop closes: every summit inside is surveyed,
// and n summits in one loop score 25 x n x n. A marsh inside spoils the loop and costs an attempt;
// walking off the sheet costs one too. The line is only `trail` segments long: older pencil fades.
export const CONTOUR = { cols: 12, rows: 8, step: .7, trail: 26, recovery: 1.3, summits: 3, points: 25,
    marshAfter: 2, marshEvery: 2, maxMarsh: 5, trigAfter: 5, start: { x: 6, y: 6 }, firstStep: 1 };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left (clockwise)
export const turn = (heading, action) => (heading + (action === 'left' ? 3 : 1)) % 4;
export const inBounds = v => v.x >= 0 && v.x <= CONTOUR.cols && v.y >= 0 && v.y <= CONTOUR.rows;
export const stepSeconds = pace => CONTOUR.step / pace;
export const marshTarget = surveys => surveys < CONTOUR.marshAfter ? 0 : Math.min(CONTOUR.maxMarsh, 1 + Math.floor((surveys - CONTOUR.marshAfter) / CONTOUR.marshEvery));

/** Even-odd ray test. Points are {x, y}; cells are tested at their centre (x + .5, y + .5), which never lies on a grid line. */
export function containsPoint(polygon, point) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
export const encloses = (loop, cell) => containsPoint(loop, { x: cell.x + .5, y: cell.y + .5 });
/** One pencil step on a trail: returns the new trail and what happened. Pure, shared by the engine and tests. */
export function advance(trail, heading) {
    const head = trail.at(-1), [dx, dy] = DIRS[heading], next = { x: head.x + dx, y: head.y + dy };
    if (!inBounds(next)) return { crash: true, trail };
    const index = trail.findIndex(v => v.x === next.x && v.y === next.y);
    if (index >= 0) return { loop: trail.slice(index), trail: [next] };
    const grown = [...trail, next];
    return { trail: grown.length > CONTOUR.trail + 1 ? grown.slice(-CONTOUR.trail - 1) : grown };
}
/** Weighted summits inside a loop: a trig pillar counts as two. */
export const surveyValue = (loop, summits) => summits.filter(c => encloses(loop, c)).reduce((sum, c) => sum + (c.kind === 'trig' ? 2 : 1), 0);

export function contour(env) {
    const s = { trail: [{ ...CONTOUR.start }], heading: 0, queued: null, nextStep: CONTOUR.firstStep, heldUntil: 0,
        summits: [], marshes: [], surveys: 0, loops: 0, best: 0, lastTurn: null, bursts: [], effects: [], ended: false };
    const taken = (x, y) => s.summits.some(c => c.x === x && c.y === y) || s.marshes.some(c => c.x === x && c.y === y);
    const near = (list, x, y) => list.some(c => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1);
    function place(ok) {
        for (let i = 0; i < 80; i++) {
            const x = Math.floor(env.random() * CONTOUR.cols), y = Math.floor(env.random() * CONTOUR.rows);
            if (!taken(x, y) && ok(x, y)) return { x, y };
        }
        for (let y = 0; y < CONTOUR.rows; y++) for (let x = 0; x < CONTOUR.cols; x++) if (!taken(x, y) && ok(x, y)) return { x, y };
        return null;
    }
    const head = () => s.trail.at(-1);
    function refill() {
        while (s.marshes.length < marshTarget(s.surveys)) {
            const h = head(), cell = place((x, y) => !near(s.summits, x, y) && Math.abs(x + .5 - h.x) + Math.abs(y + .5 - h.y) > 2.5);
            if (!cell) break; s.marshes.push(cell); addEffect(s, { kind: 'marsh', x: cell.x, y: cell.y });
        }
        while (s.summits.length < CONTOUR.summits) {
            const cell = place((x, y) => !near(s.marshes, x, y)); if (!cell) break;
            const trig = s.surveys >= CONTOUR.trigAfter && !s.summits.some(c => c.kind === 'trig') && env.random() < .5;
            s.summits.push({ ...cell, kind: trig ? 'trig' : 'summit', height: 180 + ((cell.x * 37 + cell.y * 61 + s.loops * 13) % 64) * 10 });
        }
    }
    refill();
    function respawn() { s.trail = [{ ...CONTOUR.start }]; s.heading = 0; s.queued = null; s.heldUntil = s.time + CONTOUR.recovery; s.nextStep = s.heldUntil + stepSeconds(env.pace); }
    function close(loop) {
        s.loops++;
        const marsh = s.marshes.filter(c => encloses(loop, c));
        if (marsh.length) {
            addEffect(s, { kind: 'ring', loop, spoiled: true }); addBurst(s, 'MARSH', loop[0].x, loop[0].y, false);
            loseLife(s, env); return;
        }
        const inside = s.summits.filter(c => encloses(loop, c)), value = surveyValue(loop, s.summits);
        if (!value) { addEffect(s, { kind: 'ring', loop, empty: true }); env.sound?.({ kind: 'input', action: 'right' }); return; }
        const points = CONTOUR.points * value * value;
        s.score += points; s.surveys += inside.length; s.best = Math.max(s.best, value);
        s.summits = s.summits.filter(c => !inside.includes(c));
        addEffect(s, { kind: 'ring', loop, value, surveyed: inside.map(c => ({ ...c })) });
        const [cx, cy] = [inside.reduce((a, c) => a + c.x + .5, 0) / inside.length, inside.reduce((a, c) => a + c.y + .5, 0) / inside.length];
        addBurst(s, value > 1 ? `${value} SUMMITS +${points}` : `+${points}`, cx, cy);
        env.sound?.({ kind: value > 1 ? 'powerup' : 'clear', count: value * 2, chain: value });
        const before = s.marshes.length; refill();
        if (s.marshes.length > before) addBurst(s, 'a marsh appears', CONTOUR.cols / 2, CONTOUR.rows - .5, false, s.time + .6);
    }
    function step() {
        if (s.queued) { s.heading = turn(s.heading, s.queued); s.lastTurn = { action: s.queued, at: s.time }; s.queued = null; }
        const result = advance(s.trail, s.heading);
        if (result.crash) {
            const h = head(); addBurst(s, 'OFF THE MAP', h.x, h.y, false); addEffect(s, { kind: 'crash', x: h.x, y: h.y });
            loseLife(s, env); if (!s.ended) respawn(); return;
        }
        s.trail = result.trail;
        if (result.loop) close([...result.loop]);
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            s.queued = event.action; s.queuedAt = s.time; env.sound?.({ kind: 'turn', action: event.action });
        },
        update(s) {
            pruneBursts(s); pruneEffects(s, 2.4);
            if (s.ended || s.time < s.heldUntil) return;
            while (!s.ended && s.time >= s.nextStep) { const at = s.nextStep; s.nextStep += stepSeconds(env.pace); if (s.time >= s.heldUntil) step(); if (s.heldUntil > at) break; }
        },
        render(s, p) {
            const compact = p.compact, reduced = env.reducedMotion, k = compact ? 1.5 : 1;
            page(p);
            header(p, `${s.surveys} surveyed`, s.surveys < CONTOUR.marshAfter ? 'ring the summits ▲' : s.surveys < CONTOUR.trigAfter ? 'keep the marsh out' : 'trig pillar ◆ counts twice');
            const cell = compact ? Math.min(56, (p.h - 230) / CONTOUR.rows) : 40, w = cell * CONTOUR.cols, h = cell * CONTOUR.rows;
            const left = 360 - w / 2, top = compact ? 110 : 68;
            const X = x => left + x * cell, Y = y => top + y * cell, V = v => [X(v.x), Y(v.y)];
            // The sheet: a soft wash, faint contour lines (fixed, decorative) and the dot grid.
            p.rect(left, top, w, h, 'soft'); p.outline(left, top, w, h, 'ink', 1.5);
            const c = p.c; c.save(); c.beginPath(); c.rect(left, top, w, h); c.clip(); c.globalAlpha = .35;
            for (const [cx, cy, n] of [[.3, .35, 4], [.78, .62, 3]]) for (let i = 1; i <= n; i++) {
                const pts = []; for (let a = 0; a <= 40; a++) { const t = a / 40 * Math.PI * 2, r = i * cell * 1.1 * (1 + .12 * Math.sin(t * 3 + i)); pts.push([left + cx * w + Math.cos(t) * r * 1.4, top + cy * h + Math.sin(t) * r]); }
                p.line(pts, 'gold', 1);
            }
            c.restore();
            for (let x = 0; x <= CONTOUR.cols; x++) for (let y = 0; y <= CONTOUR.rows; y++) p.circle(X(x), Y(y), 1.8 * k, 'muted');
            // Rings from closed loops: ink contour plus pencil hatching; spoiled ones are smudged.
            for (const e of s.effects) {
                if (e.kind !== 'ring') continue;
                const age = s.time - e.at, pts = [...e.loop, e.loop[0]].map(V), fade = age > 1.6 ? Math.max(0, 1 - (age - 1.6) / .8) : 1;
                c.save(); c.globalAlpha = fade;
                if (!e.empty && !e.spoiled) hatch(p, pts, reduced ? 1 : age / .5, 'accent', 8 * k, .4);
                ink(p, pts, e.spoiled ? 'gold' : e.empty ? 'muted' : 'accent', (e.empty ? 2 : 3.5) * k, reduced ? 1 : Math.min(1, age / .35));
                if (e.spoiled) blot(p, ...V({ x: e.loop[0].x, y: e.loop[0].y }), 12 * k, 'ink', .6);
                for (const t of e.surveyed || []) write(p, `${t.height} m`, X(t.x + .5), Y(t.y + .5) + cell * .62, 19 * k, 'accent', 'center', { serifFace: true, italic: true });
                c.restore();
            }
            // Marshes: reed tufts over a blue-green wash, with a cross for colour-blind reading.
            for (const m of s.marshes) {
                const x = X(m.x), y = Y(m.y), born = s.effects.find(e => e.kind === 'marsh' && e.x === m.x && e.y === m.y), grow = born && !reduced ? Math.min(1, (s.time - born.at) / .5) : 1;
                c.save(); c.globalAlpha = .35 * grow; p.rect(x + 2, y + 2, cell - 4, cell - 4, 'border'); c.restore();
                for (let i = 0; i < 3; i++) { const bx = x + cell * (.25 + i * .25), by = y + cell * .78; pencil(p, [[bx, by], [bx - 4 * k, by - cell * .45 * grow]], 1.6, [], .9, 'ink'); pencil(p, [[bx, by], [bx + 4 * k, by - cell * .35 * grow]], 1.6, [], .9, 'ink'); }
                pencil(p, [[x + cell * .15, y + cell * .85], [x + cell * .85, y + cell * .85]], 1.6, [], .9, 'ink');
            }
            // Summits: an inked triangle with its height; a trig pillar is a brass diamond worth two.
            for (const t of s.summits) {
                const x = X(t.x + .5), y = Y(t.y + .5), r = cell * (compact ? .42 : .34);
                if (t.kind === 'trig') { c.save(); c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.2); c.lineTo(x - r, y); c.closePath(); c.fillStyle = p.color('gold'); c.fill(); c.strokeStyle = p.color('ink'); c.lineWidth = 2; c.stroke(); c.restore(); }
                else { c.save(); c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y + r * .75); c.lineTo(x - r, y + r * .75); c.closePath(); c.fillStyle = p.color('ink'); c.fill(); c.restore(); }
            }
            // The pencil line: older segments fade like soft graphite; the head is a pencil tip.
            const trail = s.trail.map(V);
            for (let i = 1; i < trail.length; i++) pencil(p, [trail[i - 1], trail[i]], 3 * k, [], .35 + .6 * i / trail.length, 'ink');
            const hv = s.trail.at(-1), [hx, hy] = V(hv), held = s.time < s.heldUntil;
            const nextHeading = s.queued ? turn(s.heading, s.queued) : s.heading, [ndx, ndy] = DIRS[nextHeading];
            const nextV = { x: hv.x + ndx, y: hv.y + ndy }, off = !inBounds(nextV);
            if (!held) pencil(p, [[hx, hy], [hx + ndx * cell, hy + ndy * cell]], 2.5 * k, [4, 5], .9, off ? 'gold' : 'accent');
            if (!held && off) write(p, '!', hx + ndx * cell * .5 + 12 * k, hy + ndy * cell * .5, 26 * k, 'gold', 'center', { weight: 700 });
            const [fdx, fdy] = DIRS[s.heading], tip = 16 * k;
            c.save(); c.translate(hx, hy); c.rotate(Math.atan2(fdy, fdx));
            if (held && !reduced) c.globalAlpha = .5 + .5 * Math.abs(Math.sin(s.time * 6));
            c.beginPath(); c.moveTo(tip * .9, 0); c.lineTo(0, -6 * k); c.lineTo(-tip * 1.6, -6 * k); c.lineTo(-tip * 1.6, 6 * k); c.lineTo(0, 6 * k); c.closePath();
            c.fillStyle = p.color('gold'); c.fill(); c.strokeStyle = p.color('ink'); c.lineWidth = 1.5; c.stroke();
            c.beginPath(); c.moveTo(tip * .9, 0); c.lineTo(tip * .35, -2.5 * k); c.lineTo(tip * .35, 2.5 * k); c.closePath(); c.fillStyle = p.color('ink'); c.fill(); c.restore();
            // The queued turn: a curled arrow on the side it turns to, with its letter.
            if (s.queued && !held) {
                const side = s.queued === 'left' ? -1 : 1, nx = -fdy * side, ny = fdx * side;
                write(p, s.queued === 'left' ? '↶ L' : 'R ↷', hx + nx * 30 * k + fdx * 8, hy + ny * 30 * k + fdy * 8, 24 * k, 'accent', 'center', { serifFace: true, weight: 700 });
            }
            const crash = s.effects.find(e => e.kind === 'crash' && s.time - e.at < 1.2);
            if (crash) blot(p, X(crash.x), Y(crash.y), 13 * k, 'ink', .7 * (1 - (s.time - crash.at) / 1.2));
            // Compass rose in the margin; its needle settles on north.
            const rx = compact ? 640 : 680, ry = compact ? top + h + 60 : top + h - 26, rr = compact ? 30 : 22;
            p.circle(rx, ry, rr, 'border', false);
            const settle = reduced ? 0 : Math.sin(s.time * 3) * Math.exp(-((s.time - (s.lastTurn?.at ?? -9)) * 2)) * .5;
            c.save(); c.translate(rx, ry); c.rotate(settle); c.beginPath(); c.moveTo(0, -rr * .9); c.lineTo(rr * .2, 0); c.lineTo(0, rr * .9); c.lineTo(-rr * .2, 0); c.closePath(); c.fillStyle = p.color('gold'); c.fill(); c.restore();
            write(p, 'N', rx, ry - rr - 12 * k, 19 * k, 'ink', 'center', { serifFace: true, weight: 700 });
            write(p, `line ${s.trail.length - 1} of ${CONTOUR.trail}`, left, top + h + (compact ? 36 : 18), compact ? 30 : 18, 'muted', 'left', { serifFace: true, italic: true });
            bursts(s, p, reduced, b => [X(b.x), Y(b.y) - cell * .8]);
        }
    });
}
