import { game } from '../core/game.js?v=motion-6';
import { decodeGesture, DIRECTIONS, ARROWS, WRISTS } from '../core/commands.js';
import { clamp } from '../core/random.js';

export const STACK_LIMIT = 9;
export const CHAIN_SECONDS = 4.5;
export const WRIST_DIRECTION_COOLDOWN_MS = 200;

/** Paired arrivals accelerate with simulation time, independently of score. */
export function spawnInterval(elapsed, pace = 1) {
    return (1.5 - .85 * clamp(elapsed / 60, 0, 1)) / pace;
}

export function batchPoints(count, chain = 1, level = 1) {
    return count > 0 ? Math.round(10 * count * count * (1 + Math.min(6, chain - 1) * .25) * level) : 0;
}

/** One stack per anatomical wrist; three screen directions. Empty gestures are harmless. */
export function popups(env) {
    const state = { windows: [], bag: [], queue: [], next: spawnInterval(0, env.pace), serial: 0,
        cleared: 0, level: 1, chain: 0, lastClearAt: -Infinity, bursts: [], lastClear: null,
        fullAt: null, taps: {}, lastClears: {} };

    function draw(s) {
        if (!s.bag.length) {
            s.bag = [...DIRECTIONS, ...DIRECTIONS, ...DIRECTIONS];
            for (let i = s.bag.length - 1; i > 0; i--) {
                const j = Math.floor(env.random() * (i + 1));
                [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
            }
        }
        return s.bag.pop();
    }
    function add(s, stack, direction, falling = true) {
        const row = s.windows.filter(window => window.stack === stack).length;
        s.windows.push({ id: ++s.serial, stack, direction, row: row + (falling && !env.reducedMotion ? 2 : 0), born: s.time || 0 });
    }
    for (let stack = 0; stack < 2; stack++) for (let row = 0; row < 3; row++) {
        add(state, stack, DIRECTIONS[(stack + row) % 3], false);
    }
    state.queue = Array.from({ length: 4 }, () => draw(state));

    return game(state, {
        feedback(s, event) { return { x: decodeGesture(event.action)?.wrist === 'left' ? 185 : 535, y: 210, hideAll: true }; },
        input(s, event) {
            const gesture = decodeGesture(event.action);
            if (!gesture || !DIRECTIONS.includes(gesture.direction)) return;
            const { wrist, direction } = gesture, stack = wrist === 'left' ? 0 : 1;
            s.taps[wrist] = { wrist, direction, at: s.time };
            const matches = window => window.stack === stack && window.direction === direction;
            const matching = s.windows.filter(matches);
            if (!matching.length) return; // No lost points, broken chain, error dialog or artificial lockout.
            s.chain = s.time - s.lastClearAt <= CHAIN_SECONDS ? s.chain + 1 : 1;
            const count = matching.length;
            const points = batchPoints(count, s.chain, s.level);
            s.windows = s.windows.filter(window => !matches(window));
            s.bursts.push(...matching.map(window => ({ ...window, at: s.time })));
            s.cleared += count;
            const perfect = s.windows.length === 0;
            const gained = points + (perfect ? 100 * s.level : 0);
            s.score += gained;
            s.lastClearAt = s.time;
            s.lastClear = { count, points: gained, at: s.time, chain: s.chain, perfect, wrist, direction };
            s.lastClears[wrist] = s.lastClear;
            s.level = 1 + Math.min(7, Math.floor(s.cleared / 20));
            if ([0, 1].every(stack => s.windows.filter(window => window.stack === stack).length <= STACK_LIMIT)) s.fullAt = null;
            if (perfect) s.next = Math.max(s.next, s.time + .9);
            env.message(`${count}×  +${gained}`);
            env.sound?.({ kind: 'clear', count, chain: s.chain, perfect });
        },
        update(s, dt) {
            if (s.time >= s.next) {
                for (let stack = 0; stack < 2; stack++) add(s, stack, s.queue.shift());
                s.queue.push(draw(s), draw(s));
                s.next = s.time + spawnInterval(s.time, env.pace);
            }
            const rows = [0, 0];
            for (const window of s.windows) {
                const target = rows[window.stack]++;
                window.row = env.reducedMotion ? target : window.row + (target - window.row) * (1 - Math.exp(-16 * dt));
            }
            const overflowing = rows.some(count => count > STACK_LIMIT);
            if (overflowing) {
                s.fullAt ??= s.time;
                if (s.time - s.fullAt > 1.2) env.finish('Stack full');
            } else s.fullAt = null;
            s.bursts = s.bursts.filter(burst => s.time - burst.at < .65);
        },
        render(s, p) {
            const c = p.c;
            const pitch = (p.h - 120) / STACK_LIMIT, tile = pitch + 4;
            const floor = p.h - 22 - tile;
            const colours = { left: '#63ffff', up: '#9dff99', right: '#fff15a' };
            function arrow(x, y, action, width = 76, colour = colours[action]) {
                const head = Math.min(width * .3, Math.max(12, pitch * .35));
                if (action === 'up') {
                    p.line([[x, y + head], [x, y - head]], colour, 5);
                    p.line([[x - head, y], [x, y - head], [x + head, y]], colour, 5);
                } else {
                    const direction = action === 'left' ? -1 : 1;
                    p.line([[x - width / 2, y], [x + width / 2, y]], colour, 5);
                    p.line([[x + direction * (width / 2 - head), y - head], [x + direction * width / 2, y],
                        [x + direction * (width / 2 - head), y + head]], colour, 5);
                }
            }
            function windowBox(x, y, window, fade = 1) {
                c.save(); c.globalAlpha = fade;
                p.rect(x, y, 286, tile, '#211543'); p.outline(x, y, 286, tile, colours[window.direction], 2);
                p.rect(x + 3, y + 3, 28, tile - 6, window.direction === 'up' ? '#215e35' : window.direction === 'left' ? '#17495b' : '#594e17');
                p.rect(x + 262, y + 4, 19, 18, '#b6a1ed');
                p.line([[x + 267, y + 8], [x + 276, y + 17]], '#211543', 2);
                p.line([[x + 276, y + 8], [x + 267, y + 17]], '#211543', 2);
                arrow(x + 143, y + tile / 2, window.direction);
                c.restore();
            }
            p.text('L', 48, 42, 31, '#d0b6ff'); p.text('R', 400, 42, 31, '#ffd1a6');
            // Preview the next two paired arrivals. Shape encodes direction; colour is secondary.
            for (let i = 0; i < 4; i++) arrow((i % 2 ? 490 : 100) + Math.floor(i / 2) * 60, 43, s.queue[i], 30);
            p.line([[43, 78], [329, 78]], '#9564da', 2, [5, 7]);
            p.line([[390, 78], [676, 78]], '#9564da', 2, [5, 7]);
            const counts = [0, 0];
            for (const window of s.windows) {
                counts[window.stack]++;
                windowBox(window.stack ? 390 : 43, floor - window.row * pitch, window);
            }
            for (let stack = 0; stack < 2; stack++) {
                const x = stack ? 685 : 29, pressure = clamp(counts[stack] / STACK_LIMIT, 0, 1);
                const bottom = p.h - 22, height = bottom - 83;
                p.rect(x, 83, 6, height, '#362253');
                p.rect(x, bottom - pressure * height, 6, pressure * height, pressure > .8 ? '#ff80ae' : '#b49ae8');
                p.line([[stack ? 390 : 43, bottom + 2], [stack ? 676 : 329, bottom + 2]], '#b49ae8', 3);
            }
            for (const burst of s.bursts) {
                const age = s.time - burst.at, progress = clamp(age / .65, 0, 1);
                const x = burst.stack ? 390 : 43, y = floor - burst.row * pitch;
                if (env.reducedMotion) {
                    p.outline(x, y, 286, tile, colours[burst.direction], 3);
                } else {
                    c.save(); c.translate(x + 143, y + tile / 2); c.scale(1 + progress * .13, 1 - progress * .65);
                    windowBox(-143, -tile / 2, burst, 1 - progress); c.restore();
                    for (let i = 0; i < 4; i++) {
                        const angle = (burst.id * 2.4 + i * 1.57), travel = 45 * progress;
                        c.save(); c.globalAlpha = 1 - progress;
                        p.rect(x + 143 + Math.cos(angle) * travel, y + tile / 2 + Math.sin(angle) * travel, 5, 5, colours[burst.direction]);
                        c.restore();
                    }
                }
            }
            for (const wrist of WRISTS) {
                const clear = s.lastClears[wrist];
                if (!clear || s.time - clear.at >= 1.15) continue;
                const age = s.time - clear.at;
                const scale = env.reducedMotion ? 1 : 1 + .12 * Math.exp(-age * 9) * Math.sin(age * 20);
                c.save(); c.translate(clear.wrist === 'left' ? 186 : 533, 42); c.scale(scale, scale);
                p.rect(-96, -34, 192, 100, '#100927', 4); p.outline(-96, -34, 192, 100, colours[clear.direction], 2);
                p.text(`${ARROWS[clear.direction]} ${clear.count}×`, 0, -2, 53, colours[clear.direction], 'center');
                p.text(`+${clear.points}`, 0, 40, 35, '#fff', 'center'); c.restore();
                if (clear.perfect && clear === s.lastClear) {
                    p.line([[75, p.h - 23], [645, p.h - 23]], '#fff15a', 5);
                    p.text('ALL CLEAR', 360, p.h * .58, 47, '#fff15a', 'center');
                }
            }
            if (s.chain > 1 && s.time - s.lastClearAt < CHAIN_SECONDS) {
                p.rect(266, p.h - 17, 188 * (1 - (s.time - s.lastClearAt) / CHAIN_SECONDS), 5, '#63ffff');
            }
            for (const wrist of WRISTS) {
                const tap = s.taps[wrist];
                if (!tap || s.time - tap.at >= .22) continue;
                c.save(); c.globalAlpha = .65 * (1 - (s.time - tap.at) / .22);
                arrow(tap.wrist === 'left' ? 165 : 555, p.h - 13, tap.direction, 100); c.restore();
            }
        }
    });
}
