import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { SPECTRUM, tone, hue, text, scene, acrylic, reveal, header, shape, withAlpha, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, ripple, loseLife } from './display.js';

// Prisms: a central prism splits white light into three rays (rose, mint, sky) on adjacent spokes.
// L turns it one spoke anticlockwise, R one spoke clockwise. A crystal shatters into light when the ray of
// its own colour points at it. Lighting several with one turn scores n². Clear a set in par turns for a
// PERFECT bonus. From set 4 a dark-glass shard cracks if any ray touches it, which closes part of the
// circle and makes the direction of travel a real choice.
export const PRISMS = { spokes: 8, fan: 3, crystalPoints: 10, setPoints: 20, perfectPoints: 20,
    shardFrom: 3, rest: 1, turnSeconds: .18 };
const SPOKES = PRISMS.spokes;
export const wrap = value => ((value % SPOKES) + SPOKES) % SPOKES;
/** The rotation at which a crystal of `colour` on `spoke` is lit: colour c leaves the prism on spoke r + c. */
export const orientationFor = crystal => wrap(crystal.spoke - crystal.colour);
/** Rotations whose fan touches the shard. */
export const forbidden = shard => shard == null ? [] : [0, 1, 2].map(c => wrap(shard - c));
/** Crystal count grows with cleared sets: 2, then 3, then 4. */
export const crystalCount = sets => sets < 2 ? 2 : sets < 5 ? 3 : 4;

/** Fewest single-spoke turns from `rotation` that visit every needed orientation without touching a forbidden one. */
export function parMoves(rotation, crystals, shard = null) {
    const targets = [...new Set(crystals.map(orientationFor))], blocked = new Set(forbidden(shard));
    const full = (1 << targets.length) - 1, maskAt = r => targets.reduce((m, t, i) => t === r ? m | 1 << i : m, 0);
    const seen = new Map(), queue = [[rotation, maskAt(rotation), 0]];
    seen.set(`${rotation}|${maskAt(rotation)}`, true);
    while (queue.length) {
        const [r, mask, moves] = queue.shift();
        if (mask === full) return moves;
        for (const step of [-1, 1]) {
            const next = wrap(r + step); if (blocked.has(next)) continue;
            const nextMask = mask | maskAt(next), key = `${next}|${nextMask}`;
            if (seen.has(key)) continue; seen.set(key, true); queue.push([next, nextMask, moves + 1]);
        }
    }
    return Infinity;
}

/** A fresh set: crystals on distinct spokes, none lit at the current rotation, all reachable around any shard. */
export function makeSet(random, rotation, sets) {
    for (let attempt = 0; attempt < 200; attempt++) {
        const shard = sets >= PRISMS.shardFrom ? integer(random, 0, SPOKES - 1) : null;
        const blocked = new Set(forbidden(shard));
        if (blocked.has(rotation)) continue;
        const open = [...Array(SPOKES).keys()].filter(r => r !== rotation && !blocked.has(r));
        const crystals = [], used = new Set(shard == null ? [] : [shard]);
        let orientation = open[integer(random, 0, open.length - 1)];
        for (let i = 0; i < crystalCount(sets) && open.length; i++) {
            // Sometimes two crystals share one orientation, so a single turn can light both.
            if (i && random() >= .35) orientation = open[integer(random, 0, open.length - 1)];
            const colours = [0, 1, 2].filter(c => !used.has(wrap(orientation + c)));
            if (!colours.length) continue;
            const colour = colours[integer(random, 0, colours.length - 1)], spoke = wrap(orientation + colour);
            used.add(spoke); crystals.push({ spoke, colour, lit: false });
        }
        if (crystals.length < crystalCount(sets)) continue;
        if (crystals.some(c => blocked.has(orientationFor(c)))) continue;
        const par = parMoves(rotation, crystals, shard);
        if (Number.isFinite(par) && par >= 1) return { crystals, shard, par };
    }
    return { crystals: [{ spoke: wrap(rotation + 3), colour: 0, lit: false }], shard: null, par: 3 };
}

