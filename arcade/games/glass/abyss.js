import { game } from '../../core/game.js?v=eras-4';
import { integer } from '../../core/random.js?v=eras-4';
import { decodeGesture } from '../../core/commands.js?v=eras-4';
import { tone, text, scene, art, reveal, header, shape, withAlpha, meter, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, ripple, loseLife } from './display.js?v=eras-4';

// Abyss Drift: the jellyfish sinks through four lanes while the deep rises past it.
// Sweep either wrist sideways to swim one lane (screen direction); raise either wrist to pulse the bell,
// which catches every light mote inside the pulse ring in its lane. Glow drains slowly and motes refill it;
// each pulse costs a little glow, so pulsing at nothing is not free. Reefs and an empty glow cost a life.
// Depth stages add one idea at a time: wide reefs (40 s), violet motes beside reefs (80 s), currents (130 s).
// Positions are in lanes and depth units below the jellyfish, so phone and desktop play identically.
export const ABYSS = { lanes: 4, start: 1, spawnDepth: 4.6, rise: .9, maxRise: 1.9, interval: 2.4, minInterval: 1.3,
    catchReach: .55, reefReach: .32, currentReach: .3, glow: 100, drain: 2.5, pulseCost: 3, moteGlow: 16, deepGlow: 30,
    refill: 60, recovery: 1.3, points: 10, deepFactor: 3, chainStep: 4, maxMultiplier: 4,
    stages: [0, 40, 80, 130], maxObjects: 18 };
export const riseSpeed = pace => Math.min(ABYSS.maxRise, ABYSS.rise * pace);
export const waveInterval = pace => Math.max(ABYSS.minInterval, ABYSS.interval / pace);
export const stageAt = time => ABYSS.stages.filter(at => time >= at).length - 1;
export const multiplier = chain => Math.min(ABYSS.maxMultiplier, 1 + Math.floor(chain / ABYSS.chainStep));
const STAGE_NAMES = ['shallows', 'wide reefs', 'violet light', 'currents'];

/** One wave of objects. A reef always leaves a lane open that is reachable, at one lane per 1.05 s, from the
 * lanes the previous reef left open; waves without a reef return `open: null` and change nothing. */
export function makeWave(random, stage, previousOpen, seconds) {
    const lanes = [0, 1, 2, 3], reach = Math.max(1, Math.floor(seconds / 1.05));
    const reachable = lane => previousOpen.some(open => Math.abs(open - lane) <= reach);
    const roll = random();
    if (stage >= 3 && roll < .18) {
        const dir = random() < .5 ? -1 : 1;
        return { objects: [{ kind: 'current', dir }], open: null };
    }
    if (roll < .45) {
        const width = stage >= 1 && random() < .5 ? 2 : 1;
        for (let tries = 0; tries < 8; tries++) {
            const first = integer(random, 0, ABYSS.lanes - width), covered = lanes.slice(first, first + width);
            const open = lanes.filter(lane => !covered.includes(lane));
            if (!open.some(reachable)) continue;
            const objects = [{ kind: 'reef', lanes: covered }];
            // Often a mote waits in an open lane. From 80 s it may be violet and sit right beside the rock.
            const beside = open.filter(lane => covered.includes(lane - 1) || covered.includes(lane + 1));
            if (stage >= 2 && beside.length && random() < .5) objects.push({ kind: 'mote', lane: beside[integer(random, 0, beside.length - 1)], deep: true });
            else if (random() < .5) objects.push({ kind: 'mote', lane: open[integer(random, 0, open.length - 1)], deep: false });
            return { objects, open: open.filter(reachable) };
        }
    }
    const lane = integer(random, 0, ABYSS.lanes - 1), objects = [{ kind: 'mote', lane, deep: false }];
    // From 40 s a second mote can trail the first in the same lane: one pulse may catch both.
    if (stage >= 1 && random() < .4) objects.push({ kind: 'mote', lane, deep: false, offset: .45 });
    return { objects, open: null };
}

