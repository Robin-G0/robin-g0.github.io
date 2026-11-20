import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { METRO, light, header, addEffect, pruneEffects, pruneBursts, loseLife } from './display.js';

// A growing tree: one junction and two stations, then a third station behind a second
// junction at 40 s, then a fourth behind a third junction at 90 s. Trains leave on a
// visible timetable; the player only sets junctions. Station slots never move.
export const RAIL = { stages: [0, 40, 90], interval: 3, minInterval: 1.4, travel: 4.4, minTravel: 2.4,
    root: .4, child: .7, horizon: 6, ahead: 4, firstDeparture: 1.5, convoyWindow: 1.6, points: 20, convoy: 10 };
export const STATIONS = Object.freeze([
    { letter: 'A', color: METRO.blue, side: 0, outer: false, stage: 0, slot: 1 },
    { letter: 'B', color: METRO.purple, side: 1, outer: false, stage: 0, slot: 2 },
    { letter: 'C', color: METRO.green, side: 1, outer: true, stage: 1, slot: 3 },
    { letter: 'D', color: METRO.orange, side: 0, outer: true, stage: 2, slot: 0 }
]);
export const departureInterval = pace => Math.max(RAIL.minInterval, RAIL.interval / pace);
export const travelSeconds = pace => Math.max(RAIL.minTravel, RAIL.travel / pace);
export const stageAt = time => RAIL.stages.filter(at => time >= at).length - 1;
export const openStations = stage => STATIONS.filter(station => station.stage <= stage);
export const hasChild = (stage, side) => openStations(stage).filter(station => station.side === side).length === 2;
/** The station reached from a root side and, where that side splits, a child choice (0 inner, 1 outer). */
export function destination(stage, side, choice) {
    const onSide = openStations(stage).filter(station => station.side === side);
    return onSide.length === 1 ? onSide[0] : onSide.find(station => station.outer === (choice === 1));
}

