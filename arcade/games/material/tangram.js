import { game } from '../../core/game.js';
import { decodeGesture } from '../../core/commands.js';
import { integer } from '../../core/random.js';
import { type, header, sheet, elevated, ink, progress, chip, swatch, tint, surface, ease, clamp01,
    addBurst, drawBursts, addEffect, addSnack, drawSnacks, prune, loseLife, backdrop } from './display.js';

// Paper Tangram: turn a loose paper piece until it fits its outline. Sweeps turn it a quarter turn
// (left sweep counter-clockwise, right sweep clockwise), a raise flips it over. It drops into the
// outline the moment it matches. Stages unlock by fitted pieces: flips (5), one piece per wrist (12),
// five-square shapes (24). Wrong turns are harmless; only the piece's clock can cost a life.
export const TANGRAM = { limit: 8, minLimit: 4.5, pairFactor: 1.6, lock: .45, recovery: .9, base: 10, clean: 10,
    comboEvery: 4, maxCombo: 4, stages: [0, 5, 12, 24] };
const STAGE_TEXT = ['', 'Mirrored outlines · raise ↑ to flip the piece', 'Two pieces · each wrist turns its own', 'Five-square shapes join'];
export const SHAPES = Object.freeze({
    parallelogram: { tier: 0, color: 'teal', points: [[0, 0], [2, 0], [3, 1], [1, 1]] },
    ell: { tier: 0, color: 'purple', points: [[0, 0], [1, 0], [1, 2], [2, 2], [2, 3], [0, 3]] },
    zigzag: { tier: 0, color: 'pink', points: [[1, 0], [3, 0], [3, 1], [2, 1], [2, 2], [0, 2], [0, 1], [1, 1]] },
    flag: { tier: 0, color: 'amber', points: [[0, 0], [1, 0], [1, 1], [3, 1], [2, 2], [0, 2]] },
    eff: { tier: 1, color: 'indigo', points: [[1, 0], [3, 0], [3, 1], [2, 1], [2, 3], [1, 3], [1, 2], [0, 2], [0, 1], [1, 1]] },
    pea: { tier: 1, color: 'orange', points: [[0, 0], [2, 0], [2, 2], [1, 2], [1, 3], [0, 3]] },
    en: { tier: 1, color: 'blue', points: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 4], [1, 4], [1, 2], [0, 2]] },
    why: { tier: 1, color: 'green', points: [[1, 0], [2, 0], [2, 4], [1, 4], [1, 2], [0, 2], [0, 1], [1, 1]] }
});
const mod4 = n => ((n % 4) + 4) % 4;
/** Mirror (in the piece's own frame) then turn clockwise on screen, y pointing down. */
export function transform(points, turn, mirror) {
    return points.map(([x, y]) => {
        let px = mirror ? -x : x, py = y;
        for (let i = 0; i < mod4(turn); i++) [px, py] = [-py, px];
        return [px, py];
    });
}
export function canon(points, turn, mirror) {
    const moved = transform(points, turn, mirror), mx = Math.min(...moved.map(v => v[0])), my = Math.min(...moved.map(v => v[1]));
    return moved.map(([x, y]) => `${x - mx},${y - my}`).sort().join('|');
}
/** Screen-space operations on an orientation. A horizontal flip of R(t)·F^m is R(−t)·F^(m+1). */
export function applyOp(o, op) {
    if (op === 'cw') return { turn: o.turn + 1, mirror: o.mirror };
    if (op === 'ccw') return { turn: o.turn - 1, mirror: o.mirror };
    return { turn: -o.turn, mirror: !o.mirror };
}
export const fits = (shape, o, target) => canon(SHAPES[shape].points, o.turn, o.mirror) === canon(SHAPES[shape].points, target.turn, target.mirror);
/** Fewest sweeps/raises from an orientation to the outline (breadth-first over the eight orientations). */
export function minimalMoves(shape, from, target) {
    let frontier = [from];
    for (let depth = 0; depth <= 4; depth++) {
        if (frontier.some(o => fits(shape, o, target))) return depth;
        frontier = frontier.flatMap(o => ['cw', 'ccw', 'flip'].map(op => applyOp(o, op)));
    }
    return 4;
}
export const stageFor = fitted => TANGRAM.stages.filter(at => fitted >= at).length - 1;
export const pieceLimit = (pace, pair) => Math.max(TANGRAM.minLimit, TANGRAM.limit / pace) * (pair ? TANGRAM.pairFactor : 1);
const OPS = { left: 'ccw', right: 'cw', up: 'flip' };

