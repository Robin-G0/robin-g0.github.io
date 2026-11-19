import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { METRO, light, header, tile, meter, pruneBursts, loseLife } from './display.js';

// Columns are bottom-up stacks, so gravity is implicit. The board never saturates: when the
// best tile reaches `retire` times the floor, every tile below the doubled floor leaves the board.
// One life: a full column ends the run. Each real move refunds `refund` seconds, at most `columns - 1` times per tile.
export const DROP = { columns: 5, rows: 6, budget: 4.2, minBudget: 1.8, chord: .12, retire: 128, variety: [3, 4, 5], refund: .2,
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
/** Land a value in a column and resolve chained merges with the tile below and both side neighbours. */
export function landTile(columns, column, value) {
    const stack = columns[column];
    if (stack.length >= DROP.rows) return { overflow: true, points: 0, merges: 0, value, row: stack.length };
    stack.push(value);
    let points = 0, merges = 0, current = value;
    for (;;) {
        const i = stack.length - 1, left = columns[column - 1], right = columns[column + 1];
        const below = i > 0 && stack[i - 1] === current, l = !!left && left[i] === current, r = !!right && right[i] === current;
        const joined = below + l + r;
        if (!joined) break;
        if (l) left.splice(i, 1);
        if (r) right.splice(i, 1);
        if (below) stack.splice(i - 1, 1);
        current *= 2 ** joined; stack[stack.length - 1] = current;
        merges++; points += current * merges;
    }
    return { overflow: false, points, merges, value: current, row: stack.length - 1 };
}
export function retireBelow(columns, floor) {
    let removed = 0;
    for (const stack of columns) {
        const kept = stack.filter(value => value >= floor);
        removed += stack.length - kept.length; stack.splice(0, stack.length, ...kept);
    }
    return removed;
}

/** Tile Drop: move the waiting tile with L/R (each move buys .2 s), both together drop it now, otherwise it falls at the deadline. */
export function merge(env) {
    const s = { columns: Array.from({ length: DROP.columns }, () => []), column: 2, value: 2, next: 2, floor: 2, best: 2, lives: 1,
        deadline: null, budget: DROP.budget, drops: 0, pending: null, bursts: [], ended: false, lastMove: null, lastLanding: null, retired: 0, retirements: 0, refunds: 0 };
    const draw = () => { const range = spawnRange(s.floor, varietyAfter(s.retirements)); return range[integer(env.random, 0, range.length - 1)]; };
    s.value = draw(); s.next = draw();
    const burst = (text, column, row, good = true) => { s.bursts.push({ text, column, row, good, at: s.time }); s.bursts = s.bursts.slice(-6); };
    function schedule() { s.budget = Math.max(DROP.minBudget, DROP.budget / env.pace); s.deadline = s.time + s.budget; s.refunds = 0; }
    function move(action) {
        const column = s.column + (action === 'left' ? -1 : 1);
        if (column < 0 || column >= DROP.columns) { s.lastMove = { action, at: s.time, moved: false }; return; }
        s.column = column; s.lastMove = { action, at: s.time, moved: true }; env.sound?.({ kind: 'turn', action });
        if (s.deadline != null && s.refunds < DROP.columns - 1) { s.deadline += DROP.refund; s.refunds++; }
    }
    function drop() {
        const result = landTile(s.columns, s.column, s.value);
        s.drops++;
        if (result.overflow) {
            burst('COLUMN FULL', s.column, DROP.rows - 1, false); loseLife(s, env);
        } else {
            s.lastLanding = { column: s.column, row: result.row, at: s.time };
            if (result.points) {
                s.score += result.points;
                burst(result.merges > 1 ? `×${result.merges} +${label(result.points)}` : `+${label(result.points)}`, s.column, result.row);
                env.sound?.({ kind: 'clear', count: result.merges * 2, chain: result.merges });
            } else env.sound?.({ kind: 'input', action: 'right' });
            s.best = Math.max(s.best, boardBest(s.columns));
            if (s.best >= s.floor * DROP.retire) {
                s.floor *= 2; s.retirements++; s.retired += retireBelow(s.columns, s.floor);
                burst(`${label(s.floor / 2)}s RETIRE`, 2, DROP.rows - 1); env.sound?.({ kind: 'powerup' });
            }
        }
        if (s.ended) return;
        s.value = Math.max(s.next, s.floor); s.next = draw(); schedule();
    }
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
            pruneBursts(s); if (s.ended) return;
            if (s.deadline == null) schedule();
            if (s.pending && s.time - s.pending.at > DROP.chord) { move(s.pending.action); s.pending = null; }
            if (s.time >= s.deadline) { if (s.pending) { move(s.pending.action); s.pending = null; } drop(); }
        },
        render(s, p) {
            const compact = p.compact;
            header(p, 'tile drop', `best ${label(s.best)} · min ${label(s.floor)}`, s.lives, 0);
            const cell = compact ? 100 : 43, gap = compact ? 10 : 5, pitch = cell + gap;
            const width = DROP.columns * pitch - gap, height = DROP.rows * pitch - gap, left = 360 - width / 2;
            const top = compact ? 330 : 118, bottom = top + height;
            const colX = column => left + column * pitch, rowY = row => bottom - (row + 1) * cell - row * gap;
            for (let column = 0; column < DROP.columns; column++) for (let row = 0; row < DROP.rows; row++) p.rect(colX(column), rowY(row), cell, cell, 'soft');
            p.outline(colX(s.column) + 1, top + 1, cell - 2, height - 2, 'border', 2);
            s.columns.forEach((stack, column) => stack.forEach((value, row) => {
                const landed = s.lastLanding && s.lastLanding.column === column && s.lastLanding.row === row && s.time - s.lastLanding.at < .3;
                tile(p, colX(column), rowY(row), cell, cell, tileColor(value), label(value), { size: label(value).length > 2 ? cell * .38 : cell * .5, selected: landed });
            }));
            const waitY = top - cell - (compact ? 28 : 14), moved = s.lastMove && s.lastMove.moved && s.time - s.lastMove.at < .3;
            tile(p, colX(s.column), waitY, cell, cell, tileColor(s.value), label(s.value), { size: label(s.value).length > 2 ? cell * .38 : cell * .5, selected: moved });
            if (s.deadline != null) meter(p, colX(s.column), waitY + cell + (compact ? 6 : 3), cell, (s.deadline - s.time) / (s.budget + DROP.refund * (DROP.columns - 1)), 'accent', compact ? 6 : 3);
            const ghost = compact ? 62 : 34, side = 50, infoY = compact ? 118 : waitY;
            const nextX = compact ? left + ghost / 2 : left - side, hintX = compact ? left + width : left + width + side, hintAlign = compact ? 'right' : 'center';
            light(p, 'next', nextX, infoY + (compact ? 0 : 10), compact ? 24 : 15, 'muted', 'center', 400);
            tile(p, nextX - ghost / 2, infoY + (compact ? 18 : 22), ghost, ghost, tileColor(s.next), label(s.next), { size: label(s.next).length > 2 ? ghost * .38 : ghost * .5 });
            light(p, 'L ←  → R', hintX, infoY + (compact ? 10 : 10), compact ? 26 : 15, 'ink', hintAlign, 400);
            light(p, 'both: drop now', hintX, infoY + (compact ? 48 : 34), compact ? 24 : 14, 'muted', hintAlign, 400);
            if (s.lastMove && !s.lastMove.moved && s.time - s.lastMove.at < .5) light(p, 'edge', hintX, infoY + (compact ? 86 : 58), compact ? 24 : 14, 'muted', hintAlign, 400);
            for (const b of s.bursts) {
                const age = s.time - b.at; if (age > 1.1) continue;
                light(p, b.text, Math.max(70, Math.min(650, colX(b.column) + cell / 2)), rowY(b.row) - (env.reducedMotion ? 0 : age * 22), compact ? 36 : 28, b.good ? 'ink' : METRO.orange, 'center', b.good ? 300 : 400);
            }
        }
    });
}
