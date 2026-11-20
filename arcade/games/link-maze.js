import { game } from '../core/game.js?v=eras-3';
import { generateMaze, mazePenalties } from './link-maze-map.js?v=eras-3';
import { renderMaze } from './link-maze-view.js?v=eras-3';

export const EXIT_SECONDS = 8;
export const MAX_SECONDS = 90;

/** Native MIG pulses select links; generation, time and effects are ordinary game rules. */
export function maze(env) {
    const state = { level: 1, completed: 0, remaining: 45, stage: 'preview',
        current: 0, steps: 0, peek: 0, flipped: 0, history: [], flash: null, outcome: null };

    function newMap(s) {
        s.map = generateMaze(env.random, s.level, s.completed + 1);
        // Keep the capped, readable map size while later rounds demand more memory.
        s.map.preview = Math.max(4, s.map.preview / (1 + Math.max(0, s.completed - 2) * .12));
        s.current = 0; s.steps = 0; s.peek = 0; s.flipped = 0; s.history = [];
        s.stage = 'preview'; s.until = (s.time || 0) + s.map.preview;
        s.flash = null; s.outcome = null; s.reason = null;
    }
    function end(s, reason = 'time') {
        s.remaining = 0; s.stage = 'over'; s.reason = reason;
        env.finish(reason === 'fatal' ? 'Fatal trap' : 'Time up');
    }
    newMap(state);
    const instance = game(state, {
        feedback() { return { hideAll: true }; },
        input(s, event) {
            if (s.stage !== 'navigate' || !['left', 'right'].includes(event.action)) return;
            const side = event.action === 'left' ? 0 : 1;
            const index = s.flipped > 0 ? 1 - side : side;
            const destination = s.map.nodes[s.current].children[index];
            s.peek = Math.max(0, s.peek - 1); s.flipped = Math.max(0, s.flipped - 1);
            s.current = destination; s.steps++; s.history.push(event.action);
            const effect = s.map.nodes[destination].effect;
            s.flash = { action: event.action, effect, at: s.time };
            s.outcome = { effect, at: s.time };
            const penalty = mazePenalties(s.completed + 1);
            switch (effect) {
                case 'points': s.score += 40; break;
                case 'tax': s.score = Math.max(0, s.score - penalty.tax); break;
                case 'seconds': s.remaining = Math.min(MAX_SECONDS, s.remaining + 5); break;
                case 'delay': s.remaining = Math.max(0, s.remaining - penalty.delay); break;
                case 'reveal': s.peek = 2; break;
                case 'flip': s.flipped = penalty.flip; break;
                case 'fatal': end(s, 'fatal'); return;
                case 'exit': {
                    const points = 100 * s.level + Math.max(0, s.map.maxDepth - s.steps) * 15;
                    s.score += points; s.remaining = Math.min(MAX_SECONDS, s.remaining + EXIT_SECONDS);
                    s.completed++; s.stage = 'arrival'; s.until = s.time + 1.3;
                    s.outcome.points = points;
                    env.sound?.({ kind: 'clear', count: 6, perfect: true });
                    break;
                }
            }
            if (effect !== 'exit') env.sound?.({ action: event.action });
            if (s.remaining <= 0) end(s);
        },
        update(s, dt) {
            if (s.stage === 'navigate') {
                s.remaining = Math.max(0, s.remaining - dt);
                if (s.remaining <= .000001) end(s);
            } else if (s.time >= s.until && s.stage === 'preview') {
                s.stage = 'navigate';
            } else if (s.time >= s.until && s.stage === 'arrival') {
                s.level = Math.min(3, s.completed + 1); newMap(s);
            }
        },
        render(s, painter) { renderMaze(s, painter, env.reducedMotion); }
    });
    // Repeating maps own their time bank; the host supplies other engines' pressure policies.
    return { ...instance, remainingSeconds: () => state.remaining };
}
