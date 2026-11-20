import { game } from '../../core/game.js?v=eras-3';
import { integer } from '../../core/random.js?v=eras-3';
import { METRO, light, header, tile, scaledTile, meter, ripple, pruneBursts, loseLife, poseTile, tilt, settle as easeOut } from './display.js?v=eras-3';

// Columns are bottom-up stacks, so gravity is implicit. The board never saturates: when the
// best tile reaches `retire` times the floor, every tile below the doubled floor leaves the board.
// One life: a full column ends the run. Each real move refunds `refund` seconds, at most `columns - 1` times per tile.
export const DROP = { columns: 5, rows: 6, budget: 4.2, minBudget: 1.8, chord: .12, retire: 128, variety: [3, 4, 5], refund: .2, cascade: .14, clear: .45, tierPoints: 10,
    colors: [METRO.blue, METRO.purple, METRO.green, METRO.orange, METRO.magenta, METRO.slate] };
export const tileColor = value => DROP.colors[Math.round(Math.log2(value)) % DROP.colors.length];
/** Values that may spawn: `variety` consecutive powers of two starting at the floor. Variety grows with retirements. */
export function spawnRange(floor, variety = DROP.variety[0]) {
    return Array.from({ length: variety }, (_, i) => floor * 2 ** i);
}
export const varietyAfter = retirements => DROP.variety[Math.min(DROP.variety.length - 1, Math.floor(retirements / 2))];
/** Powers of two stay short: 2048 reads 2k, 1048576 reads 1M, then G, T, P and E. */
export function label(value) {
    const unit = Math.min(6, Math.floor(Math.log2(value) / 10));
    return unit ? `${value / 2 ** (unit * 10)}${'kMGTPE'[unit - 1]}` : String(value);
}
export const boardBest = columns => Math.max(2, ...columns.flat());
const clone = columns => columns.map(stack => [...stack]);
/** A merge scores ten points per power of two of the tile it makes (4 → 20, 8 → 30, 1k → 100), times its chain step.
 * Tile values double without bound, so the score must grow with their exponent, not with them: it stays a safe integer. */
export const mergePoints = (value, step) => DROP.tierPoints * Math.round(Math.log2(value)) * step;
/** The stated merge rule: a tile joins every equal neighbour it touches (below, left, right) and doubles once per
 * neighbour, so two tiles make ×2, three make ×4 and four make ×8. Every merge records the board it leaves behind. */
function mergeAt(columns, column, row, run) {
    const stack = columns[column], value = stack[row], left = columns[column - 1], right = columns[column + 1];
    const below = row > 0 && stack[row - 1] === value, l = !!left && left[row] === value, r = !!right && right[row] === value;
    const joined = below + l + r;
    if (!joined) return -1;
    if (l) left.splice(row, 1);
    if (r) right.splice(row, 1);
    if (below) { stack.splice(row - 1, 1); row--; }
    stack[row] = value * 2 ** joined;
    const step = ++run.merges;
    run.events.push({ kind: 'merge', column, row, value: stack[row], step, joined, points: mergePoints(stack[row], step), board: clone(columns) });
    return row;
}
/** Keep merging while equal tiles touch anywhere, lowest and leftmost first, including tiles that just fell.
 * Steps continue the chain in `run`, so a settled board never hides a pair that merges "for free" later. */
export function settle(columns, run = { events: [], merges: 0 }) {
    for (let again = true; again;) {
        again = false;
        for (let r = 0; r < DROP.rows && !again; r++)
            for (let c = 0; c < DROP.columns && !again; c++) if (r < columns[c].length && mergeAt(columns, c, r, run) >= 0) again = true;
    }
    return run.events;
}
/** Land a value and resolve everything it causes: the landed tile's own chain, the board cascade, then
 * retirements (when the best tile reaches `retire` × floor) and the cascade those leave behind.
 * `events` is the replayable story: a `land` frame, `merge` frames and `retire` frames, each with its board. */