export function tangram(env) {
    const s = { time: 0, pieces: [], fitted: 0, stage: 0, streak: 0, combo: 1, best: 0, ids: 0, bag: [], mirrors: [], bagTier: 0,
        bursts: [], effects: [], snacks: [], ended: false };
    const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = integer(env.random, 0, i); [list[i], list[j]] = [list[j], list[i]]; } return list; };
    function nextShape() {
        const tier = s.stage >= 3 ? 1 : 0;
        if (tier !== s.bagTier) { s.bag = []; s.bagTier = tier; }
        if (!s.bag.length) s.bag = shuffle(Object.keys(SHAPES).filter(name => SHAPES[name].tier <= tier));
        return s.bag.pop();
    }
    function nextMirror() {
        if (s.stage < 1) return false;
        if (!s.mirrors.length) s.mirrors = shuffle([false, false, true, true]);
        return s.mirrors.pop();
    }
    function spawn(side) {
        const shape = nextShape(), mirror = nextMirror(), start = { turn: 0, mirror: false };
        let target = { turn: integer(env.random, 0, 3), mirror };
        if (minimalMoves(shape, start, target) === 0) target = { turn: target.turn + 1 + integer(env.random, 0, 1), mirror };
        if (minimalMoves(shape, start, target) === 0) target = { turn: 1, mirror };
        const pair = side >= 0;
        s.pieces.push({ id: ++s.ids, side, shape, turn: 0, mirror: false, target, moves: 0, min: minimalMoves(shape, start, target),
            born: s.time, limit: pieceLimit(env.pace, pair), state: 'live', doneAt: 0, anim: null });
    }
    function refill() {
        const sides = s.stage >= 2 ? [0, 1] : [-1];
        for (const side of sides) if (!s.pieces.some(piece => piece.side === side)) spawn(side);
    }
    refill();
    function fit(piece) {
        piece.state = 'fit'; piece.doneAt = s.time;
        const clean = piece.moves <= piece.min;
        s.streak++; s.combo = Math.min(TANGRAM.maxCombo, 1 + Math.floor((s.streak - 1) / TANGRAM.comboEvery));
        const points = (TANGRAM.base + (clean ? TANGRAM.clean : 0)) * s.combo;
        s.score += points; s.fitted++; s.best = Math.max(s.best, s.combo);
        addBurst(s, `${clean ? 'clean ' : ''}+${points}`, stationX(piece.side), 0, true);
        addEffect(s, { kind: 'fit', id: piece.id, clean, life: 1 });
        env.sound?.(clean ? { kind: 'clear', count: 4, chain: s.combo, perfect: true } : { kind: 'clear', count: 2, chain: s.combo });
        const stage = stageFor(s.fitted);
        if (stage > s.stage) { s.stage = stage; addSnack(s, STAGE_TEXT[stage]); env.sound?.({ kind: 'powerup' }); }
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            const gesture = decodeGesture(event.action); if (!gesture || !OPS[gesture.direction]) return;
            const piece = s.stage >= 2 && s.pieces.some(item => item.side >= 0)
                ? s.pieces.find(item => item.side === (gesture.wrist === 'left' ? 0 : 1))
                : s.pieces.find(item => item.side === -1) || s.pieces[0];
            if (!piece || piece.state !== 'live') return; // A piece already fitting or crumpling: harmless.
            const op = OPS[gesture.direction], next = applyOp(piece, op);
            piece.anim = { op, from: { turn: piece.turn, mirror: piece.mirror }, at: s.time };
            piece.turn = next.turn; piece.mirror = next.mirror; piece.moves++;
            addEffect(s, { kind: 'press', id: piece.id, op, life: .6 });
            env.sound?.({ kind: 'turn', action: op === 'ccw' ? 'left' : 'right' });
            if (fits(piece.shape, piece, piece.target)) fit(piece);
        },
        update(s) {
            prune(s); if (s.ended) return;
            for (const piece of s.pieces) {
                if (piece.state !== 'live' || s.time - piece.born < piece.limit) continue;
                piece.state = 'crumple'; piece.doneAt = s.time; s.streak = 0; s.combo = 1;
                addBurst(s, 'time', stationX(piece.side), 0, false);
                // A shared recovery: the other piece's clock waits, so one lapse never costs two lives at once.
                for (const other of s.pieces) if (other !== piece && other.state === 'live') other.born = Math.min(s.time, other.born + TANGRAM.recovery);
                loseLife(s, env); if (s.ended) return;
            }
            s.pieces = s.pieces.filter(piece => piece.state === 'live' || s.time - piece.doneAt < (piece.state === 'fit' ? TANGRAM.lock : TANGRAM.recovery));
            if (s.stage >= 2 && s.pieces.some(piece => piece.side === -1)) return; // The last single piece finishes first.
            refill();
        },
        render(s, p) { draw(s, p, env.reducedMotion); }
    });
}

