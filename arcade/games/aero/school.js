import { game } from '../../core/game.js?v=eras-3';
import { decodeGesture } from '../../core/commands.js?v=eras-3';
import { AERO, linear, water, risingBubbles, glass, orb, bubble, fish, jellyfish, text, header, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, ring, loseLife, isDark, aurora } from './display.js?v=eras-3';

// School Rescue: guide a school of fish up a three-lane current. Rows drift down toward the school;
// sweep a wrist sideways to change lane, raise one to spend a pearl on a bubble shield.
// Strays join the school; jellyfish and coral cost a life and scatter half the school; swimming
// through the opening of a glass reef gate brings the school home for 10 points per fish and a pearl.
export const SCHOOL = { lanes: 3, travel: 4.4, minTravel: 2.6, interval: 2.8, minInterval: 1.7, gateEvery: 5, calmRows: 2,
    strayPoints: 5, bankPoints: 10, startFish: 3, maxFish: 15, recovery: 1.2, shield: 1.6, maxPearls: 3,
    twinsAt: 50, crowdAt: 100, crowdGateEvery: 4, strayChance: .6, offPathStray: .4, goldAt: 75, goldChance: .2, goldFish: 3 };
export const LANES = [0, 1, 2];
export const travelSeconds = pace => Math.max(SCHOOL.minTravel, SCHOOL.travel / pace);
export const rowInterval = pace => Math.max(SCHOOL.minInterval, SCHOOL.interval / pace);
/** The stage names what the current adds: 0 single jellyfish, 1 twin jellyfish rows, 2 crowded reef. */
export const stageAt = time => (time >= SCHOOL.crowdAt ? 2 : time >= SCHOOL.twinsAt ? 1 : 0);
export const bankPoints = count => SCHOOL.bankPoints * count;
/** A hit scatters half the school (rounded up); the leader always stays. */
export const afterHit = count => Math.max(1, count - Math.ceil((count - 1) / 2));

/** The next row: a safe lane at most one lane from the last, and reachable from any off-path stray. */
export function makeRow(random, { index, previous, offStray, time }) {
    const candidates = LANES.filter(l => Math.abs(l - previous) <= 1 && (offStray == null || Math.abs(l - offStray) <= 1));
    const safe = candidates[Math.floor(random() * candidates.length)];
    const every = stageAt(time) >= 2 ? SCHOOL.crowdGateEvery : SCHOOL.gateEvery;
    if (index >= SCHOOL.calmRows + 2 && index % every === every - 1) return { kind: 'gate', safe, jellies: [], strays: [] };
    const stage = stageAt(time), others = LANES.filter(l => l !== safe);
    if (random() < .5) others.reverse();
    const count = index < SCHOOL.calmRows ? 0 : stage === 2 ? 2 : stage === 1 ? (random() < .5 ? 2 : 1) : 1;
    const jellies = others.slice(0, count), free = LANES.filter(l => !jellies.includes(l));
    const strays = [];
    if (random() < SCHOOL.strayChance) {
        const off = free.filter(l => l !== safe);
        const lane = off.length && random() < SCHOOL.offPathStray ? off[0] : safe;
        strays.push({ lane, gold: time >= SCHOOL.goldAt && random() < SCHOOL.goldChance });
    }
    return { kind: 'row', safe, jellies, strays };
}