export function landTile(columns, column, value, floor = 0) {
    const stack = columns[column];
    if (stack.length >= DROP.rows) return { overflow: true, points: 0, merges: 0, value, row: stack.length, events: [], floor, retired: 0, retirements: 0 };
    stack.push(value);
    const run = { events: [{ kind: 'land', column, row: stack.length - 1, board: clone(columns) }], merges: 0 };
    for (let row = stack.length - 1; row >= 0;) row = mergeAt(columns, column, row, run);
    const landed = run.events.at(-1); // The landed tile after its own chain; later cascades happen elsewhere.
    settle(columns, run);
    let retired = 0, retirements = 0;
    while (floor && boardBest(columns) >= floor * DROP.retire) {
        floor *= 2; retirements++;
        const before = clone(columns), removed = [];
        columns.forEach((stack, c) => stack.forEach((v, r) => { if (v < floor) removed.push({ column: c, row: r, value: v }); }));
        retired += retireBelow(columns, floor);
        run.events.push({ kind: 'retire', floor, removed, before, board: clone(columns) });
        settle(columns, run);
    }
    const points = run.events.reduce((sum, event) => sum + (event.points || 0), 0);
    return { overflow: false, points, merges: run.merges, value: landed.value ?? value, row: landed.row, events: run.events, floor, retired, retirements };
}
export function retireBelow(columns, floor) {
    let removed = 0;
    for (const stack of columns) {
        const kept = stack.filter(value => value >= floor);
        removed += stack.length - kept.length; stack.splice(0, stack.length, ...kept);
    }
    return removed;
}
/** What a merge frame says: its chain step, how many tiles joined, and the points. */
export function mergeText(event) {
    if (event.kind !== 'merge') return '';
    const joined = event.joined === 2 ? 'TRIPLE ×4' : event.joined === 3 ? 'QUAD ×8' : '';
    return [event.step > 1 ? `CHAIN ×${event.step}` : '', joined, `+${event.points}`].filter(Boolean).join(' ');
}