const stationX = side => (side < 0 ? 360 : side === 0 ? 186 : 534);
function layout(p, pair) {
    const compact = p.compact, top = compact ? 96 : 54, bottom = p.h - (compact ? 40 : 14);
    const width = pair ? (compact ? 336 : 318) : (compact ? 560 : 360);
    const avail = bottom - top, slotH = Math.min(avail * .46, compact ? 520 : 170), pieceTop = top + slotH + (compact ? 30 : 12);
    const pieceH = bottom - pieceTop;
    const unit = Math.min((width - 40) / 4.4, (slotH - 34) / 4.4, (pieceH - 24) / 4.6, compact ? 64 : 34);
    return { compact, top, width, slotH, unit, pieceY: pieceTop + pieceH / 2, k: compact ? 1.6 : 1 };
}
function polygon(c, points, unit, cx, cy) {
    const xs = points.map(v => v[0]), ys = points.map(v => v[1]);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2;
    c.beginPath(); points.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](cx + (x - ox) * unit, cy + (y - oy) * unit)); c.closePath();
}
/** Piece outline at an orientation, centred on its bounding box so turning keeps it in place. */
function shapePath(shape, turn, mirror, unit, cx, cy) {
    const pts = transform(SHAPES[shape].points, turn, mirror);
    return c => polygon(c, pts, unit, cx, cy);
}
/** Circular-arrow icon button: the turn controls live beside the piece because the six buttons only show arrows. */
function turnIcon(p, x, y, r, clockwise, color) {
    const c = p.c; c.save(); c.strokeStyle = p.color(color); c.fillStyle = p.color(color); c.lineWidth = Math.max(2.5, r * .2); c.lineCap = 'round';
    const a0 = clockwise ? -Math.PI * .85 : -Math.PI * .15, a1 = clockwise ? Math.PI * .35 : -Math.PI * 1.35;
    c.beginPath(); c.arc(x, y, r * .55, a0, a1, !clockwise); c.stroke();
    const ex = x + Math.cos(a1) * r * .55, ey = y + Math.sin(a1) * r * .55, tangent = a1 + (clockwise ? Math.PI / 2 : -Math.PI / 2), h = r * .38;
    c.beginPath(); c.moveTo(ex + Math.cos(tangent) * h, ey + Math.sin(tangent) * h);
    c.lineTo(ex + Math.cos(tangent + 2.3) * h, ey + Math.sin(tangent + 2.3) * h); c.lineTo(ex + Math.cos(tangent - 2.3) * h, ey + Math.sin(tangent - 2.3) * h);
    c.closePath(); c.fill(); c.restore();
}
function flipIcon(p, x, y, r, color) {
    const c = p.c; c.save(); c.fillStyle = c.strokeStyle = p.color(color); c.lineWidth = Math.max(2, r * .12);
    c.beginPath(); c.moveTo(x - r * .12, y - r * .5); c.lineTo(x - r * .12, y + r * .5); c.lineTo(x - r * .62, y + r * .5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + r * .12, y - r * .5); c.lineTo(x + r * .12, y + r * .5); c.lineTo(x + r * .62, y + r * .5); c.closePath(); c.stroke();
    c.restore();
}

function draw(s, p, reduced) {
    const pair = s.pieces.some(piece => piece.side >= 0), L = layout(p, pair), k = L.k;
    backdrop(p);
    header(p, `${s.fitted} fitted`, s.combo > 1 ? `combo ×${s.combo}` : '');
    for (const piece of s.pieces) station(s, p, piece, L, k, reduced, pair);
    drawBursts(s, p, reduced, b => ({ ...b, y: L.top + (L.compact ? 40 : 24) }));
    drawSnacks(s, p, reduced);
}

