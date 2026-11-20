import { game } from '../../core/game.js';
import { techno, chrome, candy, starburst, flare, backdrop, header, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, shatter, loseLife, gainLife } from './display.js';

// Reactor Balance: plasma orbs drop into a chute one at a time. Raise L to pour the orb into the left
// core, R into the right core. A core that reaches exactly 10 FUSES (score, it empties, +1 vent);
// above 10 it MELTS DOWN (a life, it empties). An orb left past its fuse ring spills (a life). Both
// raises together vent the orb (spends one of up to three vent charges). Two orbs are previewed.
// Stages add content, not speed: from 30 s big 4s and coolant (-3); from 60 s 5s and spark orbs (a
// fusion completed by a spark scores x2). Consecutive fusions build a streak multiplier up to x4.
export const REACTOR = { critical: 10, deadline: 3.6, minDeadline: 1.8, rest: .45, chord: .12, vents: 2, maxVents: 3,
    stages: [0, 30, 60], fillPoints: 5, fusionPoints: 100, maxStreak: 4, restoreEvery: 5, preview: 2 };
export const BAGS = [
    [1, 1, 2, 2, 3, 3].map(value => ({ value })),
    [1, 2, 2, 3, 3, 4, 4, -3].map(value => ({ value })),
    [...[1, 2, 3, 3, 4, 4, 5, -3].map(value => ({ value })), { value: 2, spark: true }, { value: 3, spark: true }]
];
export const deadlineFor = pace => Math.max(REACTOR.minDeadline, REACTOR.deadline / pace);
export const stageAt = time => REACTOR.stages.filter(at => time >= at).length - 1;
/** The rule in one place: what pouring an orb does to a core. */
export function pour(level, value) {
    const next = Math.max(0, level + value);
    return { next: next > REACTOR.critical || next === REACTOR.critical ? 0 : next,
        outcome: next > REACTOR.critical ? 'meltdown' : next === REACTOR.critical ? 'fusion' : 'fill', reached: next };
}
export const fusionPoints = (streak, spark) => REACTOR.fusionPoints * Math.min(REACTOR.maxStreak, streak) * (spark ? 2 : 1);
const SIDES = ['left', 'right'];

