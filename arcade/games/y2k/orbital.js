import { game } from '../../core/game.js?v=eras-4';
import { integer } from '../../core/random.js?v=eras-4';
import { techno, chrome, candy, starburst, flare, backdrop, header, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, shatter, loseLife, gainLife } from './display.js?v=eras-4';

// Orbital Breaker: a chrome shield orbits a candy-plastic planet in six sectors. Comets fly in along
// the sector lines on a visible schedule; the shield breaks every comet that reaches its sector.
// L turns the shield one sector anticlockwise, R one sector clockwise. Consecutive comets are always
// reachable at one turn per 1.1 s. Star shards (from 20 s) are optional bonus pickups off the route;
// solar flares (from 45 s) must NOT meet the shield, so position becomes a real choice.
export const ORBIT = { sectors: 6, travel: 6, minTravel: 3.4, gap: 2.9, minGap: 1.5, jitter: .25, stepSeconds: 1.1,
    firstArrival: 3.5, shardFrom: 20, flareFrom: 45, shardChance: .35, flareChance: .4, extraGap: 2.2,
    points: 10, shardPoints: 30, levelEvery: 6, maxLevel: 4, restoreEvery: 15, ahead: 3, span: .46, turnSeconds: .18 };
export const mod = (n, m = ORBIT.sectors) => ((n % m) + m) % m;
export const sectorDistance = (a, b) => { const d = mod(a - b); return Math.min(d, ORBIT.sectors - d); };
export const sectorAngle = sector => -Math.PI / 2 + sector * 2 * Math.PI / ORBIT.sectors;
export const gapFor = pace => Math.max(ORBIT.minGap, ORBIT.gap / pace);
export const travelFor = pace => Math.max(ORBIT.minTravel, ORBIT.travel / pace);
export const reachFor = gap => Math.min(3, Math.floor(gap / ORBIT.stepSeconds));
export const levelFor = streak => Math.min(ORBIT.maxLevel, 1 + Math.floor(streak / ORBIT.levelEvery));
export const stageAt = time => time >= ORBIT.flareFrom ? 2 : time >= ORBIT.shardFrom ? 1 : 0;
/** Flares avoid both neighbouring comet sectors and so never sit on the short path between them. */
export function flareSectors(from, to) {
    return Array.from({ length: ORBIT.sectors }, (_, i) => i).filter(i => sectorDistance(i, from) >= 2 && sectorDistance(i, to) >= 2);
}

