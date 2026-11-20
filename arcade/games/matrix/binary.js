import { game } from '../../core/game.js';
import { mono, header, rain, cursor, addBurst, bursts, pruneBursts, addEffect, pruneEffects, ripple, cells, GLYPHS } from './display.js';

// Binary Lock: a register of bits must be made equal to the KEY above it. L rotates the whole register
// one cell left (the head bit wraps to the end); R flips the bit under the cursor at the head. Each lock
// is generated at an exact shortest solution (par) by breadth-first search, so planning the order of
// rotations and flips is the skill. Later locks add a fifth bit, a sealed cell that cannot be flipped
// at the head, and a sixth bit. The host round clock (24 s, shrinking) renews on every solved lock.
export const BINARY = { solveSeconds: 1.1, loadSeconds: .45, rotateSeconds: .18, perLevel: 20, cleanRun: 3,
    stages: [{ lock: 1, bits: 4, sealed: 0 }, { lock: 4, bits: 5, sealed: 0 }, { lock: 7, bits: 5, sealed: 1 }, { lock: 11, bits: 6, sealed: 1 }] };
export const stageFor = lock => BINARY.stages.filter(stage => lock >= stage.lock).at(-1);
export const depthFor = (lock, bits) => Math.min(bits + 2, 2 + Math.floor((lock - 1) / 2));
export const rotate = (list) => [...list.slice(1), list[0]];
const key = (bits, sealed) => bits.join('') + '/' + sealed.join('');

/** Applies one move. A flip at a sealed head is refused and leaves the register unchanged. */
export function apply(bits, sealed, action) {
    if (action === 'left') return { bits: rotate(bits), sealed: rotate(sealed), changed: true };
    if (sealed[0]) return { bits, sealed, changed: false };
    const next = [...bits]; next[0] = 1 - next[0];
    return { bits: next, sealed, changed: true };
}
/** Shortest number of moves from a register to the key, by breadth-first search. */
export function shortest(bits, sealed, target) {
    const goal = target.join(''), seen = new Set([key(bits, sealed)]);
    let frontier = [{ bits, sealed }];
    for (let depth = 0; frontier.length; depth++) {
        const next = [];
        for (const state of frontier) {
            if (state.bits.join('') === goal) return depth;
            for (const action of ['left', 'right']) {
                const moved = apply(state.bits, state.sealed, action), id = key(moved.bits, moved.sealed);
                if (moved.changed && !seen.has(id)) { seen.add(id); next.push(moved); }
            }
        }
        frontier = next;
    }
    return Infinity;
}
/** The optimal next move from a state (used by tests and nothing in play: no hints are shown). */
export function bestMove(bits, sealed, target) {
    let best = null;
    for (const action of ['left', 'right']) {
        const moved = apply(bits, sealed, action); if (!moved.changed) continue;
        const cost = shortest(moved.bits, moved.sealed, target);
        if (!best || cost < best.cost) best = { action, cost };
    }
    return best?.action;
}
/** A lock whose shortest solution is exactly `depth` moves (or the deepest available below it). */
export function makeLock(random, bits, sealedCount, depth) {
    const pick = () => (random() < .5 ? 0 : 1);
    const target = Array.from({ length: bits }, pick);
    const sealed = Array(bits).fill(0);
    if (sealedCount) sealed[1 + Math.floor(random() * (bits - 1))] = 1;
    let best = null;
    for (let attempt = 0; attempt < 60; attempt++) {
        const register = Array.from({ length: bits }, pick);
        const par = shortest(register, sealed, target);
        if (!Number.isFinite(par) || par === 0) continue;
        if (par === depth) return { target, bits: register, sealed: [...sealed], par };
        if (par < depth && (!best || par > best.par)) best = { target, bits: register, sealed: [...sealed], par };
    }
    if (best) return best;
    const register = [...target]; register[sealed[0] ? 1 : 0] ^= 1; // Always solvable: a single differing bit.
    return { target, bits: register, sealed: [...sealed], par: shortest(register, sealed, target) };
}

