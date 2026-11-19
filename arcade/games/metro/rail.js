import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { METRO, light, header, meter, addBurst, pruneBursts, loseLife } from './display.js';

export const RAIL = { capacity: 4, travel: 2.6, minTravel: 1.3, arrival: 3.2, minArrival: 1.5, fork: .5,
    headway: .22, convoyWindow: 1.6, points: 20, convoy: 10 };
const LINES = [{ letter: 'A', color: METRO.blue }, { letter: 'B', color: METRO.purple }];
export const arrivalInterval = pace => Math.max(RAIL.minArrival, RAIL.arrival / pace);
export const travelSeconds = pace => Math.max(RAIL.minTravel, RAIL.travel / pace);

/** Metro Line: trains queue on their own. Set the junction, dispatch, and keep the platform clear. */
export function rail(env) {
    const s = { junction: 0, queue: [], trains: [], nextArrival: 1, served: 0, convoy: 0, lastArrival: { line: -1, at: -10 },
        switchedAt: -10, dispatchedAt: -10, refusedAt: -10, bursts: [], ended: false, ids: 0 };
    const arrive = () => { s.queue.push({ line: integer(env.random, 0, 1), id: ++s.ids }); };
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            if (event.action === 'left') {
                s.junction = 1 - s.junction; s.switchedAt = s.time;
                env.sound?.({ kind: 'turn', action: s.junction ? 'right' : 'left' }); return;
            }
            if (event.action !== 'right') return;
            // An empty platform or a train still leaving it makes the raise harmless.
            if (!s.queue.length || s.trains.some(train => train.progress < RAIL.headway)) { s.refusedAt = s.time; return; }
            const train = s.queue.shift();
            s.trains.push({ ...train, progress: 0, route: null, done: false }); s.dispatchedAt = s.time;
            env.sound?.({ kind: 'input', action: 'right' });
        },
        update(s, dt) {
            pruneBursts(s); if (s.ended) return;
            if (s.time >= s.nextArrival) {
                arrive(); s.nextArrival = s.time + arrivalInterval(env.pace);
                if (s.queue.length > RAIL.capacity) {
                    s.queue.shift(); addBurst(s, 'PLATFORM FULL', 360, 'platform', false); loseLife(s, env);
                    if (s.ended) return;
                }
            }
            const speed = 1 / travelSeconds(env.pace);
            for (const train of s.trains) {
                train.progress += speed * dt;
                if (train.route == null && train.progress >= RAIL.fork) train.route = s.junction;
                if (train.done || train.progress < 1) continue;
                train.done = true;
                if (train.route === train.line) {
                    const convoy = s.lastArrival.line === train.line && s.time - s.lastArrival.at <= RAIL.convoyWindow;
                    const points = RAIL.points + (convoy ? RAIL.convoy : 0);
                    s.score += points; s.served++; s.convoy = convoy ? s.convoy + 1 : 0;
                    s.lastArrival = { line: train.line, at: s.time };
                    addBurst(s, convoy ? `CONVOY +${points}` : `+${points}`, train.line ? 570 : 150, 'station');
                    env.sound?.({ kind: convoy ? 'powerup' : 'clear', count: convoy ? 3 : 1 });
                } else {
                    s.convoy = 0; s.lastArrival = { line: -1, at: -10 };
                    addBurst(s, 'WRONG STATION', train.route ? 570 : 150, 'station', false); loseLife(s, env);
                    if (s.ended) return;
                }
            }
            s.trains = s.trains.filter(train => !train.done);
        },
        render(s, p) {
            const compact = p.compact, h = p.h;
            header(p, 'metro line', `${s.served} arrived · convoy ${s.convoy}`, s.lives);
            // Vertical budget at 420: stations, fork, platform, then one label row and the arrival meter.
            const stationY = compact ? 150 : 100, radius = compact ? 50 : 36, forkY = compact ? h * .5 : 205;
            const slot = compact ? 70 : 44, gap = compact ? 16 : 12, platformY = h - (compact ? 200 : 120);
            const stationX = [150, 570], track = compact ? 14 : 10, branchEnd = i => [stationX[i], stationY + radius];
            // Signage: the branch the junction serves carries its line colour and its station wears a ring.
            p.line([[360, platformY - 8], [360, forkY]], 'border', track);
            LINES.forEach((line, i) => {
                const active = s.junction === i;
                p.line([[360, forkY], branchEnd(i)], active ? line.color : 'border', track);
                if (active) p.circle(stationX[i], stationY, radius + (compact ? 9 : 6), 'ink', false);
                p.circle(stationX[i], stationY, radius, line.color);
                light(p, line.letter, stationX[i], stationY + 2, radius * 1.1, METRO.white, 'center', 400);
            });
            const [bladeX, bladeY] = branchEnd(s.junction);
            p.line([[360, forkY], [360 + (bladeX - 360) * .28, forkY + (bladeY - forkY) * .28]], s.time - s.switchedAt < .3 ? 'ink' : METRO.white, Math.max(3, track - 6));
            light(p, `L  switch → ${LINES[s.junction].letter}`, 378, forkY + (compact ? 44 : 26), compact ? 32 : 18, 'ink', 'left', 400);
            for (const train of s.trains) {
                const t = train.progress, [endX, endY] = branchEnd(train.route ?? s.junction), share = (t - RAIL.fork) / (1 - RAIL.fork);
                const x = t < RAIL.fork ? 360 : 360 + (endX - 360) * share;
                const y = t < RAIL.fork ? platformY - 8 - (platformY - 8 - forkY) * t / RAIL.fork : forkY + (endY - forkY) * share;
                const w = compact ? 44 : 32, th = compact ? 56 : 40;
                p.rect(x - w / 2, y - th / 2, w, th, LINES[train.line].color);
                light(p, LINES[train.line].letter, x, y + 1, compact ? 30 : 20, METRO.white, 'center', 400);
            }
            // Platform: four slots. The front train leaves on R; a fifth arrival cancels the oldest.
            const width = RAIL.capacity * (slot + gap) - gap, left = 360 - width / 2;
            for (let i = 0; i < RAIL.capacity; i++) {
                const x = left + i * (slot + gap), train = s.queue[i];
                if (!train) { p.outline(x + 1, platformY + 1, slot - 2, slot - 2, 'border', 2); continue; }
                p.rect(x, platformY, slot, slot, LINES[train.line].color);
                light(p, LINES[train.line].letter, x + slot / 2, platformY + slot / 2 + 1, slot * .55, METRO.white, 'center', 400);
                if (i === 0) p.outline(x + 3, platformY + 3, slot - 6, slot - 6, s.time - s.dispatchedAt < .3 ? 'ink' : METRO.white, 3);
            }
            const row = platformY + slot + (compact ? 38 : 20);
            light(p, 'platform  ·  R  dispatch', left, row, compact ? 27 : 15, 'ink', 'left', 400);
            // Phones put the arrival label under its meter instead of competing for the row.
            light(p, 'next train', compact ? left : left + width, compact ? row + 60 : row, compact ? 24 : 15, 'muted', compact ? 'left' : 'right', 400);
            meter(p, left, row + (compact ? 26 : 13), width, 1 - Math.max(0, s.nextArrival - s.time) / arrivalInterval(env.pace), 'accent', compact ? 8 : 5);
            if (s.time - s.refusedAt < .5) light(p, s.queue.length ? 'platform busy' : 'no train waiting', left + width, row + (compact ? 60 : 32), compact ? 22 : 15, 'muted', compact ? 'right' : 'center', 400);
            // Bursts are anchored to a station or the platform; the row is resolved at draw time.
            for (const burst of s.bursts) {
                const age = s.time - burst.at; if (age > 1.1) continue;
                const y = burst.y === 'platform' ? platformY - (compact ? 60 : 38) : stationY + radius + (compact ? 60 : 30);
                light(p, burst.text, burst.x, y - (env.reducedMotion ? 0 : age * 22), compact ? 36 : 28, burst.good ? 'ink' : METRO.orange, 'center', burst.good ? 300 : 400);
            }
        }
    });
}
