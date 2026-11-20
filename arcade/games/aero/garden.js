import { game } from '../../core/game.js?v=eras-4';
import { AERO, meadow, glass, orb, bubble, glyph, text, header, addBurst, bursts, pruneBursts, addEffect, pruneEffects,
    ring, timerRing, loseLife, isDark, grass, mix } from './display.js?v=eras-4';

// Living Garden: plants ask for rain or sunshine. Raise L to rain on the whole garden, R for sunshine:
// every plant asking for that weather is served at once, and a batch of n scores 10 x n squared.
// The other weather is stressful: rain cuts every sun timer by 35 %, sunshine every rain timer.
// Three served needs bloom a plant (+50). A timer that runs out wilts the plant and costs a life.
export const GARDEN = { beds: [[0, 4], [40, 5], [90, 6]], interval: 3.2, minInterval: 1.4, deadline: 9, minDeadline: 4,
    stress: .35, bloomAfter: 3, points: 10, bloomPoints: 50, rainbowAt: 65, rainbowEvery: 5, rainbowTime: 1.4, first: 1.5 };
export const needInterval = pace => Math.max(GARDEN.minInterval, GARDEN.interval / pace);
export const needDeadline = pace => Math.max(GARDEN.minDeadline, GARDEN.deadline / pace);
export const bedsAt = time => GARDEN.beds.filter(([at]) => time >= at).at(-1)[1];
export const batchPoints = served => GARDEN.points * served * served;
const WEATHER = { left: 'water', right: 'sun' };

/**
 * Applies one weather to every bed. Matching needs are served (a rainbow needs both weathers),
 * opposite plain needs lose `stress` of their remaining time. Returns what happened per bed.
 */
export function applyWeather(beds, type, time) {
    const served = [], stressed = [], halves = [];
    beds.forEach((bed, index) => {
        const need = bed.need; if (!need) return;
        if (need.type === 'rainbow') {
            if (need[type]) return;
            need[type] = true;
            if (need.water && need.sun) served.push(index); else halves.push(index);
        } else if (need.type === type) served.push(index);
        else { need.deadline = time + (need.deadline - time) * (1 - GARDEN.stress); stressed.push(index); }
    });
    return { served, stressed, halves };
}