export function school(env) {
    const s = { lane: 1, fish: SCHOOL.startFish, pearls: 0, shieldUntil: -10, safeUntil: -10, rows: [], spawned: 0, nextRow: 1,
        previous: 1, offStray: null, homes: 0, bestHome: 0, stage: 0, glide: { from: 1, to: 1, at: -10 }, lastInput: null,
        bursts: [], effects: [], ended: false };
    const laneX = lane => 180 + lane * 180;
    function spawn() {
        const row = makeRow(env.random, { index: s.spawned, previous: s.previous, offStray: s.offStray, time: s.time });
        s.previous = row.safe; s.offStray = row.strays.find(st => st.lane !== row.safe)?.lane ?? null;
        s.rows.push({ ...row, id: ++s.spawned, progress: 0, resolved: false });
        s.nextRow = s.time + rowInterval(env.pace);
    }
    function hit(row, label) {
        if (s.time < s.shieldUntil) {
            addEffect(s, { kind: 'absorb', lane: s.lane }); addBurst(s, 'SHIELD', laneX(s.lane), 0, true);
            s.shieldUntil = s.time; env.sound?.({ kind: 'bounce', perfect: true }); return;
        }
        if (s.time < s.safeUntil) return; // One recovery window: simultaneous threats cannot spend several lives.
        const lost = s.fish - afterHit(s.fish);
        s.fish = afterHit(s.fish);
        addEffect(s, { kind: 'scatter', lane: s.lane, count: Math.max(lost, 1) });
        addBurst(s, lost ? `${label} −${lost} fish` : label, laneX(s.lane), 0, false);
        loseLife(s, env, SCHOOL.recovery);
    }
    function resolve(row) {
        row.resolved = true;
        if (row.kind === 'gate') {
            if (s.lane === row.safe) {
                const points = bankPoints(s.fish);
                s.score += points; s.homes++; s.bestHome = Math.max(s.bestHome, s.fish);
                const pearl = s.pearls < SCHOOL.maxPearls; if (pearl) s.pearls++;
                addBurst(s, `HOME ×${s.fish} +${points}`, laneX(row.safe), 0, true, true);
                addEffect(s, { kind: 'home', lane: row.safe, pearl });
                env.sound?.({ kind: 'clear', count: s.fish, perfect: s.fish >= 10, chain: 1 });
            } else hit(row, 'CORAL');
            return;
        }
        if (row.jellies.includes(s.lane)) { hit(row, 'STING'); if (s.ended) return; }
        const stray = row.strays.find(st => st.lane === s.lane);
        if (stray) {
            stray.taken = true;
            const join = stray.gold ? SCHOOL.goldFish : 1, before = s.fish;
            s.fish = Math.min(SCHOOL.maxFish, s.fish + join);
            s.score += SCHOOL.strayPoints * join;
            addBurst(s, `+${s.fish - before || 0} fish`, laneX(s.lane), 0, true);
            addEffect(s, { kind: 'join', lane: s.lane, gold: stray.gold });
            env.sound?.({ kind: 'bounce', perfect: stray.gold });
        }
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            const direction = decodeGesture(event.action)?.direction ?? event.action; // six commands; plain left/right also steer
            s.lastInput = { direction, at: s.time, ok: true };
            if (direction === 'up') {
                if (!s.pearls || s.time < s.shieldUntil) { s.lastInput.ok = false; return; } // Harmless: nothing to spend.
                s.pearls--; s.shieldUntil = s.time + SCHOOL.shield;
                env.sound?.({ kind: 'rescue' }); return;
            }
            const target = Math.max(0, Math.min(2, s.lane + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0)));
            if (target === s.lane) { s.lastInput.ok = false; return; } // An edge bump changes nothing.
            s.glide = { from: s.lane, to: target, at: s.time }; s.lane = target;
            env.sound?.({ kind: 'turn', action: direction === 'left' ? 'left' : 'right' });
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s, 1.2);
            if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) {
                s.stage = stage; addBurst(s, stage === 1 ? 'TWIN JELLYFISH' : 'CROWDED REEF', 360, 0, false, true);
                env.sound?.({ kind: 'powerup' });
            }
            if (s.time >= s.nextRow) spawn();
            const speed = 1 / travelSeconds(env.pace);
            for (const row of s.rows) {
                row.progress += speed * dt;
                if (!row.resolved && row.progress >= 1) { resolve(row); if (s.ended) return; }
            }
            s.rows = s.rows.filter(row => row.progress < 1.3);
        },
        render(s, p) {
            const compact = p.compact, h = p.h, k = compact ? 1.45 : 1, fk = compact ? 1.75 : 1, t = env.reducedMotion ? 0 : s.time, dark = isDark(p);
            const top = compact ? 140 : 70, line = h - (compact ? 190 : 84), yOf = progress => top + progress * (line - top);
            water(p, t);
            if (dark) aurora(p, t, top + 40, { amplitude: 18, opacity: .28, colors: ['#4dffc4', '#5fd6ff'] });
            risingBubbles(p, t, 10, { top, bottom: h - 30 });
            // Current lanes: soft glass channels, the school's own lane a little brighter.
            const c = p.c;
            for (const lane of LANES) {
                c.save(); c.globalAlpha = lane === s.lane ? .5 : .28;
                c.fillStyle = linear(c, laneX(lane) - 60, 0, laneX(lane) + 60, 0, [[0, 'rgba(255,255,255,0)'], [.5, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']], 'rgba(255,255,255,.2)');
                c.fillRect(laneX(lane) - 60, top - 30, 120, line - top + 80); c.restore();
            }
            c.save(); c.globalAlpha = .55; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([10, 12]);
            c.beginPath(); c.moveTo(40, line); c.lineTo(680, line); c.stroke(); c.setLineDash([]); c.restore();
            // Rows drift down; resolved rows keep drifting past and fade.
            for (const row of s.rows) {
                const y = yOf(row.progress), fade = row.progress > 1 ? Math.max(0, 1 - (row.progress - 1) / .3) : 1;
                c.save(); c.globalAlpha = fade;
                if (row.kind === 'gate') {
                    for (const lane of LANES) {
                        const x = laneX(lane);
                        if (lane === row.safe) {
                            orb(p, x - 74 * k, y, 13 * k, AERO.lime); orb(p, x + 74 * k, y, 13 * k, AERO.lime);
                            c.save(); c.globalAlpha *= .9; c.beginPath(); c.ellipse(x, y, 62 * k, 22 * k, 0, 0, Math.PI * 2);
                            c.lineWidth = 5 * k; c.strokeStyle = AERO.lime; c.shadowColor = '#d8ff8a'; c.shadowBlur = 18; c.stroke(); c.restore();
                            text(p, '↑', x, y, 30 * k, dark ? '#e9ffd0' : '#175c06', 'center', 600);
                        } else {
                            glass(p, x - 86, y - 20 * k, 172, 40 * k, 12, { tint: AERO.coral, strength: 1.1 });
                            c.save(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3;
                            for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 30 - 10, y + 14 * k); c.lineTo(x + i * 30 + 10, y - 14 * k); c.stroke(); }
                            c.restore();
                        }
                    }
                } else {
                    for (const lane of row.jellies) jellyfish(p, laneX(lane), y, 66 * k, t + lane);
                    for (const stray of row.strays) {
                        if (stray.taken) continue;
                        const x = laneX(stray.lane), r = 30 * k;
                        if (stray.gold) { c.save(); c.shadowColor = '#ffe37a'; c.shadowBlur = 22; orb(p, x, y, r, AERO.sun, { opacity: .55 }); c.restore(); }
                        fish(p, x, y + 2, r * 1.5, stray.gold ? AERO.sun : AERO.orange, Math.sin(t * 2 + stray.lane) * .2, t);
                        bubble(p, x, y, r, .95);
                        if (stray.gold) text(p, `+${SCHOOL.goldFish}`, x + r, y - r, compact ? 30 : 18, dark ? '#ffe9a0' : '#7a5300', 'left', 600);
                    }
                }
                c.restore();
            }
            // The school: a leader with followers in a loose formation, gliding to its lane.
            const ease = u => (u >= 1 ? 1 : u <= 0 ? 0 : 1 - (1 - u) ** 3);
            const glideX = at => (env.reducedMotion ? laneX(s.glide.to) : laneX(s.glide.from) + (laneX(s.glide.to) - laneX(s.glide.from)) * ease((at - s.glide.at) / .22));
            const lead = glideX(s.time), tilt = env.reducedMotion ? 0 : (laneX(s.glide.to) - glideX(s.time - .05)) * .004;
            for (let i = s.fish - 2; i >= 0; i--) {
                const rowk = Math.floor(i / 5) + 1, col = (i % 5) - 2; // up to three rows of five followers
                const fx = glideX(s.time - rowk * .06) + col * 22 * fk + (rowk % 2 ? 10 : 0) * fk + Math.sin(t * 2.2 + i) * 3;
                const fy = line + 6 + rowk * 19 * fk + Math.cos(t * 1.8 + i * 1.3) * 3;
                fish(p, fx, fy, 34 * fk, i % 3 === 1 ? AERO.sky : AERO.orange, -Math.PI / 2 + Math.sin(t * 2 + i) * .12, t + i);
            }
            fish(p, lead, line - 4, 54 * fk, AERO.orange, -Math.PI / 2 + tilt, t);
            if (s.time < s.shieldUntil) {
                const left = (s.shieldUntil - s.time) / SCHOOL.shield;
                bubble(p, lead, line + 14 * k, (64 + (s.fish > 5 ? 22 : 0)) * k, .55 + .35 * left);
            }
            if (s.time < s.safeUntil && !env.reducedMotion && Math.floor(s.time * 8) % 2) bubble(p, lead, line - 4, 30 * k, .5);
            for (const e of s.effects) {
                const age = s.time - e.at, x = laneX(e.lane);
                if (e.kind === 'join') ring(p, x, line - 4, 30 * k, age, e.gold ? AERO.sun : '#ffffff', env.reducedMotion);
                else if (e.kind === 'absorb') ring(p, x, line + 10, 70 * k, age, '#bff8ff', env.reducedMotion, .8);
                else if (e.kind === 'home') {
                    ring(p, x, line, 62 * k, age, AERO.lime, env.reducedMotion, .9);
                    if (!env.reducedMotion && age < .9) aurora(p, age * 6, line - 30, { amplitude: 14, opacity: .55 * (1 - age / .9) });
                } else if (e.kind === 'scatter' && !env.reducedMotion && age < 1) {
                    for (let i = 0; i < Math.min(7, e.count); i++) {
                        const a = -Math.PI / 2 + (i - (e.count - 1) / 2) * .6;
                        fish(p, x + Math.cos(a) * age * 220, line + 30 + Math.sin(a) * age * 120 + 60 * age, 26 * k, AERO.orange, a, s.time + i, { opacity: 1 - age });
                    }
                }
            }
            // Pearl tray: each pearl buys one bubble shield (raise a wrist).
            const pk = compact ? 1.9 : 1, trayW = 34 * pk * SCHOOL.maxPearls + 18, trayX = 700 - trayW, trayY = compact ? 92 : 58;
            const refused = s.lastInput?.direction === 'up' && !s.lastInput.ok && s.time - s.lastInput.at < .5;
            glass(p, trayX, trayY, trayW, 34 * pk, 17 * pk, { tint: refused ? AERO.coral : '#ffffff', shadow: false });
            for (let i = 0; i < SCHOOL.maxPearls; i++) {
                const x = trayX + 9 + 17 * pk + i * 34 * pk, y = trayY + 17 * pk;
                if (i < s.pearls) orb(p, x, y, 12 * pk, '#eef8ff');
                else { c.save(); c.beginPath(); c.arc(x, y, 10 * pk, 0, Math.PI * 2); c.setLineDash([3, 3]); c.lineWidth = 2; c.strokeStyle = dark ? 'rgba(200,240,255,.6)' : 'rgba(7,108,168,.5)'; c.stroke(); c.restore(); }
            }
            const next = s.rows.filter(row => !row.resolved), gate = next.findIndex(row => row.kind === 'gate');
            header(p, `school ${s.fish}`, gate >= 0 ? (gate === 0 ? 'gate next' : `gate in ${gate + 1}`) : `best home ×${s.bestHome}`);
            // Bursts recorded at y 0 belong just above the school line, whatever the board height.
            bursts(p, { time: s.time, bursts: s.bursts.map(b => (b.y === 0 ? { ...b, y: line - 70 * k } : b)) }, env.reducedMotion);
        }
    });
}
