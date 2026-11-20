import { game } from '../../core/game.js?v=eras-3';
import { decodeGesture } from '../../core/commands.js?v=eras-3';
import { mono, header, rain, constructFloor, cursor, addBurst, bursts, pruneBursts, addEffect, pruneEffects, ripple, cells, loseLife } from './display.js?v=eras-3';

// Construct Parry: an Agent throws strikes at the player's left and right side. Each anatomical wrist
// guards its own side and answers the arrow the strike carries: up blocks, a left or right sweep
// knocks it aside. Mechanics arrive in stages on simulation time: jabs, outward sweeps, inward sweeps,
// heavy strikes (both wrists up) and flurries (two strikes, one move). Earned bullet time slows the world.
export const PARRY = {
    stages: [0, 20, 40, 60, 85], telegraph: .7, travel: 2.6, minTravel: 1.8, interval: 2.3, minInterval: 1.3,
    band: .55, perfect: .92, grace: .25, heavyBand: .45, heavyTravel: 1.4, guardWindow: 1.2, heavyGap: 1.2,
    flurryGap: .45, recovery: 1, focusEvery: 6, focusSeconds: 4, focusFactor: .5, perfectPoints: 50, maxStrikes: 8
};
export const STAGE_NAMES = ['jabs', 'outward sweeps', 'inward sweeps', 'heavy strikes', 'flurries'];
export const stageAt = time => PARRY.stages.filter(at => time >= at).length - 1;
export const travelSeconds = pace => Math.max(PARRY.minTravel, PARRY.travel / pace);
export const spawnInterval = pace => Math.max(PARRY.minInterval, PARRY.interval / pace);
export const outward = side => side;                       // L sweeps out to screen-left, R to screen-right.
export const inward = side => (side === 'left' ? 'right' : 'left');
export const bandStart = strike => (strike.side === 'center' ? PARRY.heavyBand : PARRY.band);
/** Points for a block at progress p: 10 at the zone edge rising to 30, 50 for a parry at contact; heavy doubles. */
export function blockPoints(strike, progress) {
    const perfect = progress >= PARRY.perfect, band = bandStart(strike);
    const base = perfect ? PARRY.perfectPoints : 10 + Math.round(Math.max(0, (progress - band) / (PARRY.perfect - band)) * 4) * 5;
    return { points: base * (strike.side === 'center' ? 2 : 1), perfect };
}
/** Answers a stage may ask for, before the side is chosen. */
export function movesFor(stage) {
    return stage >= 2 ? ['up', 'out', 'in'] : stage >= 1 ? ['up', 'out'] : ['up'];
}

