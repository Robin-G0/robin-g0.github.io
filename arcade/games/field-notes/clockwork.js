import { game } from '../../core/game.js';
import { header, page, write, ink, pencil, blot, tag, addBurst, bursts, pruneBursts, addEffect, pruneEffects, loseLife } from './display.js';

// Clockwork: a regulator pendulum swings by itself. Each swing carries the bob into the left or the
// right pallet band; raising that wrist while the bob is in the band strikes the pallet and gives the
// swing an impulse. Struck at the turning point (the jewel) the impulse is twice as strong and scores
// double. Unstruck swings lose amplitude; when the bob can no longer reach a pallet the clock stops.
// Angles are degrees from vertical, positive to screen-right. The swing is A cos(phi), phi = pi t / half.
export const CLOCK = { half: 1.25, start: 34, max: 42, reach: 24, jewel: 4.5, grace: .18, decay: 1.9, maxDecay: 4.6,
    gain: 3.2, jewelGain: 6.5, ease: 18, hold: 1.2, recovery: 1.4, hour: 12, points: 10, jewelPoints: 20, chime: 60,
    gold: 50, goldAt: 12, gritAt: 36, goldChance: .3, gritChance: .22, jam: 5 };
export const SIDES = ['left', 'right'];
/** Amplitude lost per second at a pace: decay per half swing, capped so jewel strikes always keep the clock alive. */
export const decayRate = pace => Math.min(CLOCK.maxDecay, CLOCK.decay * pace) / CLOCK.half;
export const swing = s => s.amp * Math.cos(s.phi);
export const inBand = (theta, side) => side === 'right' ? theta >= CLOCK.reach : theta <= -CLOCK.reach;
/** In the band and within `jewel` degrees of this swing's turning point. */
export const atJewel = (theta, amp) => Math.abs(theta) >= Math.max(CLOCK.reach, amp - CLOCK.jewel);
const visit = (open = false, struck = false) => ({ open, struck, closedAt: -10, pendingMiss: false, mark: 'plain' });