export function prisms(env) {
    const s = { rotation: 0, from: 0, turnedAt: -1, sets: 0, moves: 0, crystals: [], shard: null, par: 0,
        solved: false, nextAt: 0, shardCrackedAt: -10, bursts: [], effects: [], ended: false, lastTurn: '' };
    function deal() {
        Object.assign(s, makeSet(env.random, s.rotation, s.sets));
        s.moves = 0; s.solved = false;
    }
    deal();
    const spokeScreen = (spoke, layout, radius = layout.R) => {
        const a = -Math.PI / 2 + spoke * Math.PI * 2 / SPOKES;
        return [layout.cx + Math.cos(a) * radius, layout.cy + Math.sin(a) * radius];
    };
    const layout = p => p.compact ? { cx: 360, cy: Math.max(430, p.h * .47), R: 270, k: 1.75 } : { cx: 360, cy: 240, R: 138, k: 1 };
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || s.solved || !['left', 'right'].includes(event.action)) return;
            s.rotation = wrap(s.rotation + (event.action === 'left' ? -1 : 1)); s.turnedAt = s.time; s.lastTurn = event.action; s.moves++;
            env.sound?.({ kind: 'turn', action: event.action });
            const rays = [0, 1, 2].map(c => wrap(s.rotation + c));
            if (s.shard != null && rays.includes(s.shard)) {
                addEffect(s, { kind: 'crack', spoke: s.shard }); addBurst(s, 'CRACKED', 'below', 0, false);
                s.shardCrackedAt = s.time; s.shard = null; loseLife(s, env);
                if (s.ended) return;
            }
            const hits = s.crystals.filter(c => !c.lit && orientationFor(c) === s.rotation);
            if (hits.length) {
                const points = PRISMS.crystalPoints * hits.length ** 2;
                for (const crystal of hits) { crystal.lit = true; addEffect(s, { kind: 'lit', spoke: crystal.spoke, colour: crystal.colour }); }
                s.score += points;
                addBurst(s, hits.length > 1 ? `${hits.length === 2 ? 'DOUBLE' : 'TRIPLE'} +${points}` : `+${points}`, hits[0].spoke, 0);
                env.sound?.({ kind: 'clear', count: hits.length * 2, chain: hits.length });
            }
            if (s.crystals.every(c => c.lit)) {
                const perfect = s.moves <= s.par, bonus = PRISMS.setPoints + (perfect ? PRISMS.perfectPoints : 0);
                s.score += bonus; s.sets++; s.solved = true; s.nextAt = s.time + PRISMS.rest;
                addBurst(s, perfect ? `PERFECT +${bonus}` : `SET +${bonus}`, 'centre', 0);
                addEffect(s, { kind: 'set', perfect });
                env.sound?.({ kind: perfect ? 'powerup' : 'clear', count: 4, chain: 2 });
            }
        },
        update(s) {
            pruneBursts(s); pruneEffects(s);
            if (!s.ended && s.solved && s.time >= s.nextAt) deal();
        },
        render(s, p) {
            const L = layout(p), { cx, cy, R, k } = L, reduced = env.reducedMotion;
            scene(p, 'aurora', s.time, reduced);
            const lit = s.crystals.filter(c => c.lit).length;
            header(p, s.solved ? `set ${s.sets} clear` : `set ${s.sets + 1} · ${lit} / ${s.crystals.length} lit`, `par ${s.par} · turns ${s.moves}`);
            // Acrylic dial behind the ring.
            acrylic(p, cx - R - 46 * k, cy - R - 46 * k, (R + 46 * k) * 2, (R + 46 * k) * 2, R + 46 * k);
            const c = p.c;
            for (let spoke = 0; spoke < SPOKES; spoke++) {
                const [x, y] = spokeScreen(spoke, L, R); shape(p, 'circle', x, y, 4 * k, withAlpha(tone('ink'), .35));
            }
            // Rotation eases over .18 s on simulation time (a connected animation); reduced motion snaps.
            const u = reduced ? 1 : Math.min(1, (s.time - s.turnedAt) / PRISMS.turnSeconds), ease = 1 - (1 - u) ** 3;
            const back = s.lastTurn === 'left' ? 1 : s.lastTurn === 'right' ? -1 : 0;
            const shown = s.rotation + back * (1 - ease);
            // White light enters between spokes from the upper left.
            const inA = -Math.PI / 2 - Math.PI * 2 / SPOKES * 1.5, inX = cx + Math.cos(inA) * (R + 120 * k), inY = cy + Math.sin(inA) * (R + 120 * k);
            c.save(); c.globalAlpha = .55; p.line([[inX, inY], [cx, cy]], '#ffffff', 5 * k); c.restore();
            // Rays: glow, core and a shape glyph at the tip, so colour is never the only cue.
            for (let colour = 0; colour < 3; colour++) {
                const a = -Math.PI / 2 + (shown + colour) * Math.PI * 2 / SPOKES, col = hue(colour);
                const x = cx + Math.cos(a) * (R - 6 * k), y = cy + Math.sin(a) * (R - 6 * k);
                c.save(); c.globalAlpha = .28; p.line([[cx, cy], [x, y]], col, 16 * k); c.globalAlpha = 1; p.line([[cx, cy], [x, y]], col, 4 * k); c.restore();
                shape(p, SPECTRUM[colour].shape, cx + Math.cos(a) * R * .62, cy + Math.sin(a) * R * .62, 7 * k, col);
            }
            // Prism: a rounded glass triangle pointing at the middle ray, with a refraction sheen.
            const pa = -Math.PI / 2 + (shown + 1) * Math.PI * 2 / SPOKES, pr = 34 * k;
            c.save(); c.translate(cx, cy); c.rotate(pa + Math.PI / 2);
            c.beginPath(); c.moveTo(0, -pr); c.lineTo(pr * .9, pr * .6); c.lineTo(-pr * .9, pr * .6); c.closePath();
            c.fillStyle = withAlpha('#e8f0ff', .22); c.fill(); c.lineWidth = 2; c.strokeStyle = withAlpha('#ffffff', .85); c.stroke();
            const shimmer = reduced ? .5 : .5 + .5 * Math.sin(s.time * 1.6);
            c.beginPath(); c.moveTo(-pr * .35, pr * .45); c.lineTo(pr * (.05 + shimmer * .3), -pr * .45); c.lineWidth = 3; c.strokeStyle = withAlpha('#ffffff', .45); c.stroke();
            c.restore();
            reveal(p, cx, cy, 70 * k, '#ffffff', .22);
            // Shard: jagged dark glass with a warning outline.
            if (s.shard != null) {
                const [x, y] = spokeScreen(s.shard, L);
                shape(p, 'shard', x, y, 24 * k, '#0b0e1c');
                shape(p, 'shard', x, y, 24 * k, tone('danger'), false, 2.5);
                text(p, '!', x, y + 2, 20 * k, tone('danger'), 'center', 700);
            }
            for (const crack of s.effects.filter(e => e.kind === 'crack')) {
                const [x, y] = spokeScreen(crack.spoke, L); ripple(p, x, y, 22 * k, s.time - crack.at, tone('danger'), reduced, 40 * k);
            }
            // Crystals: acrylic hexagons carrying their ray's shape; the ray of their colour reveals them.
            for (const crystal of s.crystals) {
                const [x, y] = spokeScreen(crystal.spoke, L), col = hue(crystal.colour), r = 25 * k;
                const effect = s.effects.find(e => e.kind === 'lit' && e.spoke === crystal.spoke);
                if (crystal.lit) {
                    if (effect) ripple(p, x, y, r, s.time - effect.at, col, reduced, 40 * k);
                    shape(p, 'hexagon', x, y, r * .7, withAlpha(col, .25)); shape(p, 'hexagon', x, y, r * .7, withAlpha(col, .6), false, 1.5);
                    continue;
                }
                const aimed = wrap(s.rotation + crystal.colour) === crystal.spoke;
                if (aimed) reveal(p, x, y, r * 2.2, col, .55);
                shape(p, 'hexagon', x, y, r, withAlpha('#0e1430', .55));
                shape(p, 'hexagon', x, y, r, col, false, 3);
                shape(p, SPECTRUM[crystal.colour].shape, x, y, r * .42, col);
            }
            const setFx = s.effects.find(e => e.kind === 'set');
            if (setFx) ripple(p, cx, cy, 40 * k, s.time - setFx.at, setFx.perfect ? tone('gold') : tone('accent'), reduced, R);
            // Bursts sit at the crystal that earned them; set bonuses in the centre.
            // Bursts are anchored to a spoke or to the prism; the layout decides where that is on screen.
            bursts(s, p, reduced, b => b.x === 'centre' ? [cx, cy - 72 * k] : b.x === 'below' ? [cx, cy + 74 * k] : spokeScreen(b.x, L, R + 50 * k));
        }
    });
}
