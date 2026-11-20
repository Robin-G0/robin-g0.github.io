import { game } from '../../core/game.js';
import { decodeGesture } from '../../core/commands.js';
import { header, page, write, ink, pencil, star, blot, tag, stamp, addBurst, bursts, pruneBursts, addEffect, pruneEffects, loseLife } from './display.js';

// Constellations: a figure is inked on the star chart stroke by stroke, then fades. Retrace it from
// memory: at every star, the next candidates are circled and you point toward the right one with a
// sideways sweep (either wrist, toward the star) or, from the third figure, a raise for the star above.
// A wrong star blots the chart, costs an attempt and the figure is shown again from the start.
// Coordinates are normalised to the chart, u right and v down, both in [0, 1].
export const STARS = { opening: 4, max: 9, showStep: .55, hold: .9, retry: 1, admire: 1.4, link: 10, finishPerLink: 10,
    upAt: 2, margin: .06, spacing: .15, clearance: .06 };
export const NAMES = ['The Heron', 'The Fern', 'The Lantern', 'The Hare', 'The Compass', 'The Kite', 'The Beetle', 'The Owl', 'The Acorn', 'The Lighthouse', 'The Moth', 'The Anchor'];
/** Direction types a step may take; three-way choices unlock with the third figure. */
export const choicesFor = figures => figures >= STARS.upAt ? ['left', 'up', 'right'] : ['left', 'right'];
const inside = q => q.u >= STARS.margin && q.u <= 1 - STARS.margin && q.v >= STARS.margin && q.v <= 1 - STARS.margin;
const dist = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);
function segmentGap(q, a, b) {
    const du = b.u - a.u, dv = b.v - a.v, t = Math.max(0, Math.min(1, ((q.u - a.u) * du + (q.v - a.v) * dv) / (du * du + dv * dv || 1)));
    return Math.hypot(q.u - a.u - du * t, q.v - a.v - dv * t);
}
/** A point in a direction type from `from`: left/right move at least .14 sideways, up rises at least .17 and stays nearly vertical. */
export function offset(random, from, type, three) {
    if (type === 'up') return { u: from.u + (random() * 2 - 1) * .06, v: from.v - .17 - random() * .14 };
    const sign = type === 'left' ? -1 : 1, dv = three ? -.12 + random() * .4 : (random() * 2 - 1) * .3;
    return { u: from.u + sign * (.14 + random() * .16), v: from.v + dv };
}
/** The type of the move from a to b, as the player reads it. */
export function typeOf(a, b) {
    if (Math.abs(b.u - a.u) < .1 && b.v < a.v) return 'up';
    return b.u < a.u ? 'left' : 'right';
}
/** A figure of n stars, each step a left/right (or up) move, with a decoy for every other offered direction. */
export function makeFigure(random, n, figures) {
    const types = choicesFor(figures), three = types.length === 3;
    for (let attempt = 0; attempt < 60; attempt++) {
        const stars = [{ u: .25 + random() * .5, v: three ? .55 + random() * .3 : .3 + random() * .4 }], answers = [];
        let ok = true;
        for (let i = 1; i < n && ok; i++) {
            ok = false;
            for (let t = 0; t < 30 && !ok; t++) {
                const from = stars[i - 1], type = types[Math.floor(random() * types.length)], q = offset(random, from, type, three);
                if (!inside(q) || typeOf(from, q) !== type || stars.some(o => dist(o, q) < STARS.spacing)) continue;
                if (stars.slice(0, -1).some(o => segmentGap(o, from, q) < STARS.clearance)) continue;
                stars.push(q); answers.push(type); ok = true;
            }
        }
        if (!ok) continue;
        const decoys = [];
        for (let i = 0; i < n - 1 && ok; i++) {
            const from = stars[i], step = {};
            for (const type of types) {
                if (type === answers[i]) continue;
                let placed = null;
                for (let t = 0; t < 30 && !placed; t++) {
                    const q = offset(random, from, type, three);
                    if (!inside(q) || typeOf(from, q) !== type || stars.some(o => dist(o, q) < STARS.spacing)
                        || Object.values(step).some(o => dist(o, q) < STARS.spacing) || dist(q, stars[i + 1]) < .2) continue;
                    placed = q;
                }
                if (!placed) { ok = false; break; }
                step[type] = placed;
            }
            decoys.push(step);
        }
        if (ok) return { stars, answers, decoys, types };
    }
    // Practically unreachable fallback: a fixed zigzag, left/right only, mirrored decoys.
    const stars = Array.from({ length: n }, (_, i) => ({ u: .2 + (i % 2) * .3 + i * .05, v: .8 - i * .07 }));
    const answers = stars.slice(1).map((q, i) => typeOf(stars[i], q));
    return { stars, answers, types: ['left', 'right'], decoys: answers.map((type, i) => ({ [type === 'left' ? 'right' : 'left']: { u: 2 * stars[i].u - stars[i + 1].u, v: stars[i + 1].v } })) };
}