export function abyss(env) {
    const s = { lane: ABYSS.start, from: ABYSS.start, movedAt: -10, glow: ABYSS.glow, objects: [], chain: 0, best: 0, caught: 0,
        stage: 0, nextWave: 1.2, open: [0, 1, 2, 3], lastWave: 0, invulnerableUntil: 0, pulseAt: -10, bumpAt: -10, bursts: [], effects: [], ended: false, ids: 0 };
    const move = (dir, at) => {
        const lane = Math.max(0, Math.min(ABYSS.lanes - 1, s.lane + dir));
        if (lane === s.lane) { s.bumpAt = s.time; return false; }
        s.from = s.lane; s.lane = lane; s.movedAt = at; return true;
    };
    function hurt(reason) {
        addBurst(s, reason, s.lane, 0, false); addEffect(s, { kind: 'hurt' });
        s.chain = 0; s.invulnerableUntil = s.time + ABYSS.recovery; loseLife(s, env);
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            const gesture = decodeGesture(event.action); if (!gesture) return;
            if (gesture.direction === 'left' || gesture.direction === 'right') {
                if (move(gesture.direction === 'left' ? -1 : 1, s.time)) env.sound?.({ kind: 'turn', action: gesture.direction });
                return;
            }
            if (gesture.direction !== 'up') return;
            // The bell pulse: catch every mote in this lane within reach; a little glow is spent either way.
            s.pulseAt = s.time; s.glow = Math.max(0, s.glow - ABYSS.pulseCost);
            const caught = s.objects.filter(o => o.kind === 'mote' && !o.done && o.lane === s.lane && Math.abs(o.depth) <= ABYSS.catchReach);
            if (!caught.length) { env.sound?.({ kind: 'input', action: 'left' }); return; }
            let points = 0;
            for (const mote of caught) {
                mote.done = true; s.chain++; s.caught++;
                points += ABYSS.points * multiplier(s.chain) * (mote.deep ? ABYSS.deepFactor : 1);
                s.glow = Math.min(ABYSS.glow, s.glow + (mote.deep ? ABYSS.deepGlow : ABYSS.moteGlow));
                addEffect(s, { kind: 'catch', lane: mote.lane, depth: mote.depth, deep: mote.deep });
            }
            s.best = Math.max(s.best, s.chain); s.score += points;
            addBurst(s, `${caught.length > 1 ? 'PAIR ' : caught.some(m => m.deep) ? 'VIOLET ' : ''}+${points}`, s.lane, 0);
            env.sound?.({ kind: caught.some(m => m.deep) || caught.length > 1 ? 'powerup' : 'clear', count: 2, chain: multiplier(s.chain) });
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) { s.stage = stage; addBurst(s, STAGE_NAMES[stage].toUpperCase(), 'top', 0); env.sound?.({ kind: 'powerup' }); }
            if (s.time >= s.nextWave) {
                const seconds = s.time - s.lastWave, wave = makeWave(env.random, s.stage, s.open, seconds);
                if (wave.open) { s.open = wave.open; s.lastWave = s.time; }
                for (const object of wave.objects) s.objects.push({ ...object, depth: ABYSS.spawnDepth + (object.offset || 0), id: ++s.ids, done: false });
                s.objects = s.objects.slice(-ABYSS.maxObjects);
                s.nextWave = s.time + waveInterval(env.pace);
            }
            const rise = riseSpeed(env.pace) * dt, safe = s.time >= s.invulnerableUntil;
            for (const object of s.objects) {
                const before = object.depth; object.depth -= rise;
                if (object.done) continue;
                if (object.kind === 'mote' && object.depth < -ABYSS.catchReach) { object.done = true; if (s.chain) { s.chain = 0; addEffect(s, { kind: 'lost' }); } }
                if (object.kind === 'reef' && Math.abs(object.depth) <= ABYSS.reefReach && object.lanes.includes(s.lane) && safe) { object.done = true; hurt('REEF'); if (s.ended) return; }
                if (object.kind === 'current' && before > 0 && object.depth <= 0) {
                    object.done = true;
                    if (move(object.dir, s.time)) { addEffect(s, { kind: 'current', dir: object.dir }); env.sound?.({ kind: 'turn', action: object.dir < 0 ? 'left' : 'right' }); }
                }
            }
            s.objects = s.objects.filter(o => o.depth > -1.6);
            s.glow = Math.max(0, s.glow - ABYSS.drain * dt);
            if (s.glow <= 0 && safe) { s.glow = ABYSS.refill; hurt('NO LIGHT'); }
        },
        render(s, p) {
            const compact = p.compact, reduced = env.reducedMotion, h = p.h;
            const jellyY = compact ? Math.max(190, h * .3) : 138, unit = (h - jellyY) / 4.4;
            const laneX = lane => compact ? 135 + lane * 150 : 210 + lane * 100, laneW = compact ? 140 : 92;
            scene(p, 'abyss', s.time, reduced);
            const c = p.c;
            // Lanes as faint vertical acrylic strips; the jellyfish's lane is revealed.
            for (let lane = 0; lane < ABYSS.lanes; lane++) {
                c.save(); c.fillStyle = withAlpha('#d6e2ff', lane === s.lane ? .1 : .04);
                c.beginPath(); c.roundRect(laneX(lane) - laneW / 2, compact ? 120 : 64, laneW, h - (compact ? 140 : 76), 22); c.fill(); c.restore();
            }
            header(p, s.chain ? `chain ${s.chain} · ×${multiplier(s.chain)}` : STAGE_NAMES[s.stage], `${s.caught} mote${s.caught === 1 ? "" : "s"}`);
            const Y = depth => jellyY + depth * unit;
            for (const o of s.objects) {
                const y = Y(o.depth); if (y < (compact ? 100 : 50) || y > h + 40) continue;
                if (o.kind === 'reef') {
                    const left = laneX(o.lanes[0]) - laneW / 2 - 6, right = laneX(o.lanes.at(-1)) + laneW / 2 + 6, rh = (compact ? 80 : 40);
                    // A coral reef: jagged top and bottom, warm translucent body, so it reads as solid rock.
                    const steps = Math.max(5, o.lanes.length * 5), g = c.createLinearGradient ? c.createLinearGradient(0, y - rh / 2, 0, y + rh / 2) : null;
                    if (g) { g.addColorStop(0, withAlpha(tone('danger'), .55)); g.addColorStop(1, withAlpha('#5a2c3a', .85)); }
                    c.save(); c.globalAlpha = o.done ? .45 : 1; c.fillStyle = g || '#5a2c3a'; c.strokeStyle = tone('danger'); c.lineWidth = 2;
                    c.beginPath(); c.moveTo(left, y);
                    for (let i = 0; i <= steps; i++) { const x = left + (right - left) * i / steps; c.lineTo(x, y - rh / 2 + (i % 2 ? rh * .28 : 0)); }
                    for (let i = steps; i >= 0; i--) { const x = left + (right - left) * i / steps; c.lineTo(x, y + rh / 2 - (i % 2 ? 0 : rh * .22)); }
                    c.closePath(); c.fill(); c.stroke(); c.restore();
                } else if (o.kind === 'mote' && !o.done) {
                    const x = laneX(o.lane), col = o.deep ? '#c9a4ff' : '#bff4ff', r = (compact ? 26 : 11) * (o.deep ? 1.2 : 1);
                    const twinkle = reduced ? 1 : .85 + .15 * Math.sin(s.time * 4 + o.id);
                    reveal(p, x, y, r * 3.2, col, .45 * twinkle);
                    shape(p, o.deep ? 'hexagon' : 'circle', x, y, r, col);
                } else if (o.kind === 'current' && !o.done) {
                    c.save(); c.globalAlpha = .75;
                    for (let lane = 0; lane < ABYSS.lanes; lane++) {
                        const x = laneX(lane), d = o.dir, size = compact ? 30 : 16, drift = reduced ? 0 : ((s.time * 1.5) % 1) * size * .6 * d;
                        p.line([[x - d * size + drift, y - size], [x + drift, y], [x - d * size + drift, y + size]], '#9fd8ff', compact ? 5 : 3);
                    }
                    c.restore();
                }
            }
            // The pulse ring shows exactly the catch reach in this lane.
            const reachPx = ABYSS.catchReach * unit, glide = reduced ? 1 : Math.min(1, (s.time - s.movedAt) / .2);
            const x = laneX(s.from) + (laneX(s.lane) - laneX(s.from)) * (1 - (1 - glide) ** 2);
            c.save(); c.strokeStyle = withAlpha('#bff4ff', .35); c.setLineDash([6, 8]); c.lineWidth = 2;
            c.beginPath(); c.roundRect(laneX(s.lane) - laneW / 2 + 6, jellyY - reachPx, laneW - 12, reachPx * 2, 18); c.stroke(); c.restore();
            const glow = s.glow / ABYSS.glow;
            reveal(p, x, jellyY, (compact ? 130 : 70) * (.4 + glow), '#9fe8ff', .5);
            const pulse = s.time - s.pulseAt;
            if (pulse < .5) ripple(p, x, jellyY, (compact ? 40 : 22), pulse * 1.4, '#bff4ff', reduced, reachPx);
            for (const e of s.effects) if (e.kind === 'catch') ripple(p, laneX(e.lane), jellyY, compact ? 18 : 10, s.time - e.at, e.deep ? '#c9a4ff' : '#bff4ff', reduced, compact ? 50 : 30);
            const blink = s.time < s.invulnerableUntil && !reduced && Math.floor(s.time * 8) % 2;
            const squeeze = pulse < .35 && !reduced ? 1 - .14 * Math.sin(pulse / .35 * Math.PI) : 1;
            const jw = (compact ? 110 : 60), jh = jw * 1.3 * squeeze;
            c.save(); c.globalAlpha = blink ? .35 : 1;
            const jelly = art('jelly');
            if (jelly) c.drawImage(jelly, x - jw / 2, jellyY - jh * .45, jw, jh);
            else { shape(p, 'circle', x, jellyY, jw * .35, '#bff4ff'); }
            c.restore();
            // Glow meter: a slim acrylic bar in the lower corner.
            const mw = compact ? 300 : 170, my = h - (compact ? 40 : 24);
            text(p, 'glow', compact ? 40 : 30, my + 5, compact ? 28 : 16, tone('muted'), 'left', 400);
            meter(p, compact ? 110 : 72, my, mw, glow, glow < .25 ? tone('danger') : '#9fe8ff', compact ? 14 : 10);
            bursts(s, p, reduced, b => b.x === 'top' ? [360, compact ? 190 : 100] : [laneX(b.x), jellyY - (compact ? 90 : 50)]);
        }
    });
}
