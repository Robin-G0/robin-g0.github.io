import { game } from '../../core/game.js?v=eras-4';
import { mono, header, rain, addBurst, bursts, pruneBursts, addEffect, pruneEffects, ripple, cells, loseLife } from './display.js?v=eras-4';

// Gravity Switch: a wall run up a shaft of code. Gravity pulls the runner to the left or the right
// wall: raise L for the left wall, R for the right wall (raising the wall you are on is harmless).
// Ledges jut from one wall, so be on the other; beams cross the middle, so never be mid-switch as one
// passes. Code pickups on a wall build a chain; every eighth pickup opens a hardline (bonus and a life).
// Stages: ledges with safe pickups, then lure pickups on the far wall (15 s), then beams (30 s).
export const GRAVITY = { horizon: 3, speed: 1, maxSpeed: 2, cross: .32, interval: 2.4, minInterval: 1.1,
    stages: [0, 15, 30], recovery: 1.2, hardline: 8, maxChain: 5, passPoints: 10, pickupPoints: 10, hardlinePoints: 100,
    ledgeReach: .55, beamEdge: .15, pickupReach: .25, maxRows: 10 };
export const STAGE_NAMES = ['ledges', 'far-wall code', 'beams'];
export const stageAt = time => GRAVITY.stages.filter(at => time >= at).length - 1;
export const worldSpeed = pace => Math.min(GRAVITY.maxSpeed, GRAVITY.speed * pace);
export const rowInterval = pace => Math.max(GRAVITY.minInterval, GRAVITY.interval / pace);
/** What a row does to a runner at horizontal position x (0 left wall, 1 right wall). */
export function collides(row, x) {
    if (row.ledge === 'left' && x < GRAVITY.ledgeReach) return true;
    if (row.ledge === 'right' && x > 1 - GRAVITY.ledgeReach) return true;
    return !!row.beam && x > GRAVITY.beamEdge && x < 1 - GRAVITY.beamEdge;
}
export const collects = (row, x) => row.pickup != null && Math.abs(x - row.pickup) < GRAVITY.pickupReach;

