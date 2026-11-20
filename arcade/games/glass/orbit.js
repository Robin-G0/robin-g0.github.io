import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { tone, scene, art, reveal, header, shape, withAlpha, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, ripple, loseLife } from './display.js';

// Orbital Assist: a probe circles a planet on one of four rings. Raise L to drop to the inner ring (faster),
// R to climb to the outer ring (slower). Each transfer takes .45 s. A beacon is collected when the probe
// arrives on its ring next to it, so the skill is phasing: wait on a faster or slower ring until the beacon
// lines up, then change orbit. Consecutive beacons chain to x4; a beacon that fades breaks the chain.
// Stages: beacons only, then retrograde debris (30 s), then a second beacon plus short-lived gold relays on the
// fast inner ring (75 s), then denser debris (120 s). Debris hits cost a life.
const TAU = Math.PI * 2;
export const ORBIT = { rings: 4, speeds: [1.3, .95, .65, .4], start: 1, transfer: .45, capture: .28, debrisReach: .17,
    beaconLife: 16, minBeaconLife: 10, goldLife: 7, beaconGap: 1.2, meetMin: 2.5, meetMax: 8, debrisWarning: .9, debrisInterval: 6.5, denseInterval: 4.6,
    minDebrisInterval: 2.6, maxDebris: 3, recovery: 1.4, points: 20, maxChain: 4, goldFactor: 3, stages: [0, 30, 75, 120] };
export const angleGap = (a, b) => { const d = ((a - b) % TAU + TAU + Math.PI) % TAU - Math.PI; return d; };
export const stageAt = time => ORBIT.stages.filter(at => time >= at).length - 1;
export const beaconLife = pace => Math.max(ORBIT.minBeaconLife, ORBIT.beaconLife / pace);
export const debrisInterval = (stage, pace) => Math.max(ORBIT.minDebrisInterval, (stage >= 3 ? ORBIT.denseInterval : ORBIT.debrisInterval) / pace);
const STAGE_NAMES = ['first beacons', 'debris field', 'gold relays', 'dense debris'];

