import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { pinstripes, toolbar, brushed, gel, marble as drawMarble, light, progress, poof, throb, isDark,
    addBurst, bursts, pruneBursts, addEffect, pruneEffects, loseLife } from './display.js';

// Marble Gates: brushed-metal shelves rise toward a striped ceiling. Each raise tilts the tray, so the
// marble rolls that way and drops through the FIRST gate it meets. Choose the side whose first gate
// is worth taking; if the marble's shelf reaches the ceiling it is crushed. Rows and lanes are logical
// units, so a tall phone board shows the same world at a larger scale.
export const MARBLE = { lanes: 7, rise: .3, roll: 2.6, fall: 5, ceiling: .2, floor: 5, gateSpan: .4, depth: 6, respawnRow: 2.6, grace: 1.4,
    points: { plain: 10, zoom: 30, minimise: 20 }, streakStep: 5, maxMultiplier: 4,
    stages: [0, 15, 35, 60], zoomChance: .3, minimiseChance: .2, closeChance: .5 };
/** Stage 0 plain gates; 1 adds green zoom gates (+30); 2 red close gates (lose a life); 3 yellow minimise gates (fall two shelves). */
export const stageAt = time => MARBLE.stages.filter(at => time >= at).length - 1;
export const multiplier = streak => Math.min(MARBLE.maxMultiplier, 1 + Math.floor(streak / MARBLE.streakStep));
export const riseSpeed = pace => MARBLE.rise * pace;
const STAGE_NEWS = ['', 'new · green + gates score 30', 'new · red × gates cost a life', 'new · yellow − gates drop two shelves'];

/** Gates never sit directly under the previous shelf's gates, so every normal drop lands on metal.
 * A red gate only ever appears as the middle of three, so from any landing one side's first gate is safe. */
export function makeGates(random, previous, stage) {
    const free = Array.from({ length: MARBLE.lanes }, (_, lane) => lane).filter(lane => !previous.includes(lane));
    const close = stage >= 2 && random() < MARBLE.closeChance, count = close ? 3 : 2, lanes = [];
    while (lanes.length < count) lanes.push(...free.splice(integer(random, 0, free.length - 1), 1));
    lanes.sort((a, b) => a - b);
    return lanes.map((lane, i) => {
        if (close && i === 1) return { lane, kind: 'close' };
        const roll = random();
        if (stage >= 3 && roll < MARBLE.minimiseChance) return { lane, kind: 'minimise' };
        if (stage >= 1 && roll > 1 - MARBLE.zoomChance) return { lane, kind: 'zoom' };
        return { lane, kind: 'plain' };
    });
}
/** The first gate met when rolling from x in a direction, or null at the wall. */
export function firstGate(gates, x, direction) {
    const ahead = gates.filter(g => direction > 0 ? g.lane > x + 1e-9 : g.lane < x - 1e-9);
    if (!ahead.length) return null;
    return ahead.reduce((best, g) => Math.abs(g.lane - x) < Math.abs(best.lane - x) ? g : best);
}