export function parry(env) {
    const s = { strikes: [], world: 0, nextSpawn: 1.2, streak: 0, longest: 0, blocks: 0, focusUntil: -1, stage: 0,
        guards: { left: -10, right: -10 }, moves: { left: null, right: null }, recoveryUntil: 0, serial: 0,
        bursts: [], effects: [], ended: false };
    const slow = () => (s.time < s.focusUntil ? PARRY.focusFactor : 1);
    function spawn() {
        const travel = travelSeconds(env.pace), release = s.world + PARRY.telegraph;
        if (s.stage >= 3 && env.random() < .18) {
            s.strikes.push({ id: ++s.serial, side: 'center', move: 'up', release, travel: travel * PARRY.heavyTravel, p: 0, contactAt: null });
            return spawnInterval(env.pace) + PARRY.heavyGap;
        }
        const side = env.random() < .5 ? 'left' : 'right', options = movesFor(s.stage);
        const kind = options[Math.floor(env.random() * options.length)];
        const move = kind === 'up' ? 'up' : kind === 'out' ? outward(side) : inward(side);
        s.strikes.push({ id: ++s.serial, side, move, release, travel, p: 0, contactAt: null });
        if (s.stage >= 4 && env.random() < .25) {
            s.strikes.push({ id: ++s.serial, side, move, release: release + PARRY.flurryGap, travel, p: 0, contactAt: null, flurry: true });
            return spawnInterval(env.pace) + PARRY.flurryGap;
        }
        return spawnInterval(env.pace);
    }
    function block(strike) {
        const { points, perfect } = blockPoints(strike, strike.p);
        strike.done = true; s.score += points; s.blocks++; s.streak++; s.longest = Math.max(s.longest, s.streak);
        addEffect(s, { kind: 'block', side: strike.side, move: strike.move, p: Math.min(1, strike.p), perfect });
        return { points, perfect, heavy: strike.side === 'center' };
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            const gesture = decodeGesture(event.action);
            if (s.ended || !gesture || !['up', 'left', 'right'].includes(gesture.direction)) return;
            const { wrist, direction } = gesture, other = wrist === 'left' ? 'right' : 'left';
            s.moves[wrist] = { direction, at: s.time };
            if (direction === 'up') s.guards[wrist] = s.time;
            const results = [];
            for (const strike of s.strikes) {
                if (strike.done || s.world < strike.release || strike.p < bandStart(strike)) continue;
                if (strike.side === wrist && strike.move === direction) results.push(block(strike));
                else if (strike.side === 'center' && direction === 'up' && s.time - s.guards[other] <= PARRY.guardWindow) results.push(block(strike));
            }
            if (!results.length) return; // Empty or mismatched moves are harmless; the strike can still be answered.
            s.strikes = s.strikes.filter(strike => !strike.done);
            const total = results.reduce((sum, r) => sum + r.points, 0), perfect = results.some(r => r.perfect), heavy = results.some(r => r.heavy);
            const label = heavy ? `HEAVY +${total}` : results.length > 1 ? `FLURRY x${results.length} +${total}` : perfect ? `PARRY +${total}` : `+${total}`;
            addBurst(s, label, heavy ? 360 : wrist === 'left' ? 220 : 500, s.burstY ?? 250);
            env.sound?.(perfect ? { kind: 'bounce', perfect: true } : heavy || results.length > 1 ? { kind: 'clear', count: 3 } : { kind: 'turn', action: wrist });
            if (s.streak % PARRY.focusEvery === 0 && s.time >= s.focusUntil) {
                s.focusUntil = s.time + PARRY.focusSeconds; addBurst(s, 'BULLET TIME', 360, s.bannerY ?? 170);
                env.sound?.({ kind: 'powerup' });
            }
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) { s.stage = stage; addBurst(s, `NEW: ${STAGE_NAMES[stage].toUpperCase()}`, 360, s.bannerY ?? 170); env.sound?.({ kind: 'powerup' }); }
            const factor = slow(); s.world += dt * factor;
            if (s.time < s.recoveryUntil) return;
            if (s.world >= s.nextSpawn && s.strikes.length < PARRY.maxStrikes) s.nextSpawn = s.world + spawn();
            for (const strike of s.strikes) {
                if (s.world < strike.release) continue;
                strike.p = Math.min(1, strike.p + dt * factor / strike.travel);
                if (strike.p >= 1 && strike.contactAt == null) strike.contactAt = s.time;
                // A short real-time grace after contact, never scaled down by pace.
                if (strike.contactAt != null && s.time - strike.contactAt > PARRY.grace) {
                    s.streak = 0; addEffect(s, { kind: 'hit', side: strike.side });
                    addBurst(s, 'HIT', strike.side === 'left' ? 220 : strike.side === 'right' ? 500 : 360, s.burstY ?? 250, false);
                    loseLife(s, env);
                    // One recovery for simultaneous threats: a single hit never drains several lives.
                    s.strikes = []; s.recoveryUntil = s.time + PARRY.recovery; s.nextSpawn = s.world + PARRY.recovery + .6; s.focusUntil = -1;
                    return;
                }
            }
        },
        render(s, p) {
            const compact = p.compact, h = p.h, k = compact ? 1.45 : 1, reduced = env.reducedMotion, c = p.c;
            const focus = s.time < s.focusUntil;
            header(p, `streak ${s.streak}`, focus ? `bullet time ${Math.ceil(s.focusUntil - s.time)}s` : `best ${s.longest}`, s.time, reduced);
            const agentY = h * .25, horizon = agentY + 76 * k, handY = h * .78;
            s.burstY = handY - 92 * k; s.bannerY = horizon + 30 * k;
            rain(p, s.world, { x0: 0, x1: 150, top: 60, bottom: h, columns: 5, alpha: .2, size: 16 * k, reduced });
            rain(p, s.world + 7, { x0: 570, x1: 720, top: 60, bottom: h, columns: 5, alpha: .2, size: 16 * k, reduced });
            constructFloor(p, horizon, h);
            cells(p, 24, compact ? 72 : 52, PARRY.focusEvery, focus ? PARRY.focusEvery : s.streak % PARRY.focusEvery, compact ? 16 : 10, compact ? 6 : 4, focus ? 'gold' : 'accent');
            const hands = { left: [250, handY], right: [470, handY], center: [360, handY + 10 * k] };
            const origins = { left: [322, agentY + 56 * k], right: [398, agentY + 56 * k], center: [360, agentY + 70 * k] };
            const at = (side, t) => { const [x0, y0] = origins[side], [x1, y1] = hands[side]; return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
            // Paths: a dotted approach, then a solid guard zone near the hand where answers count.
            const active = new Set(s.strikes.map(strike => strike.side));
            for (const side of ['left', 'right', 'center']) {
                if (side === 'center' && s.stage < 3) continue;
                const band = side === 'center' ? PARRY.heavyBand : PARRY.band, on = active.has(side);
                p.line([at(side, 0), at(side, band)], on ? 'muted' : 'border', 2, [3, 7]);
                p.line([at(side, band), at(side, 1)], on ? (side === 'center' ? 'gold' : 'accent') : 'border', (on ? 9 : 5) * k);
            }
            // The Agent: suit, tie and dark glasses; an arm lights while it telegraphs a strike on that side.
            const ax = 360;
            c.beginPath(); c.moveTo(ax - 50 * k, agentY + 92 * k); c.lineTo(ax - 36 * k, agentY + 28 * k); c.lineTo(ax + 36 * k, agentY + 28 * k); c.lineTo(ax + 50 * k, agentY + 92 * k); c.closePath();
            c.fillStyle = p.color('soft'); c.fill(); c.strokeStyle = p.color('ink'); c.lineWidth = 2; c.stroke();
            p.line([[ax - 12 * k, agentY + 28 * k], [ax, agentY + 46 * k], [ax + 12 * k, agentY + 28 * k]], 'ink', 2);
            p.line([[ax, agentY + 46 * k], [ax, agentY + 76 * k]], 'ink', 4);
            for (const side of ['left', 'right']) {
                const lit = s.strikes.some(strike => strike.side === side && s.world < strike.release), dir = side === 'left' ? -1 : 1;
                p.line([[ax + dir * 36 * k, agentY + 32 * k], [ax + dir * 52 * k, agentY + 60 * k], origins[side]], lit ? 'gold' : 'ink', (lit ? 5 : 3) * k);
            }
            p.circle(ax, agentY, 22 * k, 'soft'); p.circle(ax, agentY, 22 * k, 'ink', false);
            p.rect(ax - 18 * k, agentY - 6 * k, 15 * k, 8 * k, 'ink'); p.rect(ax + 3 * k, agentY - 6 * k, 15 * k, 8 * k, 'ink');
            p.line([[ax - 3 * k, agentY - 3 * k], [ax + 3 * k, agentY - 3 * k]], 'ink', 2);
            // The player, seen from behind: a long coat and two guarding forearms.
            const px = 360, py = handY + 46 * k;
            c.beginPath(); c.moveTo(px - 50 * k, h); c.lineTo(px - 34 * k, py - 26 * k); c.lineTo(px + 34 * k, py - 26 * k); c.lineTo(px + 50 * k, h); c.closePath();
            c.fillStyle = p.color('soft'); c.fill(); c.strokeStyle = p.color('ink'); c.lineWidth = 2; c.stroke();
            p.line([[px, py - 26 * k], [px, h]], 'border', 2);
            p.circle(px, py - 46 * k, 17 * k, 'ink');
            for (const side of ['left', 'right']) {
                const [hx, hy] = hands[side], move = s.moves[side], fresh = move && s.time - move.at < .35, dir = side === 'left' ? -1 : 1;
                let tx = hx, ty = hy;
                if (fresh && move.direction === 'up') ty = hy - 24 * k;
                if (fresh && move.direction !== 'up') tx = hx + (move.direction === 'left' ? -30 : 30) * k;
                const hit = s.effects.some(e => e.kind === 'hit' && (e.side === side || e.side === 'center') && s.time - e.at < .6);
                p.circle(hx, hy, 26 * k, 'border', false);
                p.line([[px + dir * 30 * k, py - 22 * k], [tx, ty + 18 * k], [tx, ty]], hit ? 'gold' : 'ink', 6 * k);
                p.circle(tx, ty, 9 * k, fresh ? 'accent' : 'ink');
                if (fresh && move.direction !== 'up' && !reduced) p.line([[hx, hy - 18 * k], [tx, ty - 18 * k]], 'accent', 2, [4, 4]);
                mono(p, side === 'left' ? 'L' : 'R', hx + dir * 44 * k, hy + 22 * k, 22 * k, 'muted', 'center');
            }
            // Strikes: the answer as a chevron inside a code block. Telegraphed ones blink at the Agent's hand.
            const size = 44 * k;
            for (const strike of s.strikes) {
                const waiting = s.world < strike.release, heavy = strike.side === 'center';
                const inBand = !waiting && strike.p >= bandStart(strike), w = heavy ? size * 1.35 : size;
                if (focus && !reduced && !waiting) for (const back of [.1, .05]) {
                    const [gx, gy] = at(strike.side, Math.max(0, strike.p - back)); c.save(); c.globalAlpha = back > .07 ? .2 : .35;
                    p.outline(gx - w / 2, gy - w / 2, w, w, 'accent', 2); c.restore();
                }
                const [x, y] = at(strike.side, waiting ? 0 : strike.p);
                if (waiting) {
                    if (reduced || Math.floor(s.time * 6) % 2 === 0) { p.outline(x - w / 2, y - w / 2, w, w, heavy ? 'gold' : 'muted', 2); glyph(p, heavy ? 'both' : strike.move, x, y, w * .5, 'muted'); }
                    continue;
                }
                p.rect(x - w / 2, y - w / 2, w, w, inBand ? 'soft' : 'bg');
                p.outline(x - w / 2, y - w / 2, w, w, heavy ? 'gold' : inBand ? 'ink' : 'accent', inBand ? 4 : 2);
                if (heavy) p.outline(x - w / 2 + 6, y - w / 2 + 6, w - 12, w - 12, 'gold', 2);
                glyph(p, heavy ? 'both' : strike.move, x, y, w * .62, heavy ? 'gold' : inBand ? 'ink' : 'accent');
                if (strike.contactAt != null) ripple(p, x, y, s.time - strike.contactAt, w, 'gold', reduced, PARRY.grace);
            }
            // Blocked strikes stop dead and drop, ringed by a bullet-time ripple.
            for (const effect of s.effects) {
                const age = s.time - effect.at; if (effect.kind !== 'block' || age > .7) continue;
                const [x, y] = at(effect.side, effect.p), w = effect.side === 'center' ? size * 1.35 : size;
                ripple(p, x, y, age, size * (effect.perfect ? 1.5 : 1.1), effect.perfect ? 'gold' : 'accent', reduced, .7);
                const drop = reduced ? 0 : age * age * 160;
                c.save(); c.globalAlpha = Math.max(0, 1 - age / .7);
                p.outline(x - w / 2, y - w / 2 + drop, w, w, 'muted', 2); glyph(p, effect.side === 'center' ? 'both' : effect.move, x, y + drop, w * .62, 'muted');
                c.restore();
            }
            bursts(s, p, reduced);
        }
    });
}

/** Shape carries the move: an up chevron to block, side chevrons to sweep, a double chevron for both. */
export function glyph(p, move, x, y, size, color) {
    const half = size / 2, width = Math.max(3, size / 9);
    if (move === 'up' || move === 'both') {
        const rows = move === 'both' ? [-size * .2, size * .2] : [0];
        for (const dy of rows) p.line([[x - half * .8, y + dy + half * .35], [x, y + dy - half * .45], [x + half * .8, y + dy + half * .35]], color, width);
        return;
    }
    const d = move === 'left' ? -1 : 1;
    for (const dx of [-size * .18, size * .18]) p.line([[x + dx - d * half * .3, y - half * .7], [x + dx + d * half * .4, y], [x + dx - d * half * .3, y + half * .7]], color, width);
}