export function constellations(env) {
    const s = { figure: null, size: STARS.opening, figures: 0, index: 0, phase: 'show', showAt: .6, mistakes: 0, cleanRun: 0,
        lastPick: null, bursts: [], effects: [], ended: false };
    function next() { s.figure = makeFigure(env.random, s.size, s.figures); s.index = 0; s.mistakes = 0; }
    next();
    const showLength = () => (s.figure.stars.length - 1) * STARS.showStep + STARS.hold;
    function replay(delay) { s.phase = 'show'; s.showAt = s.time + delay; s.index = 0; }
    function complete() {
        const links = s.figure.stars.length - 1, clean = s.mistakes === 0, bonus = STARS.finishPerLink * links * (clean ? 2 : 1);
        s.score += bonus; s.cleanRun = clean ? s.cleanRun + 1 : 0;
        addEffect(s, { kind: 'charted', name: NAMES[s.figures % NAMES.length], figure: s.figure, clean });
        addBurst(s, clean ? `CLEAN ×2 +${bonus}` : `+${bonus}`, .5, .5);
        env.sound?.({ kind: clean ? 'powerup' : 'clear', count: links, chain: Math.min(4, links - 2) });
        s.figures++; if (s.figures === STARS.upAt) addBurst(s, 'now stars above too: raise ↑', .5, .62, true, s.time + .5);
        s.size = Math.min(STARS.max, s.size + 1); next(); replay(STARS.admire);
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            const direction = event.direction ?? decodeGesture(event.action)?.direction ?? event.action;
            if (s.ended || !['left', 'up', 'right'].includes(direction)) return;
            if (s.phase !== 'trace' || !s.figure.types.includes(direction)) { s.lastPick = { direction, at: s.time, ignored: true }; return; }
            const from = s.figure.stars[s.index];
            if (direction === s.figure.answers[s.index]) {
                s.index++; s.score += STARS.link; s.lastPick = { direction, at: s.time, ignored: false };
                addEffect(s, { kind: 'link', index: s.index });
                env.sound?.({ kind: 'turn', action: direction === 'left' ? 'left' : 'right' });
                if (s.index === s.figure.stars.length - 1) complete();
                return;
            }
            const wrong = s.figure.decoys[s.index][direction];
            addEffect(s, { kind: 'blot', u: wrong.u, v: wrong.v, from: { ...from } });
            addBurst(s, 'NOT THIS ONE', wrong.u, wrong.v, false);
            s.mistakes++; s.cleanRun = 0; loseLife(s, env);
            if (!s.ended) replay(STARS.retry);
        },
        update(s) {
            pruneBursts(s); pruneEffects(s, 2.4);
            if (s.ended) return;
            if (s.phase === 'show' && s.time >= s.showAt + showLength()) s.phase = 'trace';
        },
        render(s, p) {
            const compact = p.compact, reduced = env.reducedMotion, k = compact ? 1.5 : 1;
            page(p);
            const fig = s.figure, n = fig.stars.length;
            header(p, `${s.figures} charted`, `${n} stars · ${fig.types.length === 3 ? 'three ways' : 'left or right'}${s.cleanRun > 1 ? ` · ${s.cleanRun} clean` : ''}`);
            const left = compact ? 70 : 80, right = compact ? 660 : 640, top = compact ? 150 : 82, bottom = compact ? p.h - 150 : 380;
            const P = q => [left + q.u * (right - left), top + q.v * (bottom - top)];
            // The chart: a planisphere rim, faint declination arcs and fixed background stars (not gameplay RNG).
            const c = p.c, cx = (left + right) / 2, cy = (top + bottom) / 2;
            c.save(); c.globalAlpha = .45;
            p.c.beginPath(); p.c.ellipse(cx, cy, (right - left) / 2 + 14, (bottom - top) / 2 + 14, 0, 0, Math.PI * 2); p.c.strokeStyle = p.color('border'); p.c.lineWidth = 2; p.c.stroke();
            for (let i = 1; i <= 2; i++) { p.c.beginPath(); p.c.ellipse(cx, cy, (right - left) / 2 * i / 3, (bottom - top) / 2 * i / 3, 0, 0, Math.PI * 2); p.c.setLineDash([2, 6]); p.c.stroke(); p.c.setLineDash([]); }
            for (let i = 0; i < 46; i++) { const u = (i * 0.6180339) % 1, v = (i * 0.4142135 + .13) % 1; const [x, y] = P({ u, v }); p.circle(x, y, i % 9 ? 1.2 : 2, 'muted'); }
            c.restore();
            // A charted figure stays a moment, named and stamped.
            const charted = s.effects.findLast(e => e.kind === 'charted' && s.time - e.at < STARS.admire);
            if (charted) {
                const pts = charted.figure.stars.map(P); ink(p, pts, 'accent', 3 * k); pts.forEach(([x, y]) => star(p, x, y, 9 * k, 'ink'));
                stamp(p, charted.name.toUpperCase(), cx, cy, s.time - charted.at, 'accent', reduced, 24 * k);
            }
            const showing = s.phase === 'show' && s.time >= s.showAt;
            if (showing) {
                // Inked stroke by stroke, held, then faded.
                const t = s.time - s.showAt, drawn = Math.min(n - 1, t / STARS.showStep), fade = Math.max(0, Math.min(1, (s.showAt + showLength() - s.time) / .35));
                const pts = fig.stars.map(P);
                c.save(); c.globalAlpha = fade;
                ink(p, pts, 'accent', 3 * k, reduced ? Math.ceil(drawn) / (n - 1) : drawn / (n - 1));
                pts.forEach(([x, y], i) => { if (i <= Math.ceil(drawn)) star(p, x, y, (i === 0 ? 12 : 9) * k, 'ink'); });
                c.restore();
                write(p, 'watch the figure', cx, bottom + (compact ? 70 : 26), compact ? 34 : 22, 'muted', 'center', { serifFace: true, italic: true });
            } else if (s.phase === 'trace') {
                const pts = fig.stars.slice(0, s.index + 1).map(P);
                ink(p, pts, 'accent', 3 * k);
                pts.forEach(([x, y]) => star(p, x, y, 9 * k, 'ink'));
                const from = fig.stars[s.index], [fx, fy] = P(from);
                p.circle(fx, fy, 18 * k, 'accent', false);
                const offered = { [fig.answers[s.index]]: fig.stars[s.index + 1], ...fig.decoys[s.index] };
                for (const type of fig.types) {
                    const q = offered[type]; if (!q) continue;
                    const [x, y] = P(q);
                    pencil(p, [[fx, fy], [x, y]], 1.5 * k, [3, 6], .7);
                    star(p, x, y, 9 * k, 'ink'); p.circle(x, y, 17 * k, 'muted', false);
                    const tx = x + (type === 'left' ? -30 : type === 'right' ? 30 : 0) * k, ty = y + (type === 'up' ? -30 : -2) * k;
                    tag(p, type === 'left' ? '←' : type === 'right' ? '→' : '↑', tx, ty, 14 * k, 'accent', true);
                }
                write(p, `star ${s.index + 2} of ${n}`, cx, bottom + (compact ? 70 : 26), compact ? 34 : 22, 'ink', 'center', { serifFace: true, italic: true });
                const link = s.effects.findLast(e => e.kind === 'link' && s.time - e.at < .4);
                if (link && !reduced) { const [x, y] = P(fig.stars[link.index]); c.save(); c.globalAlpha = 1 - (s.time - link.at) / .4; p.circle(x, y, (14 + (s.time - link.at) * 40) * k, 'accent', false); c.restore(); }
            } else if (!charted && s.mistakes) write(p, 'again, from the first star', cx, cy, compact ? 40 : 28, 'muted', 'center', { serifFace: true, italic: true });
            for (const e of s.effects) if (e.kind === 'blot') { const [x, y] = P(e); blot(p, x, y, 14 * k, 'ink', .75 * Math.max(0, 1 - (s.time - e.at) / 2.4)); }
            if (s.lastPick?.ignored && s.time - s.lastPick.at < .5 && s.phase === 'trace') write(p, s.lastPick.direction === 'up' ? 'no star above yet' : '', cx, top - 4, compact ? 24 : 16, 'muted', 'center', { serifFace: true, italic: true });
            bursts(s, p, reduced, b => { const [x, y] = P({ u: b.x, v: b.y }); return [x, y - 30 * k]; });
        }
    });
}