export function marble(env) {
    const s = { shelves: [], ball: { x: 3, y: 2, shelf: 0, falling: false, fellAt: -10, skip: 0 }, tilt: 0, tiltAt: -10,
        gates: 0, streak: 0, stage: 0, graceUntil: 0, ids: 0, bursts: [], effects: [], ended: false };
    function addShelf(y) {
        const previous = s.shelves.at(-1)?.gates.map(g => g.lane) ?? [3];
        s.shelves.push({ id: ++s.ids, y, gates: makeGates(env.random, previous, s.stage) });
    }
    for (let y = 1; y <= MARBLE.depth + 1; y++) addShelf(y);
    // The opening shelf under the marble keeps the centre solid: lane 3 was the "previous" gate of shelf 1.
    s.ball.shelf = s.shelves[1].id;
    const shelfOf = id => s.shelves.find(shelf => shelf.id === id);

    function pass(gate, shelfY) {
        const x = gate.lane;
        addEffect(s, { kind: 'gate', lane: gate.lane, shelf: shelfY, gate: gate.kind });
        if (gate.kind === 'close') {
            s.streak = 0; addBurst(s, '× CLOSED', x, shelfY, false); loseLife(s, env); return;
        }
        const mult = multiplier(s.streak), points = MARBLE.points[gate.kind] * mult;
        s.streak++; s.gates++; s.score += points;
        addBurst(s, mult > 1 ? `+${points} ×${mult}` : `+${points}`, x, shelfY);
        if (multiplier(s.streak) > mult) { env.sound?.({ kind: 'powerup' }); addEffect(s, { kind: 'streak', mult: multiplier(s.streak) }); }
        else env.sound?.(gate.kind === 'plain' ? { kind: 'bounce', action: x < 3 ? 'left' : 'right' } : { kind: 'clear', count: 4, perfect: true, chain: mult });
        if (gate.kind === 'minimise') s.ball.skip = 1;
    }
    function drop(gate, shelf) {
        Object.assign(s.ball, { x: gate.lane, falling: true, fellAt: s.time, shelf: null });
        pass(gate, shelf.y);
    }
    function land(shelf) {
        // Landing: the tray levels unless a tilt was raised during the fall.
        Object.assign(s.ball, { y: shelf ? shelf.y : MARBLE.floor, shelf: shelf ? shelf.id : null, falling: false });
        if (s.tiltAt < s.ball.fellAt) s.tilt = 0;
        addEffect(s, { kind: 'land', lane: s.ball.x });
    }
    function respawn() {
        const shelf = s.shelves.find(item => item.y >= MARBLE.respawnRow) || s.shelves.at(-1);
        const solid = Array.from({ length: MARBLE.lanes }, (_, lane) => lane).filter(lane => !shelf.gates.some(g => g.lane === lane));
        const lane = solid.reduce((best, lane) => Math.abs(lane - 3) < Math.abs(best - 3) ? lane : best, solid[0]);
        Object.assign(s.ball, { x: lane, y: shelf.y, shelf: shelf.id, falling: false, skip: 0 });
        s.tilt = 0; s.graceUntil = s.time + MARBLE.grace;
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            s.tilt = event.action === 'left' ? -1 : 1; s.tiltAt = s.time;
            env.sound?.({ kind: 'turn', action: event.action });
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) { s.stage = stage; addEffect(s, { kind: 'stage', stage }); env.sound?.({ kind: 'powerup' }); }
            const rise = riseSpeed(env.pace) * dt;
            for (const shelf of s.shelves) shelf.y -= rise;
            s.shelves = s.shelves.filter(shelf => shelf.y > -.6 || shelf.id === s.ball.shelf);
            while (s.shelves.at(-1).y < MARBLE.depth) addShelf(s.shelves.at(-1).y + 1);
            const ball = s.ball;
            if (ball.falling) {
                // Compare in the shelves' frame: they rose by `rise` this step, so a shelf just under the marble cannot slip past it.
                const from = ball.y - rise; ball.y += MARBLE.fall * dt;
                for (const shelf of s.shelves) {
                    if (shelf.y <= from || shelf.y > ball.y || shelf.y > MARBLE.floor || !ball.falling) continue;
                    const gate = shelf.gates.find(g => g.lane === ball.x);
                    if (ball.skip > 0) { ball.skip--; continue; } // Minimised: the genie carries it through one shelf.
                    if (gate) { pass(gate, shelf.y); if (s.ended) return; continue; }
                    land(shelf);
                }
                if (ball.falling && ball.y >= MARBLE.floor) land(null); // The glass floor: nothing to fall through.
                return;
            }
            const shelf = ball.shelf == null ? null : shelfOf(ball.shelf);
            if (!shelf) {
                // On the floor, a shelf rising through the floor picks the marble up unless a gate is right under it.
                ball.y = MARBLE.floor;
                const lift = s.shelves.find(item => item.y <= MARBLE.floor && item.y > MARBLE.floor - rise - 1e-9);
                if (lift && !lift.gates.some(g => Math.abs(g.lane - ball.x) < MARBLE.gateSpan)) { Object.assign(ball, { shelf: lift.id, y: lift.y }); return; }
            } else {
                ball.y = shelf.y;
                if (shelf.y <= MARBLE.ceiling && s.time >= s.graceUntil) {
                    addEffect(s, { kind: 'crush', x: ball.x, y: shelf.y }); addBurst(s, 'CRUSHED', ball.x, 1, false);
                    s.streak = 0; loseLife(s, env); if (!s.ended) respawn(); return;
                }
            }
            if (!s.tilt) return;
            const target = ball.x + s.tilt * MARBLE.roll * dt, gate = shelf && firstGate(shelf.gates, ball.x, s.tilt);
            if (gate && (s.tilt > 0 ? gate.lane <= target : gate.lane >= target)) drop(gate, shelf);
            else ball.x = Math.max(0, Math.min(MARBLE.lanes - 1, target));
        },
        render(s, p) {
            const compact = p.compact, dark = isDark(p), reduced = env.reducedMotion;
            pinstripes(p);
            const stageNews = s.effects.findLast(e => e.kind === 'stage');
            const mult = multiplier(s.streak), toNext = MARBLE.streakStep - s.streak % MARBLE.streakStep;
            const top = toolbar(p, `${s.gates} gates`, stageNews ? STAGE_NEWS[stageNews.stage]
                : mult < MARBLE.maxMultiplier ? `×${mult} · ×${mult + 1} in ${toNext}` : `×${mult} streak`);
            // Board: a striped ceiling, then rows. Phones get larger rows, capped so shelves stay grouped.
            const barH = compact ? 22 : 14, ceil = top + (compact ? 14 : 8) + barH;
            const avail = p.h - ceil - (compact ? 30 : 10), row = Math.min(avail / 5.45, compact ? 230 : 120);
            const y0 = ceil + Math.max(0, (avail - row * 5.45) * .3), Y = rowY => y0 + rowY * row;
            const left = compact ? 60 : 90, pitch = compact ? 100 : 90, X = lane => left + lane * pitch;
            const thick = compact ? 26 : 16, gapW = pitch * .74, r = Math.min(compact ? 34 : 19, row * .3);
            const ballShelf = shelfOf(s.ball.shelf), danger = ballShelf && !s.ball.falling && ballShelf.y < 1.2;
            const ceilY = y0 - barH - 6 + (compact ? 4 : 2);
            progress(p, 24, ceilY, 672, barH, 1, s.time, reduced, 'red');
            if (danger && !reduced) { p.c.save(); p.c.globalAlpha = .35 * throb(s.time); p.rect(24, ceilY + barH, 672, 8, '#e0503c', 4); p.c.restore(); }
            const gateFx = s.effects.filter(e => e.kind === 'gate');
            p.c.save(); p.c.beginPath(); p.c.rect(0, 0, 720, Y(MARBLE.floor) - thick * .4); p.c.clip();
            for (const shelf of s.shelves) {
                const y = Y(shelf.y); if (y < ceilY - thick || shelf.y > MARBLE.floor + .5) continue;
                const cuts = shelf.gates.map(g => g.lane).sort((a, b) => a - b);
                let from = 30;
                for (const lane of cuts) { brushed(p, from, y - thick / 2, X(lane) - gapW / 2 - from, thick, thick / 2); from = X(lane) + gapW / 2; }
                brushed(p, from, y - thick / 2, 690 - from, thick, thick / 2);
                for (const gate of shelf.gates) {
                    // A gate is a gel badge set into the gap; it wobbles (squash and stretch) when the marble passes.
                    const fx = gateFx.find(e => e.lane === gate.lane && Math.abs(e.shelf - shelf.y) < 1.5 && s.time - e.at < .5);
                    const age = fx ? s.time - fx.at : 1, wob = fx && !reduced ? Math.sin(age * 28) * (1 - age / .5) * .22 : 0;
                    const size = thick * 1.5, w = size * (1 + wob), h = size * (1 - wob);
                    const kind = { plain: 'plain', zoom: 'zoom', close: 'close', minimise: 'minimise' }[gate.kind];
                    if (fx && reduced) p.outline(X(gate.lane) - size, y - size, size * 2, size * 2, 'accent', 3);
                    light(p, X(gate.lane), y + (h - size) * .5, Math.min(w, h) / 2 * 1.05, kind);
                }
            }
            p.c.restore();
            // The glass floor the marble can rest on; shelves rise out of it.
            brushed(p, 20, Y(MARBLE.floor) - thick * .4, 680, thick * 1.3, thick * .4);
            // The marble, resting on its shelf (or falling), with a tilt chevron showing where it rolls.
            const ball = s.ball, bx = X(ball.x), by = Y(ball.y) - thick / 2 - r;
            const blink = s.time < s.graceUntil && !reduced ? .45 + .55 * Math.abs(Math.sin(s.time * 9)) : 1;
            if (!ball.falling && s.tilt) {
                const d = s.tilt, cx = bx + d * (r + (compact ? 30 : 18));
                p.c.save(); p.c.globalAlpha = .9;
                gel(p, cx - (compact ? 20 : 12), by - (compact ? 14 : 9), compact ? 40 : 24, compact ? 28 : 18, 'blue', { radius: compact ? 8 : 5 });
                p.line([[cx - d * 5, by - 6], [cx + d * 4, by], [cx - d * 5, by + 6]], '#ffffff', compact ? 4 : 3);
                p.c.restore();
            }
            if (s.lives > 0) drawMarble(p, bx, by, r, 'blue', blink);
            for (const e of s.effects) {
                if (e.kind === 'crush') poof(p, X(e.x), ceilY + barH + r, r * 2.4, s.time - e.at);
                if (e.kind === 'streak' && s.time - e.at < .7) {
                    const k = (s.time - e.at) / .7; p.c.save(); p.c.globalAlpha = 1 - k;
                    p.circle(bx, by, r * (1.2 + (reduced ? .4 : k * 1.6)), dark ? '#77c7ff' : '#075fbb', false); p.c.restore();
                }
            }
            bursts({ ...s, bursts: s.bursts.map(b => ({ ...b, x: X(b.x), y: Y(b.y) - thick - r * 2 })) }, p, reduced);
        }
    });
}