function station(s, p, piece, L, k, reduced, pair) {
    const c = p.c, cx = stationX(piece.side), u = L.unit, color = swatch(p, SHAPES[piece.shape].color);
    const left = cx - L.width / 2, top = L.top, slotY = top + L.slotH / 2 - 6 * k;
    // Entrance: the sheet and its piece rise in, staggered (sheet first), on the decelerate curve.
    const age = s.time - piece.born, enter = reduced ? 1 : ease.decelerate(clamp01(age / .3)), pieceEnter = reduced ? 1 : ease.decelerate(clamp01((age - .08) / .3));
    c.save(); c.globalAlpha = enter;
    sheet(p, left, top + (1 - enter) * 16, L.width, L.slotH, 1, { radius: 4 * k });
    // The outline is pressed into the sheet: a pale debossed fill and a dashed edge.
    const outline = shapePath(piece.shape, piece.target.turn, piece.target.mirror, u, cx, slotY + (1 - enter) * 16);
    const fitted = piece.state === 'fit';
    c.fillStyle = tint(p, 'bg', 'ink', .07); outline(c); c.fill();
    c.setLineDash([6 * k, 5 * k]); c.lineWidth = 2 * k; c.strokeStyle = p.color('muted'); outline(c); c.stroke(); c.setLineDash([]);
    // The piece's clock is the sheet's linear progress indicator.
    const remaining = piece.state === 'live' ? 1 - (s.time - piece.born) / piece.limit : piece.state === 'fit' ? 1 : 0;
    progress(p, left + 16 * k, top + L.slotH - 14 * k, L.width - 32 * k, remaining, remaining < .3 ? swatch(p, 'red') : 'accent', 4 * k);
    if (pair) chip(p, left + 26 * k, top + 22 * k, piece.side ? 'R' : 'L', { size: 15 * k, filled: true, color: 'accent', minWidth: 30 * k });
    c.restore();

    const pressed = s.effects.filter(e => e.kind === 'press' && e.id === piece.id).at(-1);
    const iconR = 22 * k, iconY = L.pieceY, iconDX = Math.min(L.width / 2 - iconR - 4, u * 2.6 + iconR);
    if (piece.state === 'live') {
        const icons = [['ccw', cx - iconDX, iconY], ['cw', cx + iconDX, iconY]];
        if (s.stage >= 1) icons.push(['flip', cx, L.pieceY - u * 2.35 - iconR * .4]);
        for (const [op, x, y] of icons) {
            const hot = pressed && pressed.op === op && s.time - pressed.at < .5;
            c.save(); c.beginPath(); c.arc(x, y, iconR, 0, Math.PI * 2); c.fillStyle = surface(p, 2); c.fill();
            c.lineWidth = 1.5; c.strokeStyle = p.color(hot ? 'accent' : 'border'); c.stroke(); c.restore();
            if (hot) ink(p, x, y, s.time - pressed.at, iconR, 'accent', { reduced, duration: .5, alpha: .35, clip: cc => { cc.beginPath(); cc.arc(x, y, iconR, 0, Math.PI * 2); } });
            if (op === 'flip') flipIcon(p, x, y, iconR, hot ? 'accent' : 'muted'); else turnIcon(p, x, y, iconR, op === 'cw', hot ? 'accent' : 'muted');
        }
    }

    // The loose piece floats at 8 dp; a press lifts it to 12 dp while it turns (elevation lift on press).
    let x = cx, y = L.pieceY + (1 - pieceEnter) * 40 * k, angle = piece.turn * 90, scaleX = 1, dp = 8, alpha = pieceEnter, scale = 1;
    let turn = piece.turn, mirror = piece.mirror;
    if (piece.anim && piece.state === 'live') {
        const t = clamp01((s.time - piece.anim.at) / (piece.anim.op === 'flip' ? .3 : .22)), e = reduced ? 1 : ease.standard(t);
        if (piece.anim.op === 'flip' && e < 1) { turn = piece.anim.from.turn; mirror = piece.anim.from.mirror; angle = turn * 90; scaleX = Math.cos(Math.PI * e); }
        else if (piece.anim.op !== 'flip') angle = piece.anim.from.turn * 90 + (piece.turn - piece.anim.from.turn) * 90 * e;
        if (!reduced) dp = 8 + 4 * Math.sin(Math.PI * t);
    }
    if (piece.state === 'fit') {
        // Shared-element transition: the piece travels into its outline and settles to 0 dp.
        const t = reduced ? 1 : ease.standard(clamp01((s.time - piece.doneAt) / .3));
        y = L.pieceY + (slotY - L.pieceY) * t; dp = 8 * (1 - t);
    }
    if (piece.state === 'crumple') {
        const t = clamp01((s.time - piece.doneAt) / .5);
        scale = reduced ? 1 : 1 - .75 * ease.accelerate(t); alpha = 1 - t * .85; dp = 2;
    }
    c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(scaleX * scale, scale); c.rotate((angle - turn * 90) * Math.PI / 180);
    const body = shapePath(piece.shape, turn, mirror, u, 0, 0);
    elevated(p, dp, body, piece.state === 'crumple' ? tint(p, color, 'bg', .45) : color);
    // A subtle paper fold: a lighter top edge so the sheet reads as card stock, not a flat vector.
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.35)'; body(c); c.stroke();
    if (piece.state === 'crumple') { c.lineWidth = 3 * k; c.strokeStyle = swatch(p, 'red'); body(c); c.stroke(); }
    c.restore();
    if (piece.state === 'fit') {
        const fx = s.effects.find(e => e.kind === 'fit' && e.id === piece.id);
        if (fx) ink(p, cx, slotY, s.time - fx.at - .2, L.width * .6, fx.clean ? 'accent' : 'muted', { reduced, duration: .7, alpha: .28,
            clip: roundClip(cx - L.width / 2, top, L.width, L.slotH, 4 * k) });
    }
}
const roundClip = (x, y, w, h, r) => c => { c.beginPath(); c.roundRect(x, y, w, h, r); };