export function garden(env) {
    const s = { beds: Array.from({ length: bedsAt(0) }, () => ({ growth: 0, need: null })), nextNeed: GARDEN.first, needs: 0,
        bag: [], blooms: 0, bestBatch: 0, lastWeather: null, bursts: [], effects: [], ended: false };
    function nextType() {
        s.needs++;
        if (s.time >= GARDEN.rainbowAt && s.needs % GARDEN.rainbowEvery === 0) return 'rainbow';
        if (!s.bag.length) {
            s.bag = ['water', 'sun', 'water', 'sun'];
            for (let i = s.bag.length - 1; i > 0; i--) { const j = Math.floor(env.random() * (i + 1)); [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]]; }
        }
        return s.bag.pop();
    }
    function addNeed() {
        const free = s.beds.map((bed, i) => (bed.need ? -1 : i)).filter(i => i >= 0);
        s.nextNeed = s.time + needInterval(env.pace);
        if (!free.length) return;
        const index = free[Math.floor(env.random() * free.length)], type = nextType();
        const total = needDeadline(env.pace) * (type === 'rainbow' ? GARDEN.rainbowTime : 1);
        s.beds[index].need = { type, deadline: s.time + total, total, water: false, sun: false };
    }
    function grow(index) {
        const bed = s.beds[index];
        bed.need = null; bed.growth++;
        if (bed.growth >= GARDEN.bloomAfter) {
            bed.growth = 0; s.blooms++; s.score += GARDEN.bloomPoints;
            addEffect(s, { kind: 'bloom', bed: index }); addBurst(s, `BLOOM +${GARDEN.bloomPoints}`, index, -1, true, true);
            env.sound?.({ kind: 'powerup' });
        }
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            const type = WEATHER[event.action];
            if (s.ended || !type) return;
            const { served, stressed, halves } = applyWeather(s.beds, type, s.time);
            s.lastWeather = { type, at: s.time, served, stressed };
            addEffect(s, { kind: type, beds: [...served, ...halves] });
            for (const index of stressed) addEffect(s, { kind: 'stress', bed: index });
            if (served.length) {
                const points = batchPoints(served.length);
                s.score += points; s.bestBatch = Math.max(s.bestBatch, served.length);
                addBurst(s, served.length > 1 ? `×${served.length} +${points}` : `+${points}`, served.reduce((a, i) => a + i, 0) / served.length, -2, true, served.length > 2);
                env.sound?.({ kind: 'clear', count: served.length, chain: served.length, perfect: served.length >= 4 });
                for (const index of served) grow(index);
            } else env.sound?.({ kind: halves.length ? 'turn' : 'input', action: event.action });
        },
        update(s) {
            pruneBursts(s); pruneEffects(s, 1.4);
            if (s.ended) return;
            const count = bedsAt(s.time);
            if (count > s.beds.length) {
                while (s.beds.length < count) s.beds.push({ growth: 0, need: null });
                addBurst(s, 'NEW BED', s.beds.length - 1, -1, true, true); env.sound?.({ kind: 'powerup' });
            }
            if (s.time >= GARDEN.rainbowAt && !s.rainbowShown) { s.rainbowShown = true; addBurst(s, 'RAINBOW PLANTS', 2.5, -3, true, true); }
            if (s.time >= s.nextNeed) addNeed();
            for (let index = 0; index < s.beds.length; index++) {
                const bed = s.beds[index];
                if (!bed.need || s.time < bed.need.deadline) continue;
                bed.need = null; bed.growth = 0;
                addEffect(s, { kind: 'wilt', bed: index }); addBurst(s, 'WILTED', index, -1, false);
                loseLife(s, env); if (s.ended) return;
            }
        },
        render(s, p) {
            const compact = p.compact, h = p.h, k = compact ? 1.45 : 1, t = env.reducedMotion ? 0 : s.time, dark = isDark(p), c = p.c;
            const horizon = compact ? h * .4 : 190, soil = h - (compact ? 160 : 52), grow = compact ? 1.3 : .9;
            const n = s.beds.length, span = 640, bedX = i => 40 + span * (i + .5) / n, pot = Math.min(96, span / n - 14);
            meadow(p, t, horizon);
            grass(p, t, soil + 4, { blades: 40, height: 26 * k, dark });
            // Weather sources: the rain cloud on the left, the sun on the right, each counting its waiting plants.
            const waiting = type => s.beds.filter(b => b.need && (b.need.type === type || (b.need.type === 'rainbow' && !b.need[type]))).length;
            const cloudX = compact ? 150 : 120, sunX = compact ? 530 : 600, skyY = compact ? 150 : 98;
            cloud(p, cloudX, skyY + (env.reducedMotion ? 0 : Math.sin(t * .8) * 3), 1.1 * k);
            orb(p, sunX, skyY, 30 * k, AERO.sun); glyph(p, 'sun', sunX, skyY, 22 * k, '#fff8d8');
            for (const [x, type, color] of [[cloudX + 44 * k, 'water', AERO.aqua], [sunX + 40 * k, 'sun', AERO.sun]]) {
                const count = waiting(type);
                glass(p, x - 4, skyY + 8 * k, 50 * k, 32 * k, 16 * k, { tint: count ? color : '#ffffff', shadow: false });
                text(p, `×${count}`, x + 21 * k, skyY + 24 * k, compact ? 30 : 19, 'ink', 'center', 600, { glow: false });
            }
            for (let i = 0; i < n; i++) {
                const x = bedX(i), bed = s.beds[i];
                const stress = s.effects.find(e => e.kind === 'stress' && e.bed === i && s.time - e.at < .5);
                const wilt = s.effects.find(e => e.kind === 'wilt' && e.bed === i);
                const shake = stress && !env.reducedMotion ? Math.sin((s.time - stress.at) * 60) * 4 : 0;
                plant(p, x + shake, soil, Math.min(pot, 80) * k * grow, wilt ? 2 : bed.growth, t + i, wilt ? Math.min(1, (s.time - wilt.at) * 2) : 0);
                glass(p, x - pot / 2, soil - 4, pot, 34 * k, 10, { tint: AERO.leaf, strength: .9 });
                for (let g = 0; g < GARDEN.bloomAfter; g++) orb(p, x - (GARDEN.bloomAfter - 1) * 7 * k + g * 14 * k, soil + 14 * k, 4.5 * k, g < bed.growth ? AERO.lime : '#e8f4ee', { opacity: g < bed.growth ? 1 : .6 });
                if (bed.need) {
                    const need = bed.need, y = soil - (compact ? 280 : 150), r = 22 * k, left = (need.deadline - s.time) / need.total;
                    const bob = env.reducedMotion ? 0 : Math.sin(t * 2 + i) * 3;
                    if (need.type === 'rainbow') {
                        orb(p, x, y + bob, r, '#ffffff'); glyph(p, 'rainbow', x, y + bob, r * .7);
                        glyph(p, 'drop', x - r * .9, y + bob + r * 1.25, r * .38, need.water ? AERO.lime : AERO.aqua);
                        glyph(p, 'sun', x + r * .9, y + bob + r * 1.25, r * .4, need.sun ? AERO.lime : '#e8a400');
                    } else {
                        orb(p, x, y + bob, r, need.type === 'water' ? AERO.aqua : AERO.sun);
                        glyph(p, need.type === 'water' ? 'drop' : 'sun', x, y + bob, r * .62);
                    }
                    timerRing(p, x, y + bob, r + 7 * k, left, dark ? '#c9f6ff' : AERO.deep);
                    if (stress) ring(p, x, y + bob, r + 7 * k, s.time - stress.at, AERO.coral, env.reducedMotion, .5);
                }
            }
            // Weather effects over the beds they reached.
            for (const e of s.effects) {
                const age = s.time - e.at;
                if (e.kind === 'water' && age < .9) for (const i of e.beds) {
                    for (let d = 0; d < 7; d++) {
                        const dx = bedX(i) + (d - 3) * 9 * k, fall = env.reducedMotion ? .5 : ((age * 1.8 + d * .13) % 1);
                        c.save(); c.globalAlpha = 1 - age / .9; glyph(p, 'drop', dx, soil - 200 * k + fall * 170 * k, 6 * k, '#7fd8ff'); c.restore();
                    }
                } else if (e.kind === 'sun' && age < .9) for (const i of e.beds) {
                    c.save(); c.globalAlpha = (1 - age / .9) * .7; c.globalCompositeOperation = 'lighter';
                    c.strokeStyle = '#fff1a8'; c.lineWidth = 14 * k; c.lineCap = 'round';
                    c.beginPath(); c.moveTo(sunX, skyY); c.lineTo(bedX(i), soil - 60 * k); c.stroke(); c.restore();
                } else if (e.kind === 'bloom' && age < 1.4) {
                    const x = bedX(e.bed);
                    flower(p, x, soil - 110 * k, 26 * k * Math.min(1, age * 4), t);
                    if (!env.reducedMotion) butterfly(p, x + Math.sin(age * 5) * 30 * k, soil - 120 * k - age * 140 * k, 16 * k, s.time, 1 - age / 1.4);
                    ring(p, x, soil - 110 * k, 34 * k, age, '#ffffff', env.reducedMotion, .7);
                }
            }
            const pending = [[40, 'new bed'], [GARDEN.rainbowAt, 'rainbow plants'], [90, 'new bed']].find(([at]) => at > s.time && at - s.time <= 8);
            header(p, `${s.blooms} bloom${s.blooms === 1 ? '' : 's'}`, pending ? `${pending[1]} in ${Math.ceil(pending[0] - s.time)}s` : s.bestBatch > 1 ? `best batch ×${s.bestBatch}` : '');
            // Bursts store a bed index; -1 places them at the soil line, -2 by the need bubbles, -3 mid-sky.
            bursts(p, { time: s.time, bursts: s.bursts.map(b => (b.y < 0 ? { ...b, x: 40 + span * (b.x + .5) / n, y: b.y === -1 ? soil - 60 * k : b.y === -2 ? soil - (compact ? 280 : 150) - 60 * k : horizon * .6 } : b)) }, env.reducedMotion);
        }
    });
}