export function binary(env) {
    const s = { lock: 1, moves: 0, par: 0, bits: [], target: [], sealed: [], cleanRun: 0, cleanBest: 0, solvedCount: 0,
        solved: false, solvedAt: -10, loadedAt: 0, knownLives: 3, refusedAt: -10, bursts: [], effects: [], ended: false };
    function load() {
        const stage = stageFor(s.lock), lock = makeLock(env.random, stage.bits, stage.sealed, depthFor(s.lock, stage.bits));
        Object.assign(s, { bits: lock.bits, target: lock.target, sealed: lock.sealed, par: lock.par, moves: 0, loadedAt: s.time, solved: false });
        if (BINARY.stages.some(item => item.lock === s.lock && item.lock > 1))
            addBurst(s, stage.sealed && !stageFor(s.lock - 1).sealed ? 'NEW: SEALED BIT' : `NEW: ${stage.bits} BITS`, 360, s.bannerY ?? 360);
    }
    load();
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || s.solved || !['left', 'right'].includes(event.action)) return;
            const moved = apply(s.bits, s.sealed, event.action);
            if (!moved.changed) { s.refusedAt = s.time; return; } // A sealed head refuses the flip harmlessly.
            s.bits = moved.bits; s.sealed = moved.sealed; s.moves++;
            addEffect(s, { kind: event.action === 'left' ? 'rotate' : 'flip' });
            env.sound?.({ kind: 'turn', action: event.action });
            if (s.bits.join('') !== s.target.join('')) return;
            const clean = s.moves <= s.par, points = BINARY.perLevel * s.par * (clean ? 2 : 1);
            s.score += points; s.solvedCount++; s.solved = true; s.solvedAt = s.time;
            s.cleanRun = clean ? s.cleanRun + 1 : 0; s.cleanBest = Math.max(s.cleanBest, s.cleanRun);
            addBurst(s, clean ? `CLEAN x2 +${points}` : `UNLOCKED +${points}`, 360, s.burstY ?? 120);
            env.sound?.({ kind: clean ? 'powerup' : 'clear', count: s.par });
            if (clean && s.cleanRun % BINARY.cleanRun === 0 && s.lives < 3) {
                s.lives++; s.knownLives = s.lives; addBurst(s, '+1 ATTEMPT', 360, (s.burstY ?? 120) + 40);
            }
        },
        update(s) {
            pruneBursts(s); pruneEffects(s, 1.2); if (s.ended) return;
            // The host round clock spends an attempt when a lock is not opened in time: load a fresh one.
            if (s.lives < s.knownLives) {
                s.knownLives = s.lives; s.cleanRun = 0;
                if (s.lives > 0) { addBurst(s, 'TRACE LOST', 360, s.burstY ?? 120, false); env.sound?.({ kind: 'miss' }); load(); }
                return;
            }
            if (s.solved && s.time - s.solvedAt >= BINARY.solveSeconds) { s.lock++; load(); }
        },
        render(s, p) {
            const compact = p.compact, h = p.h, k = compact ? 1.5 : 1, reduced = env.reducedMotion, c = p.c, n = s.bits.length;
            header(p, `lock ${s.lock}`, `par ${s.par} · moves ${s.moves}`, s.time, reduced);
            rain(p, s.time, { top: 60, bottom: h, columns: 18, alpha: s.solved ? .32 : .12, size: 16 * k, reduced, speed: s.solved ? 3 : 1 });
            const pitch = Math.min(compact ? 108 : 96, 640 / n), cw = pitch - (compact ? 16 : 18), left = 360 - (n * pitch) / 2 + (pitch - cw) / 2;
            const keyY = compact ? h * .26 : 112, regY = compact ? h * .43 : 220, ch = cw * 1.25;
            s.burstY = keyY - 48 * k; s.bannerY = regY + ch + 90 * k;
            const xOf = i => left + i * pitch;
            const load = Math.min(1, (s.time - s.loadedAt) / BINARY.loadSeconds);
            // Padlock: the shackle lifts as the lock opens.
            const lockX = 360, lockY = keyY - (compact ? 120 : 58), lift = s.solved ? Math.min(1, (s.time - s.solvedAt) / .3) * 16 * k : 0;
            c.save(); c.strokeStyle = p.color(s.solved ? 'gold' : 'accent'); c.lineWidth = 4 * k; c.beginPath();
            c.arc(lockX, lockY - lift, 12 * k, Math.PI, 0); c.lineTo(lockX + 12 * k, lockY + 6 * k - (s.solved ? lift : 0)); c.moveTo(lockX - 12 * k, lockY - lift); c.lineTo(lockX - 12 * k, lockY + 6 * k); c.stroke(); c.restore();
            p.rect(lockX - 19 * k, lockY + 4 * k, 38 * k, 26 * k, s.solved ? 'gold' : 'accent');
            p.rect(lockX - 3 * k, lockY + 12 * k, 6 * k, 10 * k, 'bg');
            mono(p, 'KEY', left - 14, keyY, 20 * k, 'muted', 'right');
            for (let i = 0; i < n; i++) {
                const x = xOf(i), on = s.target[i] === 1, kh = cw * .7;
                if (on) p.rect(x, keyY - kh / 2, cw, kh, 'soft'); p.outline(x, keyY - kh / 2, cw, kh, on ? 'ink' : 'border', 2);
                mono(p, s.target[i], x + cw / 2, keyY, kh * .62, on ? 'ink' : 'muted', 'center');
            }
            // Register cells: 1 is a lit block, 0 is hollow; a sealed cell is hatched. Code decodes into each cell on load.
            const rotateAge = s.effects.filter(e => e.kind === 'rotate').map(e => s.time - e.at).find(age => age < BINARY.rotateSeconds);
            const shift = rotateAge != null && !reduced ? 1 - rotateAge / BINARY.rotateSeconds : 0;
            for (let i = 0; i < n; i++) {
                let x = xOf(i) + shift * pitch, y = regY;
                if (i === n - 1 && shift) { x = xOf(0) + (xOf(n - 1) - xOf(0)) * (1 - shift); y = regY - Math.sin((1 - shift) * Math.PI) * 50 * k; }
                const bit = s.bits[i], match = bit === s.target[i], sealed = s.sealed[i] === 1;
                const decoding = !reduced && load < 1 && load < (i + 1) / n;
                if (bit && !decoding) p.rect(x, y, cw, ch, s.solved ? 'gold' : 'accent');
                else p.rect(x, y, cw, ch, 'bg');
                p.outline(x, y, cw, ch, match ? 'ink' : 'gold', match ? 2 : 4);
                if (sealed) {
                    c.save(); c.beginPath(); c.rect(x, y, cw, ch); c.clip();
                    for (let d = -ch; d < cw; d += 12 * k) p.line([[x + d, y + ch], [x + d + ch, y]], bit ? 'bg' : 'muted', 2);
                    c.restore();
                }
                const glyph = decoding ? GLYPHS[(i * 7 + Math.floor(s.time * 20)) % GLYPHS.length] : bit;
                mono(p, glyph, x + cw / 2, y + ch / 2, ch * .55, bit && !decoding ? 'bg' : 'ink', 'center');
                // Between key and register: | when equal, x when not.
                mono(p, match ? '|' : 'x', xOf(i) + cw / 2, (keyY + cw * .35 + regY) / 2, 24 * k, match ? 'border' : 'gold', 'center');
            }
            // The head: a blinking block cursor under the first cell. A refused flip flashes the seal.
            cursor(p, xOf(0), regY + ch + 10 * k, cw, 10 * k, s.time, reduced);
            if (s.time - s.refusedAt < .5) { p.outline(xOf(0) - 6, regY - 6, cw + 12, ch + 12, 'gold', 3); mono(p, 'SEALED', xOf(0) + cw / 2, regY + ch + 40 * k, 20 * k, 'gold', 'center'); }
            const flip = s.effects.find(e => e.kind === 'flip' && s.time - e.at < .5);
            if (flip) ripple(p, xOf(0) + cw / 2, regY + ch / 2, s.time - flip.at, cw * .8, 'accent', reduced, .5);
            if (s.solved) ripple(p, lockX, lockY + 16 * k, s.time - s.solvedAt, 60 * k, 'gold', reduced, .8);
            const meterY = compact ? h * .62 : 352;
            mono(p, 'clean run', 360 - 70 * k, meterY + 8 * k, 20 * k, 'muted', 'right');
            cells(p, 360 - 56 * k, meterY, BINARY.cleanRun, s.cleanRun % BINARY.cleanRun, 16 * k, 6 * k);
            bursts(s, p, reduced);
        }
    });
}
