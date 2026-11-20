import { game } from '../../core/game.js?v=eras-4';
import { integer } from '../../core/random.js?v=eras-4';
import { type, header, sheet, elevated, ink, chip, swatch, tint, surface, ease, clamp01,
    addBurst, drawBursts, addEffect, addSnack, drawSnacks, prune, backdrop } from './display.js?v=eras-4';

// Ripple Golf: a straight paper fairway of cells. L chips the ball one cell, R drives it three.
// The ball must stop exactly in the cup: a shot past the end of the sheet or into water costs the
// stroke plus a penalty stroke and sends the ball back to the tee. Ripple pads push the ball one more cell.
// Some cells are dead ends (both shots lost from there), so the obvious line is not always safe.
// Each hole pays by strokes against par (the fewest possible); holing out renews the host round clock.
export const GOLF = { chip: 1, drive: 3, sink: .75, hop: .13, slide: .12, par: 50, bogey: 30, other: 10, streak: 10, maxStreak: 50,
    stages: [0, 2, 5, 9] };
const STAGE_TEXT = ['', 'Water: a lost shot goes back to the tee', 'Ripple pads push the ball one cell on', 'Longer holes, more water'];
export const holeStage = holes => GOLF.stages.filter(at => holes >= at).length - 1;
/** Where a shot of `step` cells from `from` comes to rest, through any ripple pads. */
export function landing(cells, from, step) {
    const end = cells.length - 1, path = [];
    let to = from + step;
    for (let i = from + 1; i <= Math.min(to, end); i++) path.push(i);
    if (to > end) return { to: from, kind: 'out', path };
    while (cells[to] === 'pad') { to++; if (to > end) return { to: from, kind: 'out', path, slid: true }; path.push(to); }
    if (cells[to] === 'water') return { to: from, kind: 'water', path, at: to };
    return { to, kind: to === end ? 'cup' : 'ok', path };
}
/** Par is the fewest strokes from `from` (the tee) to the cup (breadth-first); Infinity when the cup cannot be reached. */
export function parOf(cells, from = 0) {
    const end = cells.length - 1, seen = new Map([[from, 0]]), queue = [from];
    while (queue.length) {
        const at = queue.shift();
        for (const step of [GOLF.chip, GOLF.drive]) {
            const result = landing(cells, at, step);
            if (result.kind === 'out' || result.kind === 'water' || seen.has(result.to)) continue;
            seen.set(result.to, seen.get(at) + 1); queue.push(result.to);
        }
    }
    return seen.get(end) ?? Infinity;
}
/** Every cell the ball can come to rest on from the tee. */
export function restingCells(cells) {
    const seen = new Set([0]), queue = [0];
    while (queue.length) {
        const at = queue.shift();
        for (const step of [GOLF.chip, GOLF.drive]) {
            const result = landing(cells, at, step);
            if (result.kind === 'out' || result.kind === 'water' || seen.has(result.to)) continue;
            seen.add(result.to); queue.push(result.to);
        }
    }
    return [...seen];
}
/** Cells a ball can stop on from which the cup can no longer be reached without losing a shot: the planning traps. */
export const deadEnds = cells => restingCells(cells).filter(at => !Number.isFinite(parOf(cells, at)));
/** Does the obvious line (drive whenever the drive is safe, otherwise chip) miss par or run into a dead end? */
export function greedyFails(cells, par) {
    let at = 0, strokes = 0;
    while (at !== cells.length - 1 && strokes <= par + 1) {
        const drive = landing(cells, at, GOLF.drive), result = drive.kind === 'water' || drive.kind === 'out' ? landing(cells, at, GOLF.chip) : drive;
        strokes++;
        if (result.kind === 'water' || result.kind === 'out') return true;
        at = result.to;
    }
    return strokes > par;
}
/** Share of holes, by stage, built so the obvious line fails: the trap is what makes planning matter. */
export const TRAP_SHARE = [0, .25, .5, .6];
export function makeHole(random, holes) {
    const stage = holeStage(holes), trap = random() < TRAP_SHARE[stage];
    const [lo, hi, waters, pads] = [[4, 6, [0, 0], [0, 0]], [5, 8, [1, 1], [0, 0]], [6, 10, [1, 2], [0, 1]], [8, 12, [2, 3], [0, 2]]][stage];
    for (let attempt = 0; attempt < 80; attempt++) {
        const length = integer(random, lo, hi), cells = Array.from({ length: length + 1 }, () => 'grass');
        const free = Array.from({ length: length - 1 }, (_, i) => i + 1);
        const take = () => free.splice(integer(random, 0, free.length - 1), 1)[0];
        for (let i = integer(random, ...waters); i > 0 && free.length; i--) cells[take()] = 'water';
        for (let i = integer(random, ...pads); i > 0 && free.length; i--) cells[take()] = 'pad';
        const par = parOf(cells);
        if (par >= 2 && Number.isFinite(par) && (!trap || attempt >= 60 || greedyFails(cells, par))) return { cells, par };
    }
    const cells = Array.from({ length: lo + 1 }, () => 'grass');
    return { cells, par: parOf(cells) };
}
export function holePoints(strokes, par, streak) {
    if (strokes <= par) return GOLF.par + Math.min(GOLF.maxStreak, GOLF.streak * Math.max(0, streak - 1));
    return strokes === par + 1 ? GOLF.bogey : GOLF.other;
}

