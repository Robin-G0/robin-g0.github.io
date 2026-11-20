import { game } from '../../core/game.js?v=eras-4';
import { AERO, water, risingBubbles, glass, orb, bubble, glyph, text, header, addBurst, bursts, pruneBursts, addEffect, pruneEffects,
    ring, timerRing, loseLife, isDark, aurora } from './display.js?v=eras-4';

// Bubble Cascade: bubbles float up and gather under the surface in three touching columns.
// Each new bubble rises in the centre pipe; raise L or R to send it up the left or right column,
// or do nothing and it floats straight up the centre. Three or more touching bubbles of one colour
// pop (across columns too); the columns float up to close the gap and new touches pop as a cascade.
export const BUBBLES = { rows: 8, rise: 3.6, minRise: 1.6, dart: .2, group: 3, step: .36, points: 10,
    colorsAt: [[0, 3], [90, 4], [150, 5]], pebbleEvery: [[45, 8], [120, 6]], rainbowChain: 2 };
export const PEBBLE = 9, RAINBOW = 8;
/** Staged content: each milestone adds one new thing to read, announced on the board. */
export const MILESTONES = [[45, 'pebbles'], [90, 'new colour'], [150, 'new colour']];
export const COLORS = [
    { color: AERO.aqua, glyph: 'drop', name: 'aqua' }, { color: AERO.lime, glyph: 'leaf', name: 'leaf' },
    { color: AERO.sun, glyph: 'star', name: 'sun' }, { color: AERO.pink, glyph: 'flower', name: 'bloom' },
    { color: AERO.violet, glyph: 'diamond', name: 'violet' }];
export const riseSeconds = pace => Math.max(BUBBLES.minRise, BUBBLES.rise / pace);
export const colorsAt = time => BUBBLES.colorsAt.filter(([at]) => time >= at).at(-1)[1];
export const pebbleEvery = time => BUBBLES.pebbleEvery.filter(([at]) => time >= at).at(-1)?.[1] ?? 0;
/** A group scores ten times its size squared, times its cascade step: 3 → 90, 4 → 160, 5 → 250. */
export const groupPoints = (size, step) => BUBBLES.points * size * size * step;
const clone = columns => columns.map(column => [...column]);
const neighbours = (c, i) => [[c, i - 1], [c, i + 1], [c - 1, i], [c + 1, i]].filter(([x]) => x >= 0 && x < 3);

/** Groups of three or more touching bubbles of one colour. Pebbles never group. */
export function groupsOf(columns) {
    const seen = new Set(), groups = [];
    for (let c = 0; c < 3; c++) for (let i = 0; i < columns[c].length; i++) {
        const value = columns[c][i];
        if (value === PEBBLE || seen.has(`${c},${i}`)) continue;
        const group = [], queue = [[c, i]]; seen.add(`${c},${i}`);
        while (queue.length) {
            const [x, y] = queue.pop(); group.push([x, y]);
            for (const [nx, ny] of neighbours(x, y)) {
                if (ny < 0 || ny >= columns[nx].length || seen.has(`${nx},${ny}`) || columns[nx][ny] !== value) continue;
                seen.add(`${nx},${ny}`); queue.push([nx, ny]);
            }
        }
        if (group.length >= BUBBLES.group) groups.push(group);
    }
    return groups;
}

/** A rainbow takes the colour it touches above it in its column, else one beside it (left first), else aqua. */
export function rainbowColor(columns, side) {
    const index = columns[side].length;
    for (const value of [columns[side].at(-1), columns[side - 1]?.[index], columns[side + 1]?.[index]]) if (value != null && value !== PEBBLE) return value;
    return 0;
}

/**
 * Lands a bubble at the exposed end of a column, then pops every group, floats the columns up and
 * repeats while new groups touch. Pebbles next to a pop crack and leave too. Returns replay frames,
 * each with the board it leaves, and whether the column now overflows.
 */
export function landBubble(columns, side, value) {
    const landed = value === RAINBOW ? rainbowColor(columns, side) : value;
    columns[side].push(landed);
    const events = [{ kind: 'land', side, index: columns[side].length - 1, value: landed, rainbow: value === RAINBOW, board: clone(columns) }];
    let step = 0, points = 0, popped = 0;
    for (;;) {
        const groups = groupsOf(columns);
        if (!groups.length) break;
        step++;
        const gone = new Set(groups.flat().map(([c, i]) => `${c},${i}`));
        for (const [c, i] of groups.flat()) for (const [nx, ny] of neighbours(c, i))
            if (ny >= 0 && ny < columns[nx].length && columns[nx][ny] === PEBBLE) gone.add(`${nx},${ny}`);
        const cells = [...gone].map(key => { const [c, i] = key.split(',').map(Number); return { c, i, value: columns[c][i] }; });
        const stepPoints = groups.reduce((sum, group) => sum + groupPoints(group.length, step), 0);
        points += stepPoints; popped += cells.length;
        const before = clone(columns);
        for (let c = 0; c < 3; c++) columns[c] = columns[c].filter((_, i) => !gone.has(`${c},${i}`));
        events.push({ kind: 'pop', step, cells, sizes: groups.map(g => g.length), points: stepPoints, before, board: clone(columns) });
    }
    return { events, points, steps: step, popped, value: landed, overflow: columns[side].length > BUBBLES.rows };
}
/** Doing nothing lets the bubble float straight up the centre column. */
export const CENTRE = 1;
export const SIDES = { left: 0, right: 2 };

