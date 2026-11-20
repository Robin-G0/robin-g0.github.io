/** Game pressure is separate from camera FPS and simulation time. */
export function pressureMultiplier(seconds) {
    return 1 + .7 * Math.log1p(Math.max(0, seconds) / 40);
}

const survival = ['invaders', 'lander', 'snake', 'sort', 'ski', 'juggle', 'parry', 'rail', 'merge', 'clockwork',
    'gravity', 'orbital', 'beat', 'reactor', 'marble', 'school', 'garden', 'balance', 'abyss'];
const rounds = { stack: 18, golf: 24, orbit: 24, binary: 24, gel: 18,
    dock: 18, memory: 24, tangram: 20, prisms: 32,
    contour: 36, stars: 24, bubbles: 18 };

export const PRESSURE_RULES = Object.freeze({
    ...Object.fromEntries(survival.map(engine => [engine, Object.freeze({ kind: 'survival', pace: true })])),
    ...Object.fromEntries(Object.entries(rounds).map(([engine, seconds]) =>
        [engine, Object.freeze({ kind: 'rounds', seconds, pace: engine === 'stack' })])),
    popups: Object.freeze({ kind: 'custom' }), maze: Object.freeze({ kind: 'custom' })
});

/** Puzzle clocks renew on progress, not button presses. Failed rounds cost a life. */
export class RoundPressure {
    constructor(seconds, pace) {
        this.seconds = seconds / pace; this.lastTime = 0; this.score = 0; this.round = 1;
        this.deadline = this.budget(0);
    }
    budget(elapsed) { return Math.max(3, this.seconds / pressureMultiplier(elapsed)); }
    remaining(elapsed) { return Math.max(0, this.deadline - elapsed); }
    step(elapsed, score, waiting = false) {
        if (waiting) this.deadline += elapsed - this.lastTime;
        this.lastTime = elapsed;
        if (score > this.score) { this.round++; this.deadline = elapsed + this.budget(elapsed); }
        this.score = score;
        if (waiting || elapsed < this.deadline) return false;
        this.deadline = elapsed + this.budget(elapsed);
        return true;
    }
}