export function golf(env) {
    const s = { time: 0, hole: null, ball: 0, strokes: 0, holes: 0, cards: [], stage: 0, parStreak: 0, sinkUntil: -1, solved: false, shot: null,
        bursts: [], effects: [], snacks: [], ended: false };
    function newHole() { s.hole = makeHole(env.random, s.holes); s.ball = 0; s.strokes = 0; s.shot = null; s.solved = false; s.holeAt = s.time; }
    newHole();
    const shotTime = result => result.path.length * GOLF.hop;
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || s.solved || !['left', 'right'].includes(event.action)) return; // Inputs while the ball drops into the cup are harmless.
            const step = event.action === 'left' ? GOLF.chip : GOLF.drive, from = s.ball, result = landing(s.hole.cells, from, step);
            s.strokes++;
            s.shot = { from, step, ...result, at: s.time, action: event.action };
            if (result.kind === 'water' || result.kind === 'out') {
                s.strokes++; s.ball = 0; // Penalty stroke; the ball goes back to the tee.
                addEffect(s, { kind: 'splash', cell: result.kind === 'water' ? result.at : null, at: s.time + shotTime(result), life: 1.6 });
                addBurst(s, result.kind === 'water' ? 'splash · back to tee' : 'off the sheet · back to tee', 0, 0, false);
                s.bursts.at(-1).cell = result.kind === 'water' ? result.at : s.hole.cells.length - 1;
                env.sound?.({ kind: 'thrust' });
                return;
            }
            s.ball = result.to;
            addEffect(s, { kind: 'land', cell: result.to, at: s.time + shotTime(result), life: 1.6 });
            env.sound?.({ kind: 'turn', action: event.action });
            if (result.kind === 'cup') {
                const atPar = s.strokes <= s.hole.par;
                s.parStreak = atPar ? s.parStreak + 1 : 0;
                const points = holePoints(s.strokes, s.hole.par, s.parStreak);
                s.cards.push(s.strokes - s.hole.par); s.cards = s.cards.slice(-6);
                s.score += points; s.holes++; s.solved = true; s.sinkUntil = s.time + shotTime(result) + GOLF.sink;
                addBurst(s, `${atPar ? (s.parStreak > 1 ? `par ×${s.parStreak}` : 'par') : s.strokes === s.hole.par + 1 ? 'bogey' : 'holed'} +${points}`, 0, 0, true);
                s.bursts.at(-1).cell = result.to; s.bursts.at(-1).at = s.time + shotTime(result);
                env.sound?.(atPar ? { kind: 'powerup' } : { kind: 'clear', count: 2 });
                const stage = holeStage(s.holes);
                if (stage > s.stage) { s.stage = stage; addSnack(s, STAGE_TEXT[stage]); s.snacks.at(-1).at = s.sinkUntil; }
            }
        },
        update(s) {
            prune(s); if (s.ended) return;
            if (s.solved && s.time >= s.sinkUntil) { newHole(); }
        },
        render(s, p) { draw(s, p, env.reducedMotion); }
    });
}