export function bubbles(env) {
    const s = { time: 0, columns: [[], [], []], current: null, next: 0, count: 0, popped: 0, bestChain: 0, rainbows: 0, colors: 3,
        replay: null, lastInput: null, bursts: [], effects: [], ended: false, stage: 0 };
    function draw() {
        s.count++;
        if (s.rainbows) { s.rainbows--; return RAINBOW; }
        const every = pebbleEvery(s.time);
        if (every && s.count % every === 0) return PEBBLE;
        return Math.floor(env.random() * colorsAt(s.time));
    }
    s.next = draw();
    function spawn() { s.current = { value: s.next, progress: 0, side: null, at: s.time, auto: false }; s.next = draw(); }
    spawn();
    function land() {
        const { side, value } = s.current;
        const result = landBubble(s.columns, side, value);
        s.replay = { frames: result.events.map((event, i) => ({ ...event, at: s.time + (i ? i * BUBBLES.step : 0), sounded: i === 0 })) };
        env.sound?.({ kind: 'turn', action: side === 2 ? 'right' : 'left' });
        if (result.points) {
            s.score += result.points; s.popped += result.popped; s.bestChain = Math.max(s.bestChain, result.steps);
            if (result.steps >= BUBBLES.rainbowChain && !s.rainbows) { s.rainbows = 1; s.replay.rainbow = true; }
        }
        if (result.overflow) {
            addEffect(s, { kind: 'vent', side }); addBurst(s, 'OVERFLOW', [260, 360, 460][side], -1, false, true);
            s.columns[side] = []; s.replay = null;
            loseLife(s, env, 0);
        }
        s.current = null; if (!s.ended) spawn();
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            if (!s.current || s.current.side != null) { s.lastInput = { action: event.action, at: s.time, ignored: true }; return; }
            s.lastInput = { action: event.action, at: s.time, ignored: false };
            s.current.side = SIDES[event.action]; s.current.at = s.time;
        },
        update(s, dt) {
            pruneBursts(s); pruneEffects(s, 1.2);
            if (s.replay) {
                for (const frame of s.replay.frames) {
                    if (frame.sounded || s.time < frame.at) continue;
                    frame.sounded = true;
                    const big = frame.sizes.some(n => n >= 4);
                    env.sound?.({ kind: frame.step >= 2 ? 'powerup' : 'clear', count: frame.cells.length, chain: frame.step, perfect: big });
                    addBurst(s, frame.step >= 2 ? `CASCADE ×${frame.step} +${frame.points}` : `+${frame.points}`, 360, -2 - frame.cells[0].i, true, frame.step >= 2);
                    if (frame.step >= BUBBLES.rainbowChain && s.replay.rainbow) addBurst(s, 'RAINBOW NEXT', 360, -9, true);
                }
                if (s.time > s.replay.frames.at(-1).at + .5) s.replay = null;
            }
            if (s.ended) return;
            const stage = MILESTONES.filter(([at]) => s.time >= at).length;
            if (stage > s.stage) {
                s.stage = stage; addBurst(s, MILESTONES[stage - 1][1].toUpperCase(), 360, -9, false, true); env.sound?.({ kind: 'powerup' });
            }
            const current = s.current;
            if (current.side == null) {
                current.progress += dt / riseSeconds(env.pace);
                if (current.progress >= 1) { current.side = CENTRE; current.auto = true; current.at = s.time; }
            } else if (s.time - current.at >= BUBBLES.dart) {
                if (s.replay) s.replay = null; // A new landing replaces the visual replay; rules were resolved already.
                land();
            }
        },
        render(s, p) {
            const compact = p.compact, h = p.h, t = env.reducedMotion ? 0 : s.time, dark = isDark(p), c = p.c;
            const cell = compact ? Math.min(92, (h - 340) / BUBBLES.rows) : 36, top = compact ? 118 : 50, r = cell * .47;
            const colX = [360 - cell, 360, 360 + cell], bottom = top + BUBBLES.rows * cell;
            const startY = h - (compact ? 70 : 22), forkY = bottom + cell * .75, cellY = i => top + cell / 2 + i * cell;
            water(p, t, { bed: compact });
            if (dark) aurora(p, t, top + 10, { amplitude: 14, opacity: .25, colors: ['#4dffc4', '#5fd6ff'] });
            risingBubbles(p, t, 14, { top, bottom: h });
            // The surface dome: a glass tank that holds both columns.
            glass(p, colX[0] - cell / 2 - 10, top - 14, cell * 3 + 20, BUBBLES.rows * cell + 20, 22, { tint: '#bff3ff', strength: .55 });
            c.save(); c.strokeStyle = AERO.coral; c.lineWidth = 3; c.setLineDash([8, 7]);
            c.beginPath(); c.moveTo(colX[0] - cell / 2 - 26, bottom + 2); c.lineTo(colX[2] + cell / 2 + 26, bottom + 2); c.stroke(); c.restore();
            // Board: the replay frame on screen, the bubbles about to pop glow first.
            let board = s.columns, glowing = new Set();
            if (s.replay) {
                const frames = s.replay.frames, shown = frames.filter(f => s.time >= f.at).at(-1) ?? frames[0], upcoming = frames.find(f => s.time < f.at);
                board = shown.board;
                if (upcoming) for (const cellInfo of upcoming.cells) glowing.add(`${cellInfo.c},${cellInfo.i}`);
            }
            for (let side = 0; side < 3; side++) board[side].forEach((value, i) => {
                const x = colX[side], y = cellY(i) + (env.reducedMotion ? 0 : Math.sin(t * 1.6 + i + side) * 1.5);
                if (glowing.has(`${side},${i}`)) { c.save(); c.shadowColor = '#ffffff'; c.shadowBlur = 24; orb(p, x, y, r + 3, '#ffffff', { opacity: .7 }); c.restore(); }
                drawBubble(p, x, y, r, value);
            });
            if (s.replay) for (const frame of s.replay.frames) {
                if (frame.kind !== 'pop') continue;
                for (const info of frame.cells) ring(p, colX[info.c], cellY(info.i), r, s.time - frame.at, info.value === PEBBLE ? '#c9d3d8' : COLORS[info.value].color, env.reducedMotion);
            }
            for (const e of s.effects) if (e.kind === 'vent') {
                const age = s.time - e.at;
                for (let i = 0; i < 6 && !env.reducedMotion; i++) bubble(p, colX[e.side] + Math.sin(i * 2 + age * 5) * 14, bottom - age * 360 - i * 40, r * .6, Math.max(0, 1 - age));
                ring(p, colX[e.side], bottom - cell, cell, age, AERO.coral, env.reducedMotion, .8);
            }
            // Launch pipe: glass tube up to the fork, with the default route faintly lit.
            glass(p, 360 - r - 8, forkY - 6, 2 * r + 16, startY - forkY + r + 14, r + 8, { tint: '#d8fbff', strength: .5, shadow: false });
            const current = s.current;
            if (current) {
                const side = current.side ?? CENTRE, target = [colX[side], cellY(Math.min(s.columns[side].length, BUBBLES.rows - 1))];
                c.save(); c.globalAlpha = current.side == null ? .35 : .8; c.strokeStyle = current.side == null ? '#ffffff' : AERO.lime; c.lineWidth = 4; c.setLineDash(current.side == null ? [6, 8] : []);
                c.beginPath(); c.moveTo(360, forkY); c.lineTo(target[0], target[1] + r); c.stroke(); c.restore();
                let x = 360, y = startY - (startY - forkY) * Math.min(1, current.progress);
                if (current.side != null) {
                    const u = Math.min(1, (s.time - current.at) / BUBBLES.dart);
                    x = 360 + (target[0] - 360) * u; y = forkY + (target[1] - forkY) * u;
                } else timerRing(p, x, y, r + 7, 1 - current.progress, dark ? '#9fe8ff' : AERO.deep);
                drawBubble(p, x, y, r, current.value, t);
            }
            const nx = 360 + cell * 2.4, ny = (startY + forkY) / 2;
            text(p, 'next', nx + r * .8 + 8, ny, compact ? 28 : 16, 'ink', 'left', 600);
            drawBubble(p, nx, ny, r * .7, s.next, t);
            const pending = MILESTONES.find(([at]) => at > s.time && at - s.time <= 8);
            header(p, `popped ${s.popped}`, pending ? `${pending[1]} in ${Math.ceil(pending[0] - s.time)}s` : s.bestChain ? `best cascade ×${s.bestChain}` : '');
            // Bursts store a row (negative y) so they stay beside the columns whatever the board height.
            bursts(p, { time: s.time, bursts: s.bursts.map(b => (b.y < 0 ? { ...b, x: b.x === 360 ? (compact ? 360 : 560) : b.x, y: b.y === -9 ? top + cell : b.y === -1 ? bottom - cell : cellY(-b.y - 2) } : b)) }, env.reducedMotion);
            if (s.lastInput?.ignored && s.time - s.lastInput.at < .4) ring(p, 360, forkY, r * 1.4, s.time - s.lastInput.at, '#ffffff', env.reducedMotion, .4);
        }
    });
}

/** A coloured bubble carries its glyph; a pebble is matte grey; a rainbow shows bands. */
export function drawBubble(p, x, y, r, value, t = 0) {
    if (value === PEBBLE) { orb(p, x, y, r * .92, AERO.pebble, { matte: true }); return; }
    if (value === RAINBOW) {
        orb(p, x, y, r, '#ffffff'); glyph(p, 'rainbow', x, y, r * .62);
        const c = p.c; c.save(); c.globalAlpha = .55 + .25 * Math.sin(t * 4); bubble(p, x, y, r * 1.12, .8); c.restore(); return;
    }
    const style = COLORS[value]; orb(p, x, y, r, style.color); glyph(p, style.glyph, x, y + r * .08, r * .5);
}