export function clockwork(env) {
    const s = { phi: 0, amp: CLOCK.start, target: CLOCK.start, heldUntil: CLOCK.hold, visits: { left: visit(), right: visit(true, true) },
        ticks: 0, streak: 0, best: 0, chimes: 0, rewound: false, lastMark: 'plain', lastInput: null, bursts: [], effects: [], ended: false };
    /** The next visit's mark is chosen as the previous visit to that side closes: about one full swing of warning. */
    function chooseMark() {
        if (s.ticks < CLOCK.goldAt) return 'plain';
        const r = env.random(), grit = s.ticks >= CLOCK.gritAt && s.lastMark !== 'grit' && r < CLOCK.gritChance;
        const mark = grit ? 'grit' : r < CLOCK.gritChance + CLOCK.goldChance ? 'gold' : 'plain';
        s.lastMark = mark; return mark;
    }
    function rewind() {
        s.phi = 0; s.amp = s.target = CLOCK.start; s.heldUntil = s.time + CLOCK.recovery;
        s.visits = { left: visit(), right: visit(true, true) }; s.streak = 0; s.rewound = true;
    }
    function stop() {
        addBurst(s, 'STOPPED', 360, 0, false); addEffect(s, { kind: 'stop' }); loseLife(s, env);
        if (!s.ended) rewind();
    }
    function strike(side, late) {
        const v = s.visits[side], theta = swing(s);
        v.struck = true; v.pendingMiss = false;
        if (v.mark === 'grit') {
            s.target = Math.max(0, s.target - CLOCK.jam); s.streak = 0;
            addBurst(s, 'GRIT', side === 'left' ? 200 : 520, 1, false); addEffect(s, { kind: 'grit', side });
            env.sound?.({ kind: 'brake' }); return;
        }
        const jewel = !late && atJewel(theta, s.amp);
        s.target = Math.min(CLOCK.max, s.target + (jewel ? CLOCK.jewelGain : CLOCK.gain));
        let points = jewel ? CLOCK.jewelPoints : CLOCK.points;
        if (v.mark === 'gold' && jewel) points += CLOCK.gold;
        s.ticks++; s.streak++; s.best = Math.max(s.best, s.streak); s.score += points;
        addBurst(s, `+${points}`, side === 'left' ? 200 : 520, 1);
        addEffect(s, { kind: 'strike', side, jewel, gold: v.mark === 'gold' && jewel });
        if (s.ticks === CLOCK.goldAt) addBurst(s, 'gold jewels from now', 360, 2);
        if (s.ticks === CLOCK.gritAt) addBurst(s, 'mind the grit', 360, 2);
        if (s.streak % CLOCK.hour === 0) {
            s.chimes++; s.score += CLOCK.chime; s.lives = Math.min(3, s.lives + 1);
            addBurst(s, `CHIME +${CLOCK.chime}`, 360, 3); addEffect(s, { kind: 'chime' });
            env.sound?.({ kind: 'powerup' });
        } else env.sound?.(jewel ? { kind: 'bounce', perfect: true } : { kind: 'turn', action: side });
    }
    function miss(side) { s.streak = 0; addEffect(s, { kind: 'slip', side }); }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !SIDES.includes(event.action)) return;
            const side = event.action, v = s.visits[side];
            if (s.time < s.heldUntil) { s.lastInput = { side, at: s.time }; return; }
            if (v.open && !v.struck) strike(side, false);
            else if (!v.open && v.pendingMiss && s.time - v.closedAt <= CLOCK.grace) strike(side, true);
            else s.lastInput = { side, at: s.time }; // Early, late or repeated: harmless, shown as a faint pencil tick.
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s);
            if (s.ended || s.time < s.heldUntil) return;
            s.phi += Math.PI / CLOCK.half * dt;
            s.target = Math.max(0, s.target - decayRate(env.pace) * dt);
            s.amp += Math.max(-CLOCK.ease * dt, Math.min(CLOCK.ease * dt, s.target - s.amp));
            const theta = swing(s);
            for (const side of SIDES) {
                const v = s.visits[side], inside = inBand(theta, side);
                if (inside && !v.open) Object.assign(v, { open: true, struck: false, pendingMiss: false });
                else if (!inside && v.open) {
                    v.open = false; v.closedAt = s.time; v.pendingMiss = !v.struck && v.mark !== 'grit'; v.mark = chooseMark();
                }
                if (v.pendingMiss && s.time - v.closedAt > CLOCK.grace) { v.pendingMiss = false; miss(side); }
            }
            if (s.amp < CLOCK.reach - .25) stop();
        },
        render(s, p) {
            const compact = p.compact, k = compact ? 1.45 : 1, reduced = env.reducedMotion;
            page(p);
            const detail = s.ticks < CLOCK.goldAt ? `gold jewels after ${CLOCK.goldAt} ticks` : s.ticks < CLOCK.gritAt ? `grit after ${CLOCK.gritAt} ticks` : `best run ${s.best}`;
            header(p, `${s.chimes} chime${s.chimes === 1 ? '' : 's'}`, detail);
            const R = 40 * k, px = 360, py = compact ? 90 + R + 20 : 92, band = 30 * k, L = compact ? Math.max(150, Math.min(330, p.h - py - 130 - band)) : 238;
            const at = (deg, r) => [px + Math.sin(deg * Math.PI / 180) * r, py + Math.cos(deg * Math.PI / 180) * r];
            const arc = (from, to, r) => { const out = []; for (let d = from; d <= to + .01; d += 1) out.push(at(d, r)); return out; };
            // The swing scale: pencil path with a tick every 5 degrees.
            pencil(p, arc(-48, 48, L), 1.5, [3, 6], .7);
            for (let d = -45; d <= 45; d += 5) pencil(p, [at(d, L - 6 * k), at(d, L + 6 * k)], d % 15 ? 1 : 2, [], .6);
            // Pallet bands: brass, with L / R tags; the jewel sits at this swing's turning point.
            const held = s.time < s.heldUntil, theta = held ? 0 : swing(s);
            for (const side of SIDES) {
                const sign = side === 'left' ? -1 : 1, v = s.visits[side];
                const lo = CLOCK.reach, hi = 48, flash = s.effects.find(e => e.kind === 'strike' && e.side === side && s.time - e.at < .45);
                const pts = arc(lo, hi, L + band).map(([x, y]) => [px + (x - px) * sign, y]);
                ink(p, pts, v.mark === 'grit' ? 'muted' : 'gold', (v.open && !v.struck ? 13 : 9) * k);
                if (flash && !reduced) { const c = p.c; c.save(); c.globalAlpha = 1 - (s.time - flash.at) / .45; ink(p, pts, flash.jewel ? 'gold' : 'accent', 20 * k); c.restore(); }
                else if (flash) pencil(p, pts, 4, [], 1, 'accent');
                if (v.mark === 'grit') for (let d = lo + 3; d < hi; d += 5) { const [x, y] = at(d * sign, L + band); write(p, '×', x, y, 18 * k, 'ink', 'center', { serifFace: true }); }
                const jewelDeg = Math.max(lo + 1, s.amp - CLOCK.jewel / 2), [jx, jy] = at(jewelDeg * sign, L + band);
                const dia = (v.mark === 'gold' ? 11 : 7) * k;
                p.c.save(); p.c.beginPath(); p.c.moveTo(jx, jy - dia); p.c.lineTo(jx + dia, jy); p.c.lineTo(jx, jy + dia); p.c.lineTo(jx - dia, jy); p.c.closePath();
                p.c.fillStyle = p.color(v.mark === 'gold' ? 'gold' : 'accent'); p.c.fill(); p.c.strokeStyle = p.color('ink'); p.c.lineWidth = 1.5; p.c.stroke(); p.c.restore();
                if (v.mark === 'gold') write(p, '+50', jx + sign * 34 * k, jy - 22 * k, 22 * k, 'gold', 'center', { weight: 700 });
                const [tx, ty] = at(sign * 52, L + band + 14 * k);
                tag(p, side === 'left' ? 'L' : 'R', tx, ty, 16 * k, 'accent');
                const slip = s.effects.find(e => e.kind === 'slip' && e.side === side && s.time - e.at < .9);
                if (slip) { const [mx, my] = at(sign * 34, L + band); write(p, '✗', mx, my - 26 * k, 34 * k, 'gold', 'center', { alpha: 1 - (s.time - slip.at) / .9 }); }
                const grit = s.effects.find(e => e.kind === 'grit' && e.side === side && s.time - e.at < 1.2);
                if (grit) { const [mx, my] = at(sign * 32, L + band); blot(p, mx, my, 14 * k, 'ink', .7); }
                if (s.lastInput?.side === side && s.time - s.lastInput.at < .35) { const [mx, my] = at(sign * 20, L + band); pencil(p, [[mx - 6, my - 6], [mx + 6, my + 6]], 2, [], .7); }
            }
            // Reach of the current swing: two small pencil ticks.
            for (const sign of [-1, 1]) { const [x, y] = at(sign * s.amp, L + 14 * k), [x2, y2] = at(sign * s.amp, L - 14 * k); pencil(p, [[x, y], [x2, y2]], 2.5, [], .9, 'ink'); }
            // Escape wheel and anchor rocking with the pendulum, behind the dial.
            const wheelAngle = s.ticks * Math.PI / 15, wx = px, wy = py;
            const c = p.c; c.save(); c.translate(wx, wy); c.rotate(wheelAngle);
            p.circle(0, 0, 47 * k, 'gold', false);
            for (let i = 0; i < 15; i++) { const a = i * Math.PI * 2 / 15; p.line([[Math.cos(a) * 47 * k, Math.sin(a) * 47 * k], [Math.cos(a + .12) * 54 * k, Math.sin(a + .12) * 54 * k], [Math.cos(a + .3) * 47 * k, Math.sin(a + .3) * 47 * k]], 'gold', 2.5 * k); }
            c.restore();
            // Rod and bob. During a rewind the bob is drawn back to the right pallet.
            let shown = theta;
            if (held) shown = s.rewound ? CLOCK.start * Math.min(1, 1 - (s.heldUntil - s.time) / CLOCK.recovery) : CLOCK.start;
            const [bx, by] = at(shown, L);
            ink(p, [[px, py], [bx, by]], 'ink', 3 * k);
            const stopped = s.effects.find(e => e.kind === 'stop' && s.time - e.at < 1);
            p.circle(bx, by, 24 * k, 'gold'); p.circle(bx, by, 24 * k, 'ink', false); p.circle(bx - 7 * k, by - 7 * k, 6 * k, 'bg');
            const hit = s.effects.findLast(e => e.kind === 'strike' && s.time - e.at < .5);
            if (hit) {
                const age = s.time - hit.at;
                if (reduced) p.circle(bx, by, 32 * k, hit.jewel ? 'gold' : 'accent', false);
                else { c.save(); c.globalAlpha = 1 - age / .5; p.circle(bx, by, (28 + age * 70) * k, hit.jewel ? 'gold' : 'accent', false); c.restore(); }
            }
            if (stopped) write(p, 'the clock stopped', 360, by + 50 * k, 26 * k, 'gold', 'center');
            // The dial: Roman hours, hour hand on chimes, minute hand on the run toward the next chime.
            p.circle(px, py, R, 'bg'); p.circle(px, py, R, 'ink', false); p.circle(px, py, R - 5 * k, 'border', false);
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; p.line([[px + Math.sin(a) * (R - 5 * k), py - Math.cos(a) * (R - 5 * k)], [px + Math.sin(a) * (R - 11 * k), py - Math.cos(a) * (R - 11 * k)]], 'ink', i % 3 ? 1 : 2.5); }
            const minute = (s.streak % CLOCK.hour) / CLOCK.hour * Math.PI * 2, hour = (s.chimes % 12) / 12 * Math.PI * 2;
            ink(p, [[px, py], [px + Math.sin(minute) * (R - 10 * k), py - Math.cos(minute) * (R - 10 * k)]], 'accent', 3 * k);
            ink(p, [[px, py], [px + Math.sin(hour) * (R - 20 * k), py - Math.cos(hour) * (R - 20 * k)]], 'ink', 4 * k);
            p.circle(px, py, 4 * k, 'gold');
            const chime = s.effects.find(e => e.kind === 'chime' && s.time - e.at < 1.2);
            if (chime) for (let i = 0; i < 3; i++) { const age = s.time - chime.at, r = R + (10 + i * 10 + (reduced ? 0 : age * 25)) * k; c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.2); p.c.beginPath(); p.c.arc(px, py, r, -2.4, -.7); p.c.strokeStyle = p.color('gold'); p.c.lineWidth = 2; p.c.stroke(); c.restore(); }
            // Tally of the run toward the next chime: pencil strokes in fives.
            const tallyX = compact ? 110 : 72, tallyY = compact ? p.h - 70 : 392, unit = compact ? 18 : 10;
            write(p, 'to the chime', tallyX, tallyY - (compact ? 44 : 26), compact ? 30 : 18, 'muted', 'left', { serifFace: true, italic: true });
            for (let i = 0; i < CLOCK.hour; i++) {
                const group = Math.floor(i / 5), j = i % 5, x = tallyX + group * unit * 6 + j * unit, done = i < s.streak % CLOCK.hour;
                if (j === 4) pencil(p, [[tallyX + group * unit * 6 - unit * .4, tallyY + unit * .9], [x + unit * .3, tallyY - unit * .9]], 2, [], done ? .95 : .25, done ? 'ink' : 'muted');
                else pencil(p, [[x, tallyY - unit], [x, tallyY + unit]], 2, [], done ? .95 : .25, done ? 'ink' : 'muted');
            }
            bursts(s, p, reduced, b => b.y === 1 ? [b.x, py + (compact ? 120 : 64)] : b.y === 2 ? [360, py + L * .55] : b.y === 3 ? [360, py + R + (compact ? 60 : 36)] : [360, py + L * .78]);
        }
    });
}