export function orbit(env) {
    const s = { ring: ORBIT.start, angle: -Math.PI / 2, transfer: null, queued: 0, beacons: [], debris: [], chain: 0, collected: 0,
        stage: 0, nextBeacon: .8, nextDebris: ORBIT.stages[1], invulnerableUntil: 0, burnAt: -10, burnDir: 0, bumpAt: -10,
        bursts: [], effects: [], ended: false, ids: 0 };
    const settled = () => !s.transfer;
    // A beacon is placed so that, if the probe simply stays on its ring, the two line up in 2.5-8 s:
    // waiting and then changing orbit always works. In the first stage it sits on a neighbouring ring.
    function spawnBeacon(gold) {
        for (let tries = 0; tries < 12; tries++) {
            const near = [s.ring - 1, s.ring + 1].filter(r => r >= 0 && r < ORBIT.rings);
            const ring = gold ? 0 : s.stage === 0 ? near[integer(env.random, 0, near.length - 1)] : integer(env.random, 0, ORBIT.rings - 1);
            if (ring === s.ring) continue;
            const meet = ORBIT.meetMin + env.random() * (ORBIT.meetMax - ORBIT.meetMin);
            const angle = (s.angle + (ORBIT.speeds[s.ring] - ORBIT.speeds[ring]) * meet + TAU * 4) % TAU;
            if (s.beacons.some(b => b.ring === ring && Math.abs(angleGap(b.angle, angle)) < .8)) continue;
            const life = gold ? ORBIT.goldLife : beaconLife(env.pace);
            s.beacons.push({ ring, angle, born: s.time, life, gold, id: ++s.ids }); return;
        }
    }
    function spawnDebris() {
        const ring = integer(env.random, 0, ORBIT.rings - 1);
        // On the probe's own ring debris appears opposite it, so the warning and approach stay readable.
        const angle = ring === s.ring ? s.angle + Math.PI + (env.random() - .5) * .6 : env.random() * TAU;
        s.debris.push({ ring, angle, born: s.time, travelled: 0, id: ++s.ids });
        s.debris = s.debris.slice(-ORBIT.maxDebris);
    }
    function startTransfer(dir) {
        const to = s.ring + dir;
        if (to < 0 || to >= ORBIT.rings) { s.bumpAt = s.time; return false; }
        s.transfer = { from: s.ring, to, at: s.time }; s.burnAt = s.time; s.burnDir = dir;
        env.sound?.({ kind: 'thrust' }); return true;
    }
    function arrive() {
        s.ring = s.transfer.to; s.transfer = null;
        addEffect(s, { kind: 'arrive', ring: s.ring, angle: s.angle });
        check();
        if (s.queued && !s.ended) { const dir = s.queued; s.queued = 0; startTransfer(dir); }
    }
    function check() {
        if (!settled() || s.ended) return;
        for (const beacon of s.beacons) {
            if (beacon.done || beacon.ring !== s.ring || Math.abs(angleGap(beacon.angle, s.angle)) > ORBIT.capture) continue;
            beacon.done = true; s.chain = Math.min(ORBIT.maxChain, s.chain + 1); s.collected++;
            const points = ORBIT.points * s.chain * (beacon.gold ? ORBIT.goldFactor : 1);
            s.score += points;
            addBurst(s, `${beacon.gold ? 'GOLD ' : ''}${s.chain > 1 ? `×${s.chain} ` : ''}+${points}`, beacon.ring, beacon.angle);
            addEffect(s, { kind: 'beacon', ring: beacon.ring, angle: beacon.angle, gold: beacon.gold });
            env.sound?.({ kind: beacon.gold ? 'powerup' : 'clear', count: 2, chain: s.chain });
        }
        if (s.time < s.invulnerableUntil) return;
        for (const rock of s.debris) {
            if (rock.done || rock.ring !== s.ring || s.time - rock.born < ORBIT.debrisWarning) continue;
            if (Math.abs(angleGap(rock.angle, s.angle)) > ORBIT.debrisReach) continue;
            rock.done = true; s.chain = 0; s.invulnerableUntil = s.time + ORBIT.recovery;
            addBurst(s, 'DEBRIS', s.ring, s.angle, false); addEffect(s, { kind: 'hit', ring: s.ring, angle: s.angle });
            loseLife(s, env); return;
        }
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            const dir = event.action === 'left' ? -1 : 1;
            // A raise during a transfer is kept and flown on arrival, never repeated.
            if (s.transfer) { s.queued = dir; return; }
            startTransfer(dir);
        },
        pause(s) { s.queued = 0; },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) { s.stage = stage; addBurst(s, STAGE_NAMES[stage].toUpperCase(), 'top', 0); env.sound?.({ kind: 'powerup' }); }
            const speed = s.transfer ? (ORBIT.speeds[s.transfer.from] + ORBIT.speeds[s.transfer.to]) / 2 : ORBIT.speeds[s.ring];
            s.angle = (s.angle + speed * dt) % TAU;
            for (const beacon of s.beacons) beacon.angle = (beacon.angle + ORBIT.speeds[beacon.ring] * dt) % TAU;
            for (const rock of s.debris) {
                if (s.time - rock.born < ORBIT.debrisWarning) continue;
                const step = ORBIT.speeds[rock.ring] * dt; rock.angle = (rock.angle - step + TAU) % TAU; rock.travelled += step;
            }
            if (s.transfer && s.time - s.transfer.at >= ORBIT.transfer) arrive();
            for (const beacon of s.beacons) if (!beacon.done && s.time - beacon.born >= beacon.life) {
                beacon.done = true; beacon.faded = true;
                if (s.chain) { s.chain = 0; addBurst(s, 'FADED', beacon.ring, beacon.angle, false); }
                addEffect(s, { kind: 'fade', ring: beacon.ring, angle: beacon.angle });
            }
            s.beacons = s.beacons.filter(b => !b.done);
            s.debris = s.debris.filter(r => !r.done && r.travelled < TAU * .85);
            const wanted = s.stage >= 2 ? 2 : 1;
            if (s.beacons.length < wanted && s.time >= s.nextBeacon) {
                spawnBeacon(s.stage >= 2 && !s.beacons.some(b => b.gold) && env.random() < .3);
                s.nextBeacon = s.time + ORBIT.beaconGap;
            }
            if (s.beacons.length >= wanted) s.nextBeacon = Math.max(s.nextBeacon, s.time + ORBIT.beaconGap);
            if (s.stage >= 1 && s.time >= s.nextDebris) { spawnDebris(); s.nextDebris = s.time + debrisInterval(s.stage, env.pace); }
            check();
        },
        render(s, p) {
            const compact = p.compact, reduced = env.reducedMotion, c = p.c;
            const cx = 360, cy = compact ? Math.max(500, p.h * .5) : 236, outer = compact ? 320 : 164, k = compact ? 1.8 : 1;
            const radius = ring => outer * (.5 + ring * (.5 / 3));
            const at = (ring, angle) => [cx + Math.cos(angle) * radius(ring), cy + Math.sin(angle) * radius(ring)];
            scene(p, 'space', s.time, reduced);
            header(p, s.chain ? `chain ×${s.chain}` : STAGE_NAMES[s.stage], `${s.collected} beacons`);
            // Planet with a soft atmosphere.
            reveal(p, cx, cy, outer * .48, '#8fc8ff', .3);
            const earth = art('earth'), er = outer * .36;
            if (earth) c.drawImage(earth, cx - er, cy - er, er * 2, er * 2); else shape(p, 'circle', cx, cy, er, '#2b5a8f');
            // Probe position, gliding between rings during a transfer.
            let pr = radius(s.ring);
            if (s.transfer) { const u = Math.min(1, (s.time - s.transfer.at) / ORBIT.transfer), e = u * u * (3 - 2 * u); pr = radius(s.transfer.from) + (radius(s.transfer.to) - radius(s.transfer.from)) * e; }
            const px = cx + Math.cos(s.angle) * pr, py = cy + Math.sin(s.angle) * pr;
            // Rings: thin glass orbits; the probe's own ring is revealed brightest around the probe.
            for (let ring = 0; ring < ORBIT.rings; ring++) {
                const mine = ring === (s.transfer ? s.transfer.to : s.ring);
                c.save(); c.strokeStyle = withAlpha('#dbe6ff', mine ? .45 : .2); c.lineWidth = (mine ? 2.5 : 1.5) * (compact ? 1.4 : 1);
                c.beginPath(); c.arc(cx, cy, radius(ring), 0, TAU); c.stroke();
                if (mine) { c.strokeStyle = withAlpha(tone('accent'), .9); c.lineWidth = 4 * (compact ? 1.4 : 1); c.beginPath(); c.arc(cx, cy, radius(ring), s.angle - .5, s.angle + .5); c.stroke(); }
                // Speed chevrons: inner rings carry more of them, so faster orbits read at a glance.
                const marks = 4 - ring;
                for (let i = 0; i < marks; i++) {
                    const a = Math.PI * .75 + i * .09, [x, y] = at(ring, a);
                    c.fillStyle = withAlpha('#dbe6ff', .45); c.beginPath(); c.arc(x, y, 2.4 * k, 0, TAU); c.fill();
                }
                c.restore();
            }
            // Beacons: hexagonal glass with a fading life arc.
            for (const beacon of s.beacons) {
                const [x, y] = at(beacon.ring, beacon.angle), r = 15 * k, life = 1 - (s.time - beacon.born) / beacon.life;
                const col = beacon.gold ? tone('gold') : '#9fe8ff';
                const aligned = Math.abs(angleGap(beacon.angle, s.angle)) < .35 && Math.abs(beacon.ring - (s.transfer ? s.transfer.to : s.ring)) <= 1;
                reveal(p, x, y, r * (aligned ? 3 : 2), col, aligned ? .5 : .28);
                shape(p, 'hexagon', x, y, r, withAlpha('#0e1430', .6)); shape(p, 'hexagon', x, y, r, col, false, 2.5);
                shape(p, 'hexagon', x, y, r * .45, col);
                c.save(); c.strokeStyle = col; c.lineWidth = 3 * (compact ? 1.4 : 1); c.beginPath(); c.arc(x, y, r + 7 * k, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, life)); c.stroke(); c.restore();
            }
            // Debris: jagged shards moving against the orbit; dashed while they are still only a warning.
            for (const rock of s.debris) {
                const [x, y] = at(rock.ring, rock.angle), r = 13 * k, warning = s.time - rock.born < ORBIT.debrisWarning;
                if (warning) { c.save(); c.globalAlpha = reduced ? .7 : .4 + .4 * Math.abs(Math.sin((s.time - rock.born) * 7)); shape(p, 'shard', x, y, r, tone('danger'), false, 2); c.restore(); continue; }
                const [tx, ty] = at(rock.ring, rock.angle + .16);
                c.save(); c.globalAlpha = .45; p.line([[x, y], [tx, ty]], tone('danger'), 3 * k); c.restore();
                shape(p, 'shard', x, y, r, '#0b0e1c'); shape(p, 'shard', x, y, r, tone('danger'), false, 2.5);
            }
            for (const e of s.effects) {
                const [x, y] = at(e.ring, e.angle);
                if (e.kind === 'beacon') ripple(p, x, y, 15 * k, s.time - e.at, e.gold ? tone('gold') : '#9fe8ff', reduced, 46 * k);
                else if (e.kind === 'hit') ripple(p, x, y, 15 * k, s.time - e.at, tone('danger'), reduced, 46 * k);
                else if (e.kind === 'fade') { c.save(); c.globalAlpha = Math.max(0, .6 - (s.time - e.at)); shape(p, 'hexagon', x, y, 15 * k, withAlpha('#9fe8ff', .6), false, 2); c.restore(); }
            }
            // Probe: a small acrylic capsule; the burn flame points the way it pushes.
            const blink = s.time < s.invulnerableUntil && !reduced && Math.floor(s.time * 8) % 2;
            reveal(p, px, py, 46 * k, tone('accent'), .45);
            c.save(); c.globalAlpha = blink ? .35 : 1; c.translate(px, py); c.rotate(s.angle + Math.PI / 2);
            if (s.time - s.burnAt < .35) {
                const flame = (reduced ? 14 : 10 + 6 * Math.sin(s.time * 40)) * k, side = s.burnDir; // outward burn pushes from the inner side
                c.fillStyle = withAlpha('#ffd9a0', .9); c.beginPath(); c.moveTo(-5 * k, side * 9 * k); c.lineTo(5 * k, side * 9 * k); c.lineTo(0, side * (9 * k + flame)); c.fill();
            }
            c.fillStyle = withAlpha('#eef4ff', .92); c.beginPath(); c.roundRect(-11 * k, -7 * k, 22 * k, 14 * k, 7 * k); c.fill();
            c.strokeStyle = tone('accent'); c.lineWidth = 2; c.stroke();
            c.fillStyle = withAlpha('#9fb8ff', .9); c.fillRect(-20 * k, -2 * k, 7 * k, 4 * k); c.fillRect(13 * k, -2 * k, 7 * k, 4 * k);
            c.restore();
            if (s.time - s.bumpAt < .5) { c.save(); c.globalAlpha = 1 - (s.time - s.bumpAt) * 2; shape(p, 'circle', px, py, 26 * k, tone('muted'), false, 2); c.restore(); }
            bursts(s, p, reduced, b => b.x === 'top' ? [360, compact ? 150 : 86] : (() => { const [x, y] = at(b.x, b.y); return [x, y - 34 * k]; })());
        }
    });
}