/** A glossy white cumulus with a soft blue underside. */
export function cloud(p, x, y, scale = 1) {
    const c = p.c; c.save();
    for (const [dx, dy, r] of [[-34, 8, 22], [-10, -6, 30], [22, 2, 26], [42, 12, 18], [4, 14, 24]]) orb(p, x + dx * scale, y + dy * scale, r * scale, '#f2fbff', { opacity: .96 });
    c.restore();
}
/** A plant drawn at growth stage 0 (sprout), 1 (leafy), 2 (bud); `wilt` greys and droops it. */
export function plant(p, x, base, width, growth, t, wilt = 0) {
    const c = p.c, k = width / 70, height = (34 + growth * 34) * k * (1 - wilt * .4), sway = Math.sin(t * 1.3) * 4 * k * (1 - wilt);
    const green = mix(AERO.leaf, '#8a8a70', wilt), light = mix(AERO.lime, '#b8b49a', wilt);
    c.save(); c.lineCap = 'round';
    c.strokeStyle = green; c.lineWidth = 5 * k;
    c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + sway * .5 + wilt * 20 * k, base - height * .6, x + sway + wilt * 26 * k, base - height); c.stroke();
    for (let i = 0; i <= growth; i++) {
        const ly = base - height * (.3 + i * .22), dir = i % 2 ? 1 : -1;
        c.save(); c.translate(x + sway * (.3 + i * .2), ly); c.rotate(dir * (.7 + wilt * .8) + Math.sin(t * 1.6 + i) * .08);
        c.beginPath(); c.ellipse(dir * 15 * k, 0, 16 * k, 7 * k, 0, 0, Math.PI * 2);
        c.fillStyle = light; c.fill(); c.lineWidth = 1; c.strokeStyle = green; c.stroke();
        c.beginPath(); c.ellipse(dir * 13 * k, -2 * k, 9 * k, 2.5 * k, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
        c.restore();
    }
    if (growth >= 2 && !wilt) orb(p, x + sway, base - height - 6 * k, 9 * k, AERO.pink);
    c.restore();
}
export function flower(p, x, y, r, t) {
    const c = p.c; c.save();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * .3; orb(p, x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7, r * .48, AERO.pink); }
    orb(p, x, y, r * .45, AERO.sun); c.restore();
}
export function butterfly(p, x, y, size, t, opacity = 1) {
    const c = p.c, flap = Math.abs(Math.sin(t * 14)) * .8 + .2; c.save(); c.globalAlpha *= Math.max(0, opacity);
    for (const dir of [-1, 1]) {
        c.beginPath(); c.ellipse(x + dir * size * .5 * flap, y - size * .2, size * .55 * flap, size * .5, dir * .5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(80,190,255,.85)'; c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    }
    c.fillStyle = '#0b3550'; c.fillRect(x - 1.5, y - size * .5, 3, size * .9); c.restore();
}
