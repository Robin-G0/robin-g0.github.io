import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { METRO, light, header, tile, addBurst, bursts, pruneBursts, loseLife } from './display.js';

// Seven cells: measured so that planning around the preview clearly outlasts random slides.
export const MERGE = { cells: 7, bag: [2, 2, 2, 2, 2, 2, 4, 4], colors: [METRO.blue, METRO.purple, METRO.green, METRO.orange, METRO.magenta, METRO.slate] };

/** Pack a row leftward, merging each equal pair once. Points are the merged values. */
export function collapse(row) {
    const packed = row.filter(Boolean), result = [];
    let points = 0;
    for (let i = 0; i < packed.length; i++) {
        if (packed[i] === packed[i + 1]) { result.push(packed[i] * 2); points += packed[i] * 2; i++; }
        else result.push(packed[i]);
    }
    while (result.length < row.length) result.push(0);
    return { row: result, points };
}
/** A slide in either direction; merges counts the pairs that joined. */
export function slide(row, direction) {
    const source = direction === 'left' ? [...row] : [...row].reverse();
    const next = collapse(source);
    if (direction === 'right') next.row.reverse();
    const merges = row.filter(Boolean).length - next.row.filter(Boolean).length;
    return { row: next.row, points: next.points, merges, moved: next.row.some((value, i) => value !== row[i]) };
}
export const blocked = row => row.every(Boolean) && !row.some((value, i) => i < row.length - 1 && value === row[i + 1]);

/** Tile Merge: a five-cell row. The previewed tile enters the end you slid away from. */
export function merge(env) {
    const s = { row: Array.from({ length: MERGE.cells }, (_, i) => (i === 0 || i === 2 ? 2 : 0)), bag: [], next: 0, moves: 0, best: 2, resets: 0, bursts: [], ended: false, lastMove: null };
    function draw() {
        if (!s.bag.length) {
            const pool = [...MERGE.bag];
            while (pool.length) s.bag.push(pool.splice(integer(env.random, 0, pool.length - 1), 1)[0]);
        }
        return s.bag.pop();
    }
    s.next = draw();
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            const result = slide(s.row, event.action);
            if (!result.moved) { s.lastMove = { action: event.action, at: s.time, moved: false }; return; }
            s.row = result.row; s.moves++; s.lastMove = { action: event.action, at: s.time, moved: true };
            const points = result.points * result.merges;
            if (points) {
                s.score += points; s.best = Math.max(s.best, ...s.row);
                addBurst(s, result.merges > 1 ? `×${result.merges} +${points}` : `+${points}`, 360, 85);
                env.sound?.({ kind: result.merges > 1 ? 'powerup' : 'clear', count: result.merges * 2 });
            } else env.sound?.({ kind: 'turn', action: event.action });
            s.row[event.action === 'left' ? MERGE.cells - 1 : 0] = s.next; s.next = draw();
            if (blocked(s.row)) {
                addBurst(s, 'BLOCKED', 360, 85, false); loseLife(s, env); s.resets++;
                const keep = Math.max(...s.row); s.row = s.row.map(() => 0); s.row[0] = keep;
            }
        },
        update(s) { pruneBursts(s); },
        render(s, p) {
            const compact = p.compact;
            header(p, 'tile merge', `best ${s.best} · ${s.moves} moves`, s.lives);
            const pitch = Math.floor((compact ? 700 : 600) / MERGE.cells), w = pitch - (compact ? 10 : 13), h = compact ? w * 1.2 : w * 1.15, top = compact ? 300 : 125, left = 360 - (pitch * (MERGE.cells - 1) + w) / 2;
            const recent = s.lastMove && s.time - s.lastMove.at < .3 ? s.lastMove : null;
            s.row.forEach((value, i) => {
                const x = left + i * pitch;
                if (!value) { p.rect(x, top, w, h, 'soft'); return; }
                tile(p, x, top, w, h, MERGE.colors[Math.log2(value) % MERGE.colors.length], value, { size: value >= 1000 ? h * .3 : value >= 100 ? h * .36 : h * .48 });
            });
            // The preview tile waits at both ends; the slide decides which end it enters.
            // Narrow boards show it above the end tiles so nothing leaves the canvas.
            const ghost = compact ? 60 : 44, ghostY = compact ? top - ghost - 16 : top + h / 2 - ghost / 2, right = left + pitch * (MERGE.cells - 1) + w;
            for (const x of compact ? [left, right - ghost] : [left - ghost - 14, right + 14]) {
                p.outline(x, ghostY, ghost, ghost, 'border', 2); light(p, s.next, x + ghost / 2, ghostY + ghost / 2, ghost * .55, 'muted', 'center');
            }
            light(p, `next ${s.next}`, 360, top + h + (compact ? 50 : 34), compact ? 30 : 22, 'muted', 'center');
            if (recent) light(p, recent.moved ? (recent.action === 'left' ? '←' : '→') : 'no move', 360, top - (compact ? 46 : 24), compact ? 40 : 28, recent.moved ? 'ink' : 'muted', 'center');
            light(p, 'equal neighbours merge once per slide', 360, top + h + (compact ? 110 : 72), compact ? 24 : 18, 'muted', 'center', 400);
            bursts(s, p, env.reducedMotion);
        }
    });
}