function geometry(p, count) {
    const compact = p.compact, k = compact ? 1.6 : 1;
    const size = Math.min(compact ? 104 : 58, (compact ? 620 : 600) / count), left = 360 - size * count / 2 - (compact ? 20 : 0), y = Math.max(compact ? 230 : 150, p.h * .52);
    return { k, size, center: i => [left + size * (i + .5), y],
        card: [left - 16 * k, y - size / 2 - 112 * k, size * count + 32 * k, size + 152 * k] };
}

function draw(s, p, reduced) {
    const c = p.c, cells = s.hole.cells, end = cells.length - 1, G = geometry(p, cells.length), k = G.k, size = G.size;
    backdrop(p);
    header(p, `hole ${s.holes + 1} · par ${s.hole.par}`, `${s.strokes} stroke${s.strokes === 1 ? '' : 's'}`);
    // Staggered entrance of a new hole: the sheet, then its cells one after another.
    const age = s.time - (s.holeAt ?? 0), enter = reduced ? 1 : ease.decelerate(clamp01(age / .3));
    const [cx0, cy0, cw, ch] = G.card;
    c.save(); c.globalAlpha = enter;
    sheet(p, cx0, cy0 + (1 - enter) * 20, cw, ch, 2, { radius: 4 * k });
    c.restore();
    const grass = tint(p, swatch(p, 'green'), surface(p, 2), .78), water = swatch(p, 'blue');
    for (let i = 0; i <= end; i++) {
        const cellAge = reduced ? 1 : ease.decelerate(clamp01((age - .05 - i * .025) / .25));
        const [x, y] = G.center(i), half = size / 2 - 2 * k;
        c.save(); c.globalAlpha = cellAge;
        const kind = cells[i];
        p.rect(x - half, y - half + (1 - cellAge) * 10, half * 2, half * 2, kind === 'water' ? water : grass, 3 * k);
        if (kind === 'water') {
            c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2 * k;
            for (const dy of [-.25, .2]) { c.beginPath(); c.moveTo(x - half * .6, y + dy * size); c.quadraticCurveTo(x - half * .3, y + dy * size - 6 * k, x, y + dy * size); c.quadraticCurveTo(x + half * .3, y + dy * size + 6 * k, x + half * .6, y + dy * size); c.stroke(); }
        }
        if (kind === 'pad') {
            for (const r of [.18, .32]) p.circle(x, y, size * r, 'accent', false);
            const d = size * .42; c.fillStyle = p.color('accent'); c.beginPath();
            c.moveTo(x + d, y); c.lineTo(x + d - 9 * k, y - 7 * k); c.lineTo(x + d - 9 * k, y + 7 * k);
            c.fill();
        }
        if (i === end) {
            p.circle(x, y, size * .2, tint(p, 'ink', 'bg', .1));
            const pole = Math.min(size * 1.1, 60 * k), fx = x + size * .2;
            p.line([[fx, y], [fx, y - pole]], 'ink', 2 * k);
            c.fillStyle = swatch(p, 'pink'); c.beginPath(); c.moveTo(fx, y - pole); c.lineTo(fx + 26 * k, y - pole + 9 * k); c.lineTo(fx, y - pole + 18 * k); c.fill();
        }
        if (i === 0) type(p, 'tee', x, y + size / 2 + 18 * k, 17 * k, 'muted', 'center', 500, true);
        c.restore();
    }
    // Ink ripples where the ball lands, splashes where it does not.
    for (const e of s.effects) {
        if (e.kind !== 'land' && e.kind !== 'splash') continue;
        const [x, y] = e.cell == null ? G.center(end) : G.center(e.cell);
        const clip = cc => { cc.beginPath(); cc.roundRect(cx0, cy0, cw, ch, 4 * k); };
        ink(p, x, y, s.time - e.at, size * (e.kind === 'land' ? 1.2 : .9), e.kind === 'land' ? 'accent' : water, { reduced, clip, duration: .7, alpha: e.kind === 'land' ? .3 : .5 });
    }
    // Landing previews: where each club would stop now. A cross marks a shot that would be lost.
    if (!s.solved && enter >= 1) {
        const placed = [];
        for (const [action, step] of [['left', GOLF.chip], ['right', GOLF.drive]]) {
            const result = landing(cells, s.ball, step), bad = result.kind === 'water' || result.kind === 'out';
            const cell = result.kind === 'out' ? end + 1 : bad ? result.at : result.to;
            const stacked = placed.some(other => Math.abs(other - cell) * size < 80 * k); placed.push(cell); // Chips too close to share a row stack.
            const [x, y] = G.center(cell);
            const px = x, py = y - size / 2 - 24 * k - (stacked ? 40 * k : 0);
            chip(p, px, py, `${action === 'left' ? 'L' : 'R'}${bad ? ' ✕' : ''}`,
                { size: 18 * k, filled: !bad, color: bad ? swatch(p, 'red') : action === 'left' ? 'accent' : swatch(p, 'pink'), minWidth: 34 * k });
        }
    }
    ball(s, p, G, reduced);
    // Scorecard: the last six holes as chips under the sheet, par filled, over par outlined.
    if (s.cards.length) {
        const pitch = 76 * k, x0 = 360 - (s.cards.length - 1) * pitch / 2, y = cy0 + ch + 34 * k;
        s.cards.forEach((over, i) => chip(p, x0 + i * pitch, y, over <= 0 ? 'par' : `+${over}`, { size: 17 * k, filled: over <= 0, color: over <= 0 ? 'accent' : 'muted', minWidth: 62 * k }));
    }
    drawBursts(s, p, reduced, b => { const [x, y] = G.center(b.cell ?? end); return { ...b, x, y: y - size / 2 - 60 * k }; });
    drawSnacks(s, p, reduced);
}