export function reactor(env) {
    const s = { cores: [0, 0], orb: null, queue: [], bag: [], nextAt: .8, pending: null, aim: null, vents: REACTOR.vents,
        streak: 0, fusions: 0, stage: 0, bursts: [], effects: [], ended: false };
    function draw() {
        if (!s.bag.length) {
            s.bag = BAGS[s.stage].map(orb => ({ ...orb }));
            for (let i = s.bag.length - 1; i > 0; i--) { const j = Math.floor(env.random() * (i + 1)); [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]]; }
        }
        return s.bag.pop();
    }
    function fill() { while (s.queue.length < REACTOR.preview) s.queue.push(draw()); }
    function deal() { fill(); s.orb = { ...s.queue.shift(), born: s.time, deadline: s.time + deadlineFor(env.pace) }; fill(); }
    function clear() { s.orb = null; s.nextAt = s.time + REACTOR.rest; }
    function route(core) {
        const orb = s.orb, side = SIDES[core], result = pour(s.cores[core], orb.value);
        s.cores[core] = result.next; clear();
        addEffect(s, { kind: 'pour', side, value: orb.value });
        if (result.outcome === 'meltdown') {
            s.streak = 0; addEffect(s, { kind: 'meltdown', side }); addBurst(s, 'MELTDOWN', 0, 0, false, { side });
            loseLife(s, env); return;
        }
        if (result.outcome === 'fusion') {
            s.streak++; s.fusions++; s.vents = Math.min(REACTOR.maxVents, s.vents + 1);
            const points = fusionPoints(s.streak, orb.spark); s.score += points;
            addEffect(s, { kind: 'fusion', side, spark: !!orb.spark });
            addBurst(s, `${orb.spark ? 'SPARK ' : ''}FUSION +${points}`, 0, 0, true, { side });
            env.sound?.({ kind: orb.spark || s.streak > 1 ? 'powerup' : 'clear', count: 3, chain: Math.min(4, s.streak) });
            if (s.fusions % REACTOR.restoreEvery === 0 && gainLife(s, env)) addBurst(s, '+1 LIFE', 0, 0, true, { side: 'chute' });
            return;
        }
        s.score += REACTOR.fillPoints; env.sound?.({ kind: 'turn', action: side });
    }
    function apply() {
        const mask = s.pending.mask; s.pending = null;
        if (!s.orb) return;
        if (mask !== 3) { route(mask === 1 ? 0 : 1); return; }
        if (!s.vents) { addBurst(s, 'NO VENT', 0, 0, false, { side: 'vent' }); addEffect(s, { kind: 'refused' }); return; }
        s.vents--; clear(); addEffect(s, { kind: 'vent' }); addBurst(s, 'VENTED', 0, 0, true, { side: 'vent' });
        env.sound?.({ kind: 'rescue' });
    }
    fill();
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !s.orb) return;
            const mask = event.action === 'left' ? 1 : event.action === 'right' ? 2 : 0; if (!mask) return;
            if (s.pending && s.time >= s.pending.until) apply();
            if (!s.orb) return;
            if (!s.pending) s.pending = { mask: 0, until: s.time + REACTOR.chord };
            s.pending.mask |= mask;
            // Immediate pipe feedback while a slightly later second wrist may still turn this into a vent.
            s.aim = { side: s.pending.mask === 3 ? 'vent' : event.action, at: s.time };
            if (s.pending.mask === 3) apply();
        },
        pause(s) { s.pending = null; },
        update(s) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) {
                s.stage = stage; s.bag = [];
                addBurst(s, stage === 1 ? 'COOLANT + BIG ORBS' : 'SPARK ORBS ×2', 0, 0, true, { side: 'chute' });
                env.sound?.({ kind: 'powerup' });
            }
            // A raise recognised just before the fuse runs out is used, not lost to the chord window.
            if (s.pending && (s.time >= s.pending.until || (s.orb && s.time >= s.orb.deadline))) apply();
            if (s.orb && s.time >= s.orb.deadline) {
                clear(); s.streak = 0; addEffect(s, { kind: 'spill' }); addBurst(s, 'SPILL', 0, 0, false, { side: 'chute' });
                loseLife(s, env); return;
            }
            if (!s.orb && s.time >= s.nextAt) deal();
        },
        render(s, p) {
            backdrop(p);
            const compact = p.compact, k = compact ? 1.6 : 1, reduced = env.reducedMotion, c = p.c;
            header(p, `${s.fusions} fusion${s.fusions === 1 ? '' : 's'}`, s.streak ? `streak ×${Math.min(REACTOR.maxStreak, s.streak)}` : '');
            const coreX = [compact ? 150 : 165, compact ? 570 : 555], coreW = compact ? 190 : 118;
            const chuteX = 360, orbR = 30 * k, chuteY = compact ? 150 : 92;
            const coreTop = chuteY + orbR + (compact ? 50 : 34), coreBottom = p.h - (compact ? 120 : 52), inner = coreBottom - coreTop - 24;
            const colorOf = side => side === 'left' ? 'accent' : 'gold';
            const levelY = level => coreBottom - 12 - inner * Math.min(1.12, level / REACTOR.critical);
            const aimed = s.aim && s.time - s.aim.at < .35 ? s.aim.side : null;
            // Chrome pipes from the chute to each core; the chosen pipe lights in that core's colour.
            for (const [i, side] of SIDES.entries()) {
                const from = [chuteX + (i ? 1 : -1) * orbR * .9, chuteY], to = [coreX[i], coreTop - 4];
                const lit = aimed === side || s.effects.some(e => e.kind === 'pour' && e.side === side && s.time - e.at < .3);
                p.line([from, [to[0], from[1]], to], 'ink', 15 * k); p.line([from, [to[0], from[1]], to], chrome(p, 0, from[1] - 6 * k, 0, from[1] + 6 * k), 10 * k);
                if (lit) p.line([from, [to[0], from[1]], to], colorOf(side), 6 * k);
            }
            // Cores: translucent candy capsules with a chrome rim, ten ticks and the fusion line at 10.
            for (const [i, side] of SIDES.entries()) {
                const x = coreX[i], left = x - coreW / 2, level = s.cores[i], color = colorOf(side);
                const fusion = s.effects.find(e => e.kind === 'fusion' && e.side === side), melt = s.effects.find(e => e.kind === 'meltdown' && e.side === side);
                p.rect(left - 5, coreTop - 5, coreW + 10, coreBottom - coreTop + 10, chrome(p, left - 5, 0, left + coreW + 5, 0), coreW / 2);
                p.rect(left, coreTop, coreW, coreBottom - coreTop, 'bg', coreW / 2 - 4);
                c.save(); c.globalAlpha = .18; p.rect(left, coreTop, coreW, coreBottom - coreTop, color, coreW / 2 - 4); c.restore();
                // Liquid: level fill with three lava-lamp blobs (still frames under reduced motion).
                const surface = levelY(level);
                if (level > 0) {
                    c.save(); c.globalAlpha = .75; p.rect(left + 8, surface, coreW - 16, coreBottom - 12 - surface, color, Math.min(14 * k, (coreBottom - 12 - surface) / 2)); c.restore();
                    for (let b = 0; b < 3; b++) {
                        const phase = reduced ? b : s.time * (.6 + b * .17) + b * 2.1, span = Math.max(0, coreBottom - 30 - surface);
                        const by = coreBottom - 26 - span * (.5 + .5 * Math.sin(phase)), bx = x + Math.sin(phase * 1.3 + b) * coreW * .18;
                        if (span > 24 * k) candy(p, bx, by, Math.min(coreW * .12, 6 + span * .06, span / 3), color, .5);
                    }
                }
                for (let t = 1; t < REACTOR.critical; t++) p.line([[left + coreW - 18, levelY(t)], [left + coreW - 8, levelY(t)]], 'muted', 1.5);
                const critical = levelY(REACTOR.critical);
                p.line([[left + 6, critical], [left + coreW - 6, critical]], 'ink', 3, [8, 5]);
                starburst(p, left + coreW + 2, critical, 12 * k, 'gold', 8, 0, .5);
                // Prediction for the current orb, drawn where it would land: exact 10 sparkles, above 10 warns.
                if (s.orb) {
                    const result = pour(level, s.orb.value), y = levelY(result.reached);
                    if (result.outcome === 'fusion') starburst(p, x, y, 22 * k, 'accent', 8, reduced ? 0 : s.time, .45);
                    else if (result.outcome === 'meltdown') { techno(p, '!', x, levelY(REACTOR.critical) - 18 * k, 28 * k, 'gold', 'center', 900); p.line([[left + 10, y], [left + coreW - 10, y]], 'gold', 3, [4, 4]); }
                    else p.line([[left + 10, y], [left + coreW - 10, y]], color, 3, [4, 4]);
                }
                techno(p, level, x, coreBottom - inner * .3, 40 * k, 'ink', 'center', 900);
                techno(p, `need ${REACTOR.critical - level}`, x, coreBottom + (compact ? 34 : 22), 14 * k, 'muted', 'center', 800);
                if (fusion) { shatter(p, x, critical, s.time - fusion.at, fusion.spark ? 'gold' : 'accent', reduced, 1.6 * k); if (!reduced) flare(p, x, critical, 34 * k, Math.max(0, 1 - (s.time - fusion.at) * 1.6), color); }
                if (melt) shatter(p, x, (coreTop + coreBottom) / 2, s.time - melt.at, 'gold', reduced, 1.4 * k);
            }
            // The chute: a chrome collar holding the current plasma orb inside its fuse ring.
            p.circle(chuteX, chuteY, orbR + 14 * k, chrome(p, 0, chuteY - orbR - 14 * k, 0, chuteY + orbR + 14 * k));
            p.circle(chuteX, chuteY, orbR + 8 * k, 'bg');
            if (s.orb) {
                const left = Math.max(0, (s.orb.deadline - s.time) / (s.orb.deadline - s.orb.born));
                c.save(); c.beginPath(); c.arc(chuteX, chuteY, orbR + 8 * k, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
                c.strokeStyle = p.color(s.orb.deadline - s.time < 1 ? 'gold' : 'ink'); c.lineWidth = 6 * k; c.lineCap = 'round'; c.stroke(); c.restore();
                orbArt(p, chuteX, chuteY, orbR, s.orb, reduced ? 0 : s.time, k);
            }
            const spill = s.effects.find(e => e.kind === 'spill'); if (spill) shatter(p, chuteX, chuteY, s.time - spill.at, 'gold', reduced, 1.4 * k);
            // Preview: the next two orbs queue above the chute, smaller.
            s.queue.forEach((orb, i) => orbArt(p, chuteX + (compact ? 110 : 76) + i * (compact ? 70 : 46), chuteY - 36 * k, 14 * k, orb, 0, k * .5));
            // Vent charges, the one chord in this game; the L+R label is the only hint buttons cannot give.
            const ventY = coreBottom - 14 * k, refused = s.effects.find(e => e.kind === 'refused' && s.time - e.at < .4);
            for (let v = 0; v < REACTOR.maxVents; v++) {
                const vx = 360 + (v - 1) * 30 * k, lit = v < s.vents;
                p.circle(vx, ventY, 11 * k, lit ? chrome(p, 0, ventY - 11 * k, 0, ventY + 11 * k) : 'border');
                if (lit) for (let blade = 0; blade < 3; blade++) { const a = blade * 2.1 + (reduced || aimed !== 'vent' ? 0 : s.time * 9); p.line([[vx, ventY], [vx + Math.cos(a) * 8 * k, ventY + Math.sin(a) * 8 * k]], 'ink', 2.5); }
                if (refused) p.circle(vx, ventY, 14 * k, 'gold', false);
            }
            techno(p, 'L+R VENT', 360, ventY - 24 * k, 11 * k, 'muted', 'center', 800);
            bursts(s, p, reduced, b => ({ ...b, x: b.side === 'left' ? coreX[0] : b.side === 'right' ? coreX[1] : 360,
                y: b.side === 'vent' ? ventY - 46 * k : b.side === 'chute' ? chuteY + orbR + 34 * k : coreTop - 26 * k }));
        }
    });
}

/** A plasma orb: candy plasma with its value; coolant is a pale ring with a snowflake cross, spark wears a starburst. */
export function orbArt(p, x, y, r, orb, time, k) {
    if (orb.spark) starburst(p, x, y, r * 1.35, 'gold', 10, time * .8, .7);
    if (orb.value < 0) {
        p.circle(x, y, r, chrome(p, 0, y - r, 0, y + r)); p.circle(x, y, r * .78, 'soft');
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; p.line([[x - Math.cos(a) * r * .55, y - Math.sin(a) * r * .55], [x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55]], 'accent', Math.max(2, r * .08)); }
        techno(p, orb.value, x, y + 1, r * .78, 'ink', 'center', 900);
        return;
    }
    candy(p, x, y, r, 'accent', 1);
    techno(p, orb.value, x, y + 2, r * 1.05, 'bg', 'center', 900);
}