export function gravity(env) {
    const s = { x: 0, wall: 0, rows: [], nextRow: 1.6, chain: 0, longest: 0, pickups: 0, passed: 0, stage: 0, recoveryUntil: 0,
        switchedAt: -10, lastLedge: null, serial: 0, distance: 0, bursts: [], effects: [], ended: false };
    function addRow() {
        const row = { id: ++s.serial, d: GRAVITY.horizon, ledge: null, beam: false, pickup: null };
        const roll = env.random();
        if (s.stage >= 2 && roll < .25) {
            row.beam = true;
            if (env.random() < .5) row.pickup = env.random() < .5 ? 0 : 1;
        } else if (s.stage >= 1 && roll < .45) {
            row.pickup = env.random() < .5 ? 0 : 1;   // A lure on either wall, between obstacles.
        } else {
            // Ledges lean towards alternating sides so the shaft keeps asking for switches.
            const flip = s.lastLedge == null ? env.random() < .5 : env.random() < .65;
            row.ledge = s.lastLedge == null ? (flip ? 'left' : 'right') : flip ? (s.lastLedge === 'left' ? 'right' : 'left') : s.lastLedge;
            s.lastLedge = row.ledge;
            if (env.random() < .45) row.pickup = row.ledge === 'left' ? 1 : 0;   // Safe-side code.
        }
        s.rows.push(row); s.rows = s.rows.slice(-GRAVITY.maxRows);
    }
    function resolve(row) {
        if (s.time < s.recoveryUntil) return;
        if (collides(row, s.x)) {
            s.chain = 0; addEffect(s, { kind: 'hit', x: s.x }); addBurst(s, row.beam && !row.ledge ? 'BEAM' : 'LEDGE', 360, s.burstY ?? 280, false);
            s.recoveryUntil = s.time + GRAVITY.recovery; loseLife(s, env); return;
        }
        if (row.ledge || row.beam) { s.score += GRAVITY.passPoints; s.passed++; }
        if (row.pickup == null) return;
        if (!collects(row, s.x)) { if (s.chain) addBurst(s, 'CHAIN LOST', row.pickup ? 520 : 200, s.burstY ?? 280, false); s.chain = 0; return; }
        s.chain = Math.min(GRAVITY.maxChain, s.chain + 1); s.longest = Math.max(s.longest, s.chain); s.pickups++;
        let points = GRAVITY.pickupPoints * s.chain;
        addEffect(s, { kind: 'pickup', wall: row.pickup });
        if (s.pickups % GRAVITY.hardline === 0) {
            points += GRAVITY.hardlinePoints; if (s.lives < 3) s.lives++;
            addEffect(s, { kind: 'hardline' }); addBurst(s, `HARDLINE +${points}`, 360, (s.burstY ?? 280) - 50);
            env.sound?.({ kind: 'powerup' });
        } else {
            addBurst(s, `x${s.chain} +${points}`, row.pickup ? 500 : 220, s.burstY ?? 280);
            env.sound?.({ kind: 'clear', count: 1, chain: s.chain });
        }
        s.score += points;
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            const wall = event.action === 'left' ? 0 : 1;
            if (wall === s.wall) return; // Already pulled to that wall: harmless.
            s.wall = wall; s.switchedAt = s.time; env.sound?.({ kind: 'turn', action: event.action });
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) { s.stage = stage; addBurst(s, `NEW: ${STAGE_NAMES[stage].toUpperCase()}`, 360, s.bannerY ?? 140); env.sound?.({ kind: 'powerup' }); }
            const step = dt / GRAVITY.cross;
            s.x = s.wall ? Math.min(1, s.x + step) : Math.max(0, s.x - step);
            const v = worldSpeed(env.pace); s.distance += v * dt;
            if (s.time >= s.nextRow) { addRow(); s.nextRow = s.time + rowInterval(env.pace); }
            for (const row of s.rows) {
                const before = row.d; row.d -= v * dt;
                if (before > 0 && row.d <= 0) { resolve(row); if (s.ended) return; }
            }
            s.rows = s.rows.filter(row => row.d > -.4);
        },
        render(s, p) {
            const compact = p.compact, h = p.h, k = compact ? 1.45 : 1, reduced = env.reducedMotion, c = p.c;
            header(p, `chain x${s.chain}`, `hardline ${s.pickups % GRAVITY.hardline}/${GRAVITY.hardline}`, s.time, reduced);
            const wallL = compact ? 130 : 210, wallR = compact ? 590 : 510, top = Math.max(compact ? 96 : 64, h * .15), runnerY = h * .84;
            s.burstY = runnerY - 70 * k; s.bannerY = top + 60 * k;
            const xOf = x => wallL + 39 * k + x * (wallR - wallL - 78 * k), yOf = d => runnerY - d / GRAVITY.horizon * (runnerY - top);
            cells(p, 24, compact ? 72 : 52, GRAVITY.hardline, s.pickups % GRAVITY.hardline, compact ? 16 : 10, compact ? 6 : 4);
            // Walls of falling code; the code streams down as the runner climbs.
            const flow = s.distance * 90;
            for (const [x0, x1] of [[0, wallL], [wallR, 720]])
                rain(p, flow / 60, { x0, x1, top, bottom: h, columns: Math.max(2, Math.round((x1 - x0) / 36)), alpha: .32, size: 18 * k, reduced });
            const pulled = s.time - s.switchedAt < .3;
            p.line([[wallL, top], [wallL, h]], s.wall === 0 ? 'accent' : 'border', (s.wall === 0 && pulled ? 6 : 3) * k);
            p.line([[wallR, top], [wallR, h]], s.wall === 1 ? 'accent' : 'border', (s.wall === 1 && pulled ? 6 : 3) * k);
            // Floor rungs scroll past to show the climb.
            const spacing = (runnerY - top) / 6;
            for (let i = 0; i < 8; i++) {
                const y = top + ((i * spacing + s.distance / GRAVITY.horizon * (runnerY - top)) % (spacing * 8));
                if (y < h) p.line([[wallL, y], [wallL + 10 * k, y]], 'border', 2), p.line([[wallR - 10 * k, y], [wallR, y]], 'border', 2);
            }
            // Gravity chevrons in the gap point to the pulling wall.
            const dir = s.wall ? 1 : -1;
            c.save(); c.globalAlpha = .35;
            for (const y of [top + (runnerY - top) * .25, top + (runnerY - top) * .6]) for (const off of [-16, 16])
                p.line([[360 + off * k - dir * 8 * k, y - 14 * k], [360 + off * k + dir * 8 * k, y], [360 + off * k - dir * 8 * k, y + 14 * k]], 'muted', 3);
            c.restore();
            for (const row of s.rows) {
                const y = yOf(row.d), near = row.d < GRAVITY.horizon * .45, rh = 32 * k;
                if (row.ledge) {
                    const from = row.ledge === 'left' ? wallL : wallR, to = row.ledge === 'left' ? xOf(GRAVITY.ledgeReach) : xOf(1 - GRAVITY.ledgeReach);
                    const x0 = Math.min(from, to), w = Math.abs(to - from);
                    p.rect(x0, y - rh / 2, w, rh, 'soft');
                    c.save(); c.beginPath(); c.rect(x0, y - rh / 2, w, rh); c.clip();
                    for (let d = -rh; d < w; d += 14 * k) p.line([[x0 + d, y + rh / 2], [x0 + d + rh, y - rh / 2]], near ? 'ink' : 'muted', 2);
                    c.restore(); p.outline(x0, y - rh / 2, w, rh, near ? 'ink' : 'accent', near ? 3 : 2);
                }
                if (row.beam) {
                    const x0 = xOf(GRAVITY.beamEdge), x1 = xOf(1 - GRAVITY.beamEdge);
                    p.line([[x0, y], [x1, y]], 'gold', 4 * k, [10, 6]);
                    p.rect(x0 - 8 * k, y - 10 * k, 12 * k, 20 * k, 'gold'); p.rect(x1 - 4 * k, y - 10 * k, 12 * k, 20 * k, 'gold');
                }
                if (row.pickup != null && row.d > -.05) {
                    const x = xOf(row.pickup), size = 36 * k;
                    p.rect(x - size / 2, y - size / 2, size, size, 'bg'); p.outline(x - size / 2, y - size / 2, size, size, 'accent', 2);
                    mono(p, '1', x, y + 1, size * .75, 'ink', 'center');
                }
            }
            // The runner: head toward the shaft centre, feet on the pulling wall; rotates as it crosses.
            const rx = xOf(s.x), angle = (.5 - s.x) * Math.PI, recovering = s.time < s.recoveryUntil;
            if (!recovering || reduced || Math.floor(s.time * 8) % 2 === 0) {
                c.save(); c.translate(rx, runnerY); c.rotate(angle); c.scale(1.25 * k, 1.25 * k);
                const ink = p.color(recovering ? 'gold' : 'ink');
                // A long coat flaring towards the wall, two boots planted on it, a head with dark glasses.
                c.beginPath(); c.moveTo(-9, -2); c.lineTo(9, -2); c.lineTo(16, 24); c.lineTo(-16, 24); c.closePath();
                c.fillStyle = p.color('soft'); c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
                c.beginPath(); c.moveTo(-5, 24); c.lineTo(-5, 31); c.moveTo(5, 24); c.lineTo(5, 31); c.lineWidth = 3; c.stroke();
                c.beginPath(); c.arc(0, -11, 8, 0, Math.PI * 2); c.fillStyle = p.color('soft'); c.fill(); c.lineWidth = 2; c.stroke();
                c.fillStyle = ink; c.fillRect(-7, -14, 14, 4);
                c.restore();
            }
            for (const effect of s.effects) {
                const age = s.time - effect.at;
                if (effect.kind === 'pickup') ripple(p, xOf(effect.wall), runnerY, age, 34 * k, 'accent', reduced, .6);
                if (effect.kind === 'hardline') ripple(p, rx, runnerY, age, 80 * k, 'gold', reduced, .9);
                if (effect.kind === 'hit') ripple(p, xOf(effect.x), runnerY, age, 44 * k, 'gold', reduced, .6);
            }
            bursts(s, p, reduced);
        }
    });
}