/** The ball is a small white sheet: it lifts (bigger, softer shadow) at the top of each hop and lands with a ripple. */
function ball(s, p, G, reduced) {
    const k = G.k, r = Math.max(10, G.size * .3), shot = s.shot;
    let [x, y] = G.center(s.ball), lift = 0, alpha = 1;
    if (shot && !reduced) {
        const hops = shot.path.length, t = (s.time - shot.at) / GOLF.hop;
        if (t < hops) {
            const index = Math.floor(t), frac = t - index, fromCell = index === 0 ? shot.from : shot.path[index - 1], toCell = shot.path[index];
            const [ax, ay] = G.center(fromCell), [bx, by] = G.center(Math.min(toCell, s.hole.cells.length - 1));
            const e = ease.standard(frac); x = ax + (bx - ax) * e; y = ay + (by - ay) * e;
            const pad = index >= shot.step; lift = pad ? 0 : Math.sin(Math.PI * frac) * G.size * .55;
            if (toCell > s.hole.cells.length - 1) alpha = 1 - frac;
        } else if ((shot.kind === 'water' || shot.kind === 'out') && t < hops + 4) {
            // The lost ball fades where it fell, then reappears on its spot.
            const fell = (t - hops) / 4; alpha = fell < .5 ? 0 : (fell - .5) * 2;
        }
    }
    if (s.solved && s.time > s.sinkUntil - GOLF.sink) { const t = clamp01((s.time - s.sinkUntil + GOLF.sink) / .25); alpha = 1 - t; }
    const c = p.c; c.save(); c.globalAlpha = Math.max(0, alpha);
    const dp = 2 + lift / (G.size * .55) * 10;
    elevated(p, dp, cc => { cc.beginPath(); cc.arc(x, y - lift, r * (1 + lift / G.size * .4), 0, Math.PI * 2); }, surface(p, 8) === '#ffffff' ? '#ffffff' : '#f3edff');
    c.lineWidth = 1.5 * k; c.strokeStyle = p.color('muted'); c.beginPath(); c.arc(x, y - lift, r * (1 + lift / G.size * .4), 0, Math.PI * 2); c.stroke();
    c.restore();
}