/** Tile Drop: move the waiting tile with L/R (each move buys .2 s), both together drop it now, otherwise it falls at the deadline. */
export function merge(env) {
    const s = { columns: Array.from({ length: DROP.columns }, () => []), column: 2, value: 2, next: 2, floor: 2, best: 2, lives: 1,
        deadline: null, budget: DROP.budget, drops: 0, pending: null, bursts: [], replay: null, notes: [], ended: false, lastMove: null,
        retired: 0, retirements: 0, refunds: 0, longestChain: 0 };
    const draw = () => { const range = spawnRange(s.floor, varietyAfter(s.retirements)); return range[integer(env.random, 0, range.length - 1)]; };
    s.value = draw(); s.next = draw();
    const burst = (text, column, row, good = true, at = s.time, lift = 0) => { s.bursts.push({ text, column, row, good, at, lift }); s.bursts = s.bursts.slice(-8); };
    function schedule() { s.budget = Math.max(DROP.minBudget, DROP.budget / env.pace); s.deadline = s.time + s.budget; s.refunds = 0; }
    function move(action) {
        const column = s.column + (action === 'left' ? -1 : 1);
        if (column < 0 || column >= DROP.columns) { s.lastMove = { action, at: s.time, moved: false }; return; }
        s.column = column; s.lastMove = { action, at: s.time, moved: true }; env.sound?.({ kind: 'turn', action });
        if (s.deadline != null && s.refunds < DROP.columns - 1) { s.deadline += DROP.refund; s.refunds++; }
    }
    function drop() {
        const result = landTile(s.columns, s.column, s.value, s.floor);
        s.drops++;
        if (result.overflow) {
            burst('COLUMN FULL', s.column, DROP.rows - 1, false); loseLife(s, env);
        } else {
            // Rules resolve at once; the story is replayed frame by frame, one merge every .14 s and a .45 s clear-out
            // for retirements, so every tile that vanishes is seen to vanish and every step is named.
            let at = s.time, lift = 0;
            const note = (text, at) => { s.notes.push({ text, at }); s.notes = s.notes.slice(-3); };
            const frames = result.events.map(event => {
                const frame = { ...event, at, sounded: event.kind === 'land' };
                if (event.kind === 'land') at += DROP.cascade; // The tile is seen to land before anything merges.
                if (event.kind === 'merge') { burst(mergeText(event), event.column, event.row, true, at, lift++); at += DROP.cascade; }
                if (event.kind === 'retire') { note(`${label(event.floor / 2)}s cleared · min ${label(event.floor)}`, at); at += DROP.clear; }
                return frame;
            });
            s.replay = { frames, until: at + 1 };
            if (result.points) {
                s.score += result.points; s.longestChain = Math.max(s.longestChain, result.merges);
                const last = frames.findLast(frame => frame.kind === 'merge');
                if (result.merges > 1) note(`chain ×${result.merges} · +${result.points}`, last.at);
            } else env.sound?.({ kind: 'input', action: 'right' });
            s.best = Math.max(s.best, boardBest(s.columns));
            if (result.retirements) { s.retirements += result.retirements; s.retired += result.retired; s.floor = result.floor; }
        }
        if (s.ended) return;
        s.value = Math.max(s.next, s.floor); s.next = draw(); schedule();
    }
    const currentFrame = s => s.replay ? s.replay.frames.findLast(frame => s.time >= frame.at) : null;
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            if (s.pending) {
                if (s.pending.action !== event.action && s.time - s.pending.at <= DROP.chord) { s.pending = null; drop(); return; }
                if (s.pending.action === event.action) return; // A held or duplicated raise is one move.
                move(s.pending.action);
            }
            s.pending = { action: event.action, at: s.time };
        },
        pause(s) { s.pending = null; },
        update(s) {
            pruneBursts(s);
            if (s.replay) {
                for (const frame of s.replay.frames) {
                    if (frame.sounded || s.time < frame.at) continue;
                    frame.sounded = true;
                    if (frame.kind === 'merge') env.sound?.({ kind: frame.step > 1 ? 'clear' : 'bounce', count: frame.joined * 2, chain: frame.step, perfect: frame.step >= 3 || frame.joined >= 2 });
                    else env.sound?.({ kind: 'powerup' });
                }
                if (s.time > s.replay.until) s.replay = null;
            }
            s.notes = s.notes.filter(note => s.time - note.at < 1.6);
            if (s.ended) return;
            if (s.deadline == null) schedule();
            if (s.pending && s.time - s.pending.at > DROP.chord) { move(s.pending.action); s.pending = null; }
            if (s.time >= s.deadline) { if (s.pending) { move(s.pending.action); s.pending = null; } drop(); }
        },
        render(s, p) {
            const compact = p.compact;
            // Clear-outs and chain totals take the header detail for 1.6 s: they are news, not status.
            const note = s.notes.findLast(note => s.time >= note.at);
            header(p, `best ${label(s.best)} · min ${label(s.floor)}`, note ? note.text : `longest chain ${s.longestChain}`);
            // Phone boards size their cells to the stage height so the whole well, waiting tile and preview fit.
            const cell = compact ? Math.max(52, Math.min(100, Math.floor((p.h - 250) / 7.8))) : 43, gap = compact ? (cell > 80 ? 10 : 8) : 5, pitch = cell + gap;
            const width = DROP.columns * pitch - gap, height = DROP.rows * pitch - gap, left = 360 - width / 2;
            const top = compact ? Math.min(330, p.h - 24 - height) : 118, bottom = top + height;
            const reduced = env.reducedMotion;
            const colX = column => left + column * pitch, rowY = row => bottom - (row + 1) * cell - row * gap;
            for (let column = 0; column < DROP.columns; column++) for (let row = 0; row < DROP.rows; row++) p.rect(colX(column), rowY(row), cell, cell, 'soft');
            p.outline(colX(s.column) + 1, top + 1, cell - 2, height - 2, 'border', 2);
            // The board shown is the current replay frame; a retirement first shrinks the cleared tiles away, then the columns settle.
            const frame = currentFrame(s), age = frame ? s.time - frame.at : 0;
            const clearing = frame?.kind === 'retire' && age < DROP.clear;
            const board = frame ? (clearing ? frame.before : frame.board) : s.columns;
            const removed = clearing ? frame.removed : [];
            const merges = s.replay ? s.replay.frames.filter(f => f.kind === 'merge' && s.time >= f.at && s.time - f.at < .6) : [];
            board.forEach((stack, column) => stack.forEach((value, row) => {
                const gone = removed.find(t => t.column === column && t.row === row);
                if (gone) {
                    // Metro clear-out: the tile collapses flat into its own colour line, then the stack settles.
                    const k = env.reducedMotion ? (age < DROP.clear / 2 ? 1 : 0) : Math.max(0, 1 - age / DROP.clear);
                    if (k > 0) scaledTile(p, colX(column), rowY(row), cell, cell, k, tileColor(value), k > .5 ? label(value) : '', { size: cell * .5 * k });
                    if (!env.reducedMotion) p.outline(colX(column) + 2, rowY(row) + 2, cell - 4, cell - 4, tileColor(value), 2);
                    return;
                }
                const merged = merges.find(f => f.column === column && f.row === row);
                const scale = merged ? ripple(p, colX(column), rowY(row), cell, cell, s.time - merged.at, merged.step > 1 || merged.joined > 1 ? 'accent' : tileColor(value), env.reducedMotion) : 1;
                const landed = frame?.kind === 'land' && frame.column === column && frame.row === row && age < .3;
                // The landing tile drops in from the waiting slot with Metro's exponential settle.
                const fall = landed && !reduced && scale === 1 ? -(rowY(row) - (top - cell - (compact ? 20 : 14))) * easeOut(age, 22) : 0;
                if (fall) poseTile(p, colX(column), rowY(row), cell, cell, { dy: fall }, tileColor(value), label(value), { size: label(value).length > 2 ? cell * .38 : cell * .5, selected: true });
                else scaledTile(p, colX(column), rowY(row), cell, cell, scale, tileColor(value), label(value), { size: label(value).length > 2 ? cell * .38 : cell * .5, selected: landed });
            }));
            const waitY = top - cell - (compact ? 20 : 14), moved = s.lastMove && s.lastMove.moved && s.time - s.lastMove.at < .3;
            // The waiting tile glides to its new column and tilts toward the move; an edge bump only tilts.
            const moveAge = s.lastMove ? s.time - s.lastMove.at : 1, direction = s.lastMove?.action === 'left' ? -1 : 1;
            const glide = moved && !reduced ? -direction * pitch * easeOut(moveAge, 18) : 0;
            const lean = s.lastMove && !reduced ? tilt(moveAge, direction, reduced) : {};
            poseTile(p, colX(s.column), waitY, cell, cell, { ...lean, dx: glide }, tileColor(s.value), label(s.value), { size: label(s.value).length > 2 ? cell * .38 : cell * .5, selected: moved });
            if (s.deadline != null) meter(p, colX(s.column), waitY + cell + (compact ? 6 : 3), cell, (s.deadline - s.time) / (s.budget + DROP.refund * (DROP.columns - 1)), 'accent', compact ? 6 : 3);
            const ghost = compact ? 62 : 34, side = 50, infoY = compact ? 118 : waitY;
            const nextX = compact ? left + ghost / 2 : left - side, hintX = compact ? left + width : left + width + side, hintAlign = compact ? 'right' : 'center';
            light(p, 'next', nextX, infoY + (compact ? 0 : 10), compact ? 28 : 15, 'muted', 'center', 400);
            tile(p, nextX - ghost / 2, infoY + (compact ? 18 : 22), ghost, ghost, tileColor(s.next), label(s.next), { size: label(s.next).length > 2 ? ghost * .38 : ghost * .5 });
            light(p, 'L + R together', hintX, infoY + (compact ? 10 : 10), compact ? 28 : 14, 'muted', hintAlign, 400);
            light(p, 'drop now', hintX, infoY + (compact ? 44 : 32), compact ? 30 : 15, 'ink', hintAlign, 400);
            if (s.lastMove && !s.lastMove.moved && s.time - s.lastMove.at < .5) light(p, 'edge', hintX, infoY + (compact ? 80 : 56), compact ? 28 : 14, 'muted', hintAlign, 400);
            for (const b of s.bursts) {
                const burstAge = s.time - b.at; if (burstAge < 0 || burstAge > 1.1) continue;
                // Bursts sit just above their tile and stack upward by step, so a chain never covers its earlier labels; long labels shrink to stay on the canvas.
                const size = (compact ? 36 : 28) * (b.text.length > 12 ? .8 : 1);
                light(p, b.text, Math.max(110, Math.min(610, colX(b.column) + cell / 2)), rowY(b.row) - (compact ? 28 : 18) - (b.lift || 0) * (compact ? 48 : 34) - (env.reducedMotion ? 0 : burstAge * 22), size, b.good ? 'ink' : METRO.orange, 'center', b.good ? 300 : 400);
            }
        }
    });
}