export function rail(env) {
    const s = { time: 0, root: 0, children: [0, 0], stage: 0, schedule: [], trains: [], served: 0, convoy: 0, lastArrival: { letter: '', at: -10 },
        switchedAt: -10, childSwitchedAt: -10, refusedAt: -10, bursts: [], effects: [], ended: false, ids: 0 };
    const burst = (text, letter, good = true) => { s.bursts.push({ text, letter, good, at: s.time }); s.bursts = s.bursts.slice(-6); };
    function fillSchedule() {
        while (s.schedule.length < RAIL.ahead) {
            const last = s.schedule.at(-1), at = last ? last.at + departureInterval(env.pace) : s.time + RAIL.firstDeparture;
            const open = openStations(s.stage);
            s.schedule.push({ letter: open[integer(env.random, 0, open.length - 1)].letter, at, id: ++s.ids });
        }
    }
    fillSchedule();
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            if (event.action === 'left') { s.root = 1 - s.root; s.switchedAt = s.time; env.sound?.({ kind: 'turn', action: s.root ? 'right' : 'left' }); return; }
            if (event.action !== 'right') return;
            if (!hasChild(s.stage, s.root)) { s.refusedAt = s.time; return; } // No second junction on this branch yet: harmless.
            s.children[s.root] = 1 - s.children[s.root]; s.childSwitchedAt = s.time;
            env.sound?.({ kind: 'turn', action: s.children[s.root] ? 'right' : 'left' });
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) {
                s.stage = stage; const opened = STATIONS.find(station => station.stage === stage);
                burst(`NEW STATION ${opened.letter}`, opened.letter); env.sound?.({ kind: 'powerup' });
            }
            while (s.schedule.length && s.time >= s.schedule[0].at) {
                const departure = s.schedule.shift();
                s.trains.push({ letter: departure.letter, id: departure.id, progress: 0, side: null, choice: null, done: false });
                env.sound?.({ kind: 'input', action: 'right' });
            }
            fillSchedule();
            const speed = 1 / travelSeconds(env.pace);
            for (const train of s.trains) {
                train.progress += speed * dt;
                if (train.side == null && train.progress >= RAIL.root) train.side = s.root;
                if (train.choice == null && train.progress >= RAIL.child) train.choice = s.children[train.side];
                if (train.done || train.progress < 1) continue;
                train.done = true;
                const reached = destination(s.stage, train.side, train.choice);
                if (reached.letter === train.letter) {
                    const convoy = s.lastArrival.letter === train.letter && s.time - s.lastArrival.at <= RAIL.convoyWindow;
                    const points = RAIL.points + (convoy ? RAIL.convoy : 0);
                    s.score += points; s.served++; s.convoy = convoy ? s.convoy + 1 : 0;
                    s.lastArrival = { letter: train.letter, at: s.time };
                    burst(convoy ? `CONVOY +${points}` : `+${points}`, reached.letter);
                    addEffect(s, { kind: 'arrive', letter: reached.letter, convoy });
                    env.sound?.({ kind: convoy ? 'powerup' : 'clear', count: convoy ? 3 : 1, chain: Math.min(4, s.convoy + 1) });
                } else {
                    s.convoy = 0; s.lastArrival = { letter: '', at: -10 };
                    burst(`${train.letter} SENT TO ${reached.letter}`, reached.letter, false); loseLife(s, env);
                    if (s.ended) return;
                }
            }
            s.trains = s.trains.filter(train => !train.done);
        },
        render(s, p) {
            const compact = p.compact, h = p.h, k = compact ? 1.6 : 1;
            header(p, `${s.served} arrived`, s.convoy ? `convoy ${s.convoy}` : '');
            const stationY = compact ? 150 : 96, radius = 30 * k, childY = compact ? h * .40 : 196, rootY = compact ? h * .56 : 272;
            const depotY = compact ? h * .70 : 334, boardY = compact ? h - 150 : 368, track = 10 * k;
            const slotX = [110, 280, 440, 610], childX = [195, 525], stationPoint = station => [slotX[station.slot], stationY + radius];
            const selected = destination(s.stage, s.root, s.children[s.root]);
            // Tracks: the open route carries its destination colour from the depot to the station.
            p.line([[360, depotY], [360, rootY]], 'border', track);
            for (const side of [0, 1]) {
                const open = side === s.root, onSide = openStations(s.stage).filter(station => station.side === side);
                p.line([[360, rootY], [childX[side], childY]], open ? selected.color : 'border', track);
                for (const station of onSide) {
                    const chosen = open && station === selected;
                    p.line([[childX[side], childY], stationPoint(station)], chosen ? station.color : 'border', track);
                }
                if (onSide.length === 2) {
                    p.circle(childX[side], childY, 9 * k, open ? 'ink' : 'border');
                    light(p, '2', childX[side] + (side ? 22 : -22) * k, childY, 16 * k, open ? 'ink' : 'muted', 'center', 400);
                    if (open) light(p, 'R', childX[side] + (side ? 22 : -22) * k, childY + 20 * k, 15 * k, 'ink', 'center', 400);
                }
            }
            p.circle(360, rootY, 10 * k, s.time - s.switchedAt < .3 ? 'accent' : 'ink');
            light(p, '1 · L', 360 + 28 * k, rootY + 2, 16 * k, 'ink', 'left', 400);
            for (const station of openStations(s.stage)) {
                if (station === selected) p.circle(slotX[station.slot], stationY, radius + 6 * k, 'ink', false);
                // An arrival pops the station and sends a flat ring outward; reduced motion keeps a steady highlight.
                const arrive = s.effects.find(e => e.kind === 'arrive' && e.letter === station.letter && s.time - e.at < .7), age = arrive ? s.time - arrive.at : 1;
                let r = radius;
                if (arrive && !env.reducedMotion) {
                    r = radius * (age < .25 ? 1 + .18 * Math.sin(age / .25 * Math.PI) : 1);
                    const c = p.c; c.save(); c.globalAlpha = Math.max(0, 1 - age / .7) * .9;
                    p.circle(slotX[station.slot], stationY, radius + (arrive.convoy ? 26 : 16) * k * (age / .7) + 6 * k, arrive.convoy ? 'accent' : station.color, false); c.restore();
                } else if (arrive) p.circle(slotX[station.slot], stationY, radius + 10 * k, station.color, false);
                p.circle(slotX[station.slot], stationY, r, station.color);
                light(p, station.letter, slotX[station.slot], stationY + 2, radius * 1.15, METRO.white, 'center', 400);
            }
            for (const train of s.trains) {
                const t = train.progress, side = train.side ?? s.root;
                const target = destination(s.stage, side, train.choice ?? s.children[side]), [sx, sy] = stationPoint(target);
                let x, y;
                if (t < RAIL.root) { const u = t / RAIL.root; x = 360; y = depotY + (rootY - depotY) * u; }
                else if (t < RAIL.child) { const u = (t - RAIL.root) / (RAIL.child - RAIL.root); x = 360 + (childX[side] - 360) * u; y = rootY + (childY - rootY) * u; }
                else { const u = (t - RAIL.child) / (1 - RAIL.child); x = childX[side] + (sx - childX[side]) * u; y = childY + (sy - childY) * u; }
                const line = STATIONS.find(station => station.letter === train.letter), w = 30 * k, th = 38 * k;
                p.rect(x - w / 2, y - th / 2, w, th, line.color);
                light(p, train.letter, x, y + 1, 19 * k, METRO.white, 'center', 400);
            }
            // Departures board: upcoming trains slide toward the "now" line and leave when they reach it.
            const left = 70, width = 580, nowX = left + 36 * k;
            light(p, 'departures', left, boardY - 14 * k, 15 * k, 'muted', 'left', 400);
            p.line([[left, boardY + 16 * k], [left + width, boardY + 16 * k]], 'border', 2);
            p.line([[nowX, boardY - 2 * k], [nowX, boardY + 34 * k]], 'ink', 3);
            light(p, 'now', nowX - 8 * k, boardY + 46 * k, 13 * k, 'muted', 'right', 400);
            for (const departure of s.schedule) {
                const wait = departure.at - s.time; if (wait > RAIL.horizon) continue;
                const x = nowX + (wait / RAIL.horizon) * (left + width - nowX), line = STATIONS.find(station => station.letter === departure.letter);
                p.rect(x - 13 * k, boardY, 26 * k, 32 * k, line.color);
                light(p, departure.letter, x, boardY + 17 * k, 18 * k, METRO.white, 'center', 400);
                light(p, `${Math.ceil(wait)}s`, x, boardY + 46 * k, 12 * k, 'muted', 'center', 400);
            }
            const upcoming = RAIL.stages.find(at => at > s.time);
            if (upcoming) light(p, `new station in ${Math.ceil(upcoming - s.time)}s`, left + width, boardY - 14 * k, 13 * k, 'muted', 'right', 400);
            if (s.time - s.refusedAt < .6) light(p, 'no second junction on this branch yet', 360, depotY + 22 * k, 14 * k, 'muted', 'center', 400);
            for (const b of s.bursts) {
                const age = s.time - b.at; if (age > 1.1) continue;
                const station = STATIONS.find(item => item.letter === b.letter), x = station ? slotX[station.slot] : 360;
                light(p, b.text, Math.max(90, Math.min(630, x)), stationY + radius + 28 * k - (env.reducedMotion ? 0 : age * 22), 26 * k, b.good ? 'ink' : METRO.orange, 'center', b.good ? 300 : 400);
            }
        }
    });
}