export function orbital(env) {
    const s = { sector: 0, turn: { from: 0, at: -10 }, comets: [], last: { sector: 0, at: 0 }, stage: 0,
        blocked: 0, streak: 0, level: 1, shards: 0, bursts: [], effects: [], ended: false, ids: 0 };
    function schedule() {
        while (s.comets.filter(comet => comet.kind === 'rock').length < ORBIT.ahead) {
            const first = s.ids === 0, gap = first ? ORBIT.firstArrival : gapFor(env.pace) * (1 + ORBIT.jitter * env.random());
            const reach = reachFor(gap), from = s.last, at = from.at + gap;
            const sector = mod(from.sector + integer(env.random, -reach, reach)), travel = travelFor(env.pace);
            s.comets.push({ id: ++s.ids, kind: 'rock', sector, at, spawn: at - travel });
            const stage = stageAt(s.time);
            if (!first && gap >= ORBIT.extraGap && stage > 0) {
                const roll = env.random(), mid = from.at + gap / 2;
                if (stage === 2 && roll < ORBIT.flareChance) {
                    const options = flareSectors(from.sector, sector);
                    if (options.length) s.comets.push({ id: ++s.ids, kind: 'flare', sector: options[integer(env.random, 0, options.length - 1)], at: mid, spawn: mid - travel });
                } else if (roll < ORBIT.flareChance + ORBIT.shardChance) {
                    s.comets.push({ id: ++s.ids, kind: 'shard', sector: integer(env.random, 0, ORBIT.sectors - 1), at: mid, spawn: mid - travel });
                }
            }
            s.last = { sector, at };
        }
    }
    function resolve(comet) {
        const hit = comet.sector === s.sector;
        if (comet.kind === 'rock' && hit) {
            s.streak++; s.blocked++; s.level = levelFor(s.streak);
            const points = ORBIT.points * s.level; s.score += points;
            addEffect(s, { kind: 'break', sector: comet.sector }); addBurst(s, `+${points}`, 0, 0, true, { sector: comet.sector });
            env.sound?.({ kind: 'clear', count: 1, chain: s.level });
            if (s.streak % ORBIT.restoreEvery === 0 && gainLife(s, env)) { addBurst(s, '+1 LIFE', 0, 0, true, { center: true }); }
        } else if (comet.kind === 'rock') {
            s.streak = 0; s.level = 1; addEffect(s, { kind: 'impact', sector: comet.sector });
            addBurst(s, 'IMPACT', 0, 0, false, { planet: true }); loseLife(s, env);
        } else if (comet.kind === 'shard' && hit) {
            const points = ORBIT.shardPoints * s.level; s.score += points; s.shards++;
            addEffect(s, { kind: 'shard', sector: comet.sector }); addBurst(s, `STAR +${points}`, 0, 0, true, { sector: comet.sector });
            env.sound?.({ kind: 'powerup' });
        } else if (comet.kind === 'flare' && hit) {
            s.streak = 0; s.level = 1; addEffect(s, { kind: 'scorch', sector: comet.sector });
            addBurst(s, 'SCORCHED', 0, 0, false, { sector: comet.sector }); loseLife(s, env);
        }
    }
    schedule();
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            s.turn = { from: s.sector, at: s.time };
            s.sector = mod(s.sector + (event.action === 'left' ? -1 : 1));
            env.sound?.({ kind: 'turn', action: event.action });
        },
        update(s) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) {
                s.stage = stage; addBurst(s, stage === 1 ? 'STAR SHARDS' : 'SOLAR FLARES', 0, 0, true, { center: true });
                env.sound?.({ kind: 'powerup' });
            }
            schedule();
            for (const comet of s.comets) {
                if (comet.done || s.time < comet.at) continue;
                comet.done = true; resolve(comet); if (s.ended) return;
            }
            s.comets = s.comets.filter(comet => !comet.done);
        },
        render(s, p) {
            backdrop(p);
            const compact = p.compact, k = compact ? 1.7 : 1, cx = 360;
            // The orbit fills whatever height the board has; phones get a taller board, not a different rule.
            const top = compact ? 84 : 52, room = p.h - top - (compact ? 24 : 14);
            const outer = Math.min(compact ? 335 : 182, room / 2), ring = outer * .64, cy = top + room / 2;
            header(p, `streak ${s.streak}`, `×${s.level}`);
            const at = (sector, r) => [cx + Math.cos(sectorAngle(sector)) * r, cy + Math.sin(sectorAngle(sector)) * r];
            const c = p.c, reduced = env.reducedMotion;
            // Sector lanes and the orbit.
            c.save(); c.globalAlpha = .55;
            for (let i = 0; i < ORBIT.sectors; i++) p.line([at(i, ring + 14 * k), at(i, outer)], 'border', 1.5, [4, 6]);
            c.restore();
            p.circle(cx, cy, ring, 'border', false);
            // Planet: translucent candy plastic with a chrome ring and a lens flare highlight.
            const planet = ring * .42, impact = s.effects.find(e => e.kind === 'impact' && s.time - e.at < .7);
            c.save(); c.beginPath(); c.ellipse?.(cx, cy, planet * 1.75, planet * .42, -.25, Math.PI, Math.PI * 2);
            c.strokeStyle = chrome(p, cx, cy - planet, cx, cy + planet); c.lineWidth = 6 * k; c.stroke(); c.restore();
            candy(p, cx, cy, planet, impact && !reduced && s.time - impact.at < .3 ? 'gold' : 'accent');
            c.save(); c.beginPath(); c.ellipse?.(cx, cy, planet * 1.75, planet * .42, -.25, 0, Math.PI);
            c.strokeStyle = chrome(p, cx, cy - planet, cx, cy + planet); c.lineWidth = 6 * k; c.stroke(); c.restore();
            flare(p, cx - planet * .35, cy - planet * .45, planet * .22, .9, 'soft');
            // Ring warnings: the target sector brightens as its comet closes in.
            for (const comet of s.comets) {
                const progress = (s.time - comet.spawn) / (comet.at - comet.spawn);
                if (progress < .45 || progress > 1) continue;
                const a = sectorAngle(comet.sector), color = comet.kind === 'flare' ? 'gold' : comet.kind === 'shard' ? 'accent' : 'ink';
                c.save(); c.globalAlpha = .25 + .6 * (progress - .45) / .55; c.beginPath();
                c.arc(cx, cy, ring + 22 * k, a - ORBIT.span * .8, a + ORBIT.span * .8);
                c.strokeStyle = p.color(color); c.lineWidth = 5 * k; c.setLineDash(comet.kind === 'rock' ? [] : [6, 6]); c.stroke(); c.setLineDash([]); c.restore();
            }
            // Shield: a chrome arc easing between sectors, L at its anticlockwise end and R at its clockwise end.
            const turnAge = s.time - s.turn.at;
            let delta = mod(s.sector - s.turn.from); if (delta > 3) delta -= 6;
            const ease = reduced || turnAge >= ORBIT.turnSeconds ? 1 : 1 - (1 - turnAge / ORBIT.turnSeconds) ** 2;
            const angle = sectorAngle(s.turn.from) + delta * ease * Math.PI / 3;
            const blockFlash = s.effects.find(e => e.kind === 'break' && s.time - e.at < .25);
            c.save(); c.beginPath(); c.arc(cx, cy, ring, angle - ORBIT.span, angle + ORBIT.span);
            c.lineCap = 'round'; c.strokeStyle = p.color('ink'); c.lineWidth = 22 * k; c.stroke();
            c.strokeStyle = chrome(p, cx, cy - ring, cx, cy + ring); c.lineWidth = 16 * k; c.stroke();
            if (blockFlash) { c.strokeStyle = '#ffffff'; c.lineWidth = 7 * k; c.stroke(); }
            c.restore();
            for (const [end, letter] of [[-1, 'L'], [1, 'R']]) {
                const a = angle + end * (ORBIT.span + .2), x = cx + Math.cos(a) * ring, y = cy + Math.sin(a) * ring;
                const chip = compact ? 21 : 14; p.circle(x, y, chip, 'bg'); p.circle(x, y, chip, 'border', false);
                techno(p, letter, x, y + 1, compact ? 28 : 17, 'ink', 'center', 900);
            }
            // Comets: chrome rocks with a tail, rotating star shards and rayed solar flares.
            for (const comet of s.comets) {
                if (s.time < comet.spawn) continue;
                const progress = Math.min(1, (s.time - comet.spawn) / (comet.at - comet.spawn));
                const [x, y] = at(comet.sector, outer - (outer - ring) * progress), a = sectorAngle(comet.sector);
                if (comet.kind === 'rock') {
                    c.save(); c.globalAlpha = .45; p.line([[x, y], [x + Math.cos(a) * 34 * k, y + Math.sin(a) * 34 * k]], 'muted', 7 * k); c.restore();
                    const r = compact ? 26 : 15; c.save(); c.beginPath();
                    for (let i = 0; i < 7; i++) { const t = i / 7 * Math.PI * 2 + comet.id, rr = r * (i % 2 ? .78 : 1); c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
                    c.closePath(); c.fillStyle = chrome(p, x, y - r, x, y + r); c.fill(); c.strokeStyle = p.color('ink'); c.lineWidth = 2; c.stroke(); c.restore();
                } else if (comet.kind === 'shard') {
                    starburst(p, x, y, compact ? 30 : 17, 'accent', 4, reduced ? 0 : s.time * 2, .35);
                    p.circle(x, y, 4 * k, '#ffffff');
                } else {
                    starburst(p, x, y, compact ? 30 : 18, 'gold', 12, reduced ? 0 : s.time, .6);
                    candy(p, x, y, 10 * k, 'gold', 1);
                }
            }
            // Outcome effects stay at the sector where they happened.
            for (const effect of s.effects) {
                const age = s.time - effect.at;
                if (effect.kind === 'break') shatter(p, ...at(effect.sector, ring), age, 'accent', reduced, k);
                else if (effect.kind === 'shard') shatter(p, ...at(effect.sector, ring), age, 'accent', reduced, k * 1.3);
                else if (effect.kind === 'scorch') shatter(p, ...at(effect.sector, ring), age, 'gold', reduced, k);
                else if (effect.kind === 'impact') shatter(p, ...at(effect.sector, planet), age, 'gold', reduced, k);
            }
            bursts(s, p, reduced, burst => burst.center ? { ...burst, x: cx, y: cy + ring + 44 * k }
                : burst.planet ? { ...burst, x: cx, y: cy - planet - 14 * k }
                    : burst.sector != null ? { ...burst, x: at(burst.sector, ring + 52 * k)[0], y: at(burst.sector, ring + 52 * k)[1] } : burst);
        }
    });
}
