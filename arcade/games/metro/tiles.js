import { game } from '../../core/game.js';
import { METRO, light, header, tile, addBurst, bursts, pruneBursts, loseLife } from './display.js';

export const TILES = { opening: 2, maxCadence: 1.1, minCadence: .55, stepPoints: 10, livePoints: 20,
    finishPerTile: 10, rest: .9, retry: 1.2, litShare: .62 };
export function tileCadence(rounds) { return Math.max(TILES.minCadence, TILES.maxCadence - rounds * .05); }
/** Steps whose flash has started; only these may be answered during the show phase. */
export function revealedSteps(s) {
    if (s.phase !== 'show' || s.time < s.started) return 0;
    return Math.min(s.sequence.length, Math.floor((s.time - s.started) / s.cadence) + 1);
}
const SIDES = ['left', 'right'];
const color = side => (side === 'left' ? METRO.blue : METRO.purple);
const letter = side => (side === 'left' ? 'L' : 'R');

/** Live Tiles: watch a two-tile sequence fill its slots, repeat it, or follow along live for double points. */
export function memory(env) {
    const pick = () => env.random() < .5 ? 'left' : 'right';
    const s = { sequence: [], phase: 'show', started: TILES.rest, cadence: tileCadence(0), index: 0, rounds: 0,
        live: 0, best: 0, bursts: [], ended: false, lastInput: null };
    for (let i = 0; i < TILES.opening; i++) s.sequence.push(pick());
    const tileX = side => (side === 'left' ? 220 : 500);
    function restart(delay) { s.phase = 'show'; s.started = s.time + delay; s.index = 0; s.live = 0; s.cadence = tileCadence(s.rounds); }
    function complete() {
        const count = s.sequence.length, all = s.live === count;
        const bonus = TILES.finishPerTile * count * (all ? 2 : 1);
        s.score += bonus; s.rounds++; s.best = Math.max(s.best, count);
        addBurst(s, all ? `ALL LIVE +${bonus}` : `+${bonus}`, 220, 70);
        addBurst(s, `+1 TILE · ${count + 1}`, 500, 70);
        env.sound?.({ kind: all ? 'powerup' : 'clear', count, chain: Math.min(4, count) });
        s.sequence.push(pick()); restart(TILES.rest);
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !SIDES.includes(event.action)) return;
            const revealed = revealedSteps(s);
            if (s.phase === 'show' && s.index >= revealed) { s.lastInput = { action: event.action, at: s.time, ignored: true }; return; }
            s.lastInput = { action: event.action, at: s.time, ignored: false };
            if (event.action !== s.sequence[s.index]) {
                addBurst(s, 'WRONG', tileX(event.action), 80, false); loseLife(s, env);
                if (!s.ended) restart(TILES.retry);
                return;
            }
            const live = s.phase === 'show', points = live ? TILES.livePoints : TILES.stepPoints;
            s.score += points; s.index++; if (live) s.live++;
            addBurst(s, live ? `LIVE +${points}` : `+${points}`, tileX(event.action), 80);
            env.sound?.({ kind: 'turn', action: event.action });
            if (s.index === s.sequence.length) complete();
        },
        update(s) {
            pruneBursts(s); if (s.ended) return;
            if (s.phase === 'show' && s.time >= s.started + s.sequence.length * s.cadence + .15) s.phase = 'repeat';
        },
        render(s, p) {
            const compact = p.compact, count = s.sequence.length;
            header(p, 'live tiles', `round ${s.rounds + 1} · best ${s.best}`, s.lives);
            const size = compact ? 300 : 220, top = compact ? 150 : 95, gap = compact ? 40 : 60;
            const cue = s.phase === 'show' && s.time >= s.started ? Math.floor((s.time - s.started) / s.cadence) : -1;
            const flashing = cue >= 0 && cue < count && (s.time - s.started) % s.cadence < s.cadence * TILES.litShare;
            const revealed = revealedSteps(s);
            SIDES.forEach((side, i) => {
                const x = 360 - gap / 2 - size + i * (size + gap);
                const lit = flashing && s.sequence[cue] === side;
                const selected = s.lastInput && !s.lastInput.ignored && s.lastInput.action === side && s.time - s.lastInput.at < .3;
                tile(p, x, top, size, size, color(side), letter(side), { lit, selected, size: size * .5, label: i ? 'purple tile' : 'blue tile' });
                if (lit) light(p, `${cue + 1} / ${count}`, x + size / 2, top - (compact ? 26 : 16), compact ? 30 : 22, 'ink', 'center', 400);
            });
            // The slot row is the sequence itself: it fills while tiles flash and empties for the repeat.
            const rowY = top + size + (compact ? 50 : 34), cell = compact ? 46 : 30, pitch = cell + (compact ? 14 : 10);
            for (let i = 0; i < count; i++) {
                const x = 360 - (count * pitch - (pitch - cell)) / 2 + i * pitch, side = s.sequence[i];
                if (s.phase === 'show' && i < revealed) tile(p, x, rowY, cell, cell, color(side), letter(side), { lit: flashing && i === cue, size: cell * .62 });
                else if (s.phase === 'repeat' && i < s.index) tile(p, x, rowY, cell, cell, color(side), letter(side), { size: cell * .62 });
                else if (s.phase === 'repeat' && i === s.index) { p.rect(x, rowY, cell, cell, 'accent'); light(p, '?', x + cell / 2, rowY + cell / 2, cell * .62, METRO.white, 'center', 400); }
                else p.outline(x + 1, rowY + 1, cell - 2, cell - 2, 'border', 2);
            }
            const status = s.phase === 'repeat' ? `your turn · ${s.index + 1} of ${count}` : s.time < s.started ? `get ready · ${count} tiles` : `watch · ${count} tiles · follow live for ×2`;
            light(p, status, 360, rowY + cell + (compact ? 44 : 30), compact ? 32 : 24, 'ink', 'center');
            if (s.lastInput?.ignored && s.time - s.lastInput.at < .6)
                light(p, 'not shown yet', tileX(s.lastInput.action), top + size + (compact ? 24 : 16), compact ? 22 : 16, 'muted', 'center', 400);
            bursts(s, p, env.reducedMotion);
        }
    });
}
