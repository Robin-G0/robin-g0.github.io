import { InputRouter } from './input.js?v=gestures-7';
import { seededRandom } from './random.js';

/** Owns simulation time. Games never own timers, animation loops or cameras. */
export class GameRunner {
    constructor(description, factory, { clock = () => performance.now(), feedback = () => {},
        message = () => {}, changed = () => {}, sound = () => {}, reducedMotion = false } = {}) {
        Object.assign(this, { description, factory, clock, message, changed, sound, reducedMotion });
        this.seed = description.seed ?? (Date.now() >>> 0);
        this.router = new InputRouter({ clock, feedback, actions: description.controls ? Object.keys(description.controls) : undefined, accept: event => {
            const lag = Math.max(0, this.clock() - event.timestamp) / 1000;
            this.game.input({ ...event, at: Math.max(0, this.game.state.time - lag) });
            this.publish();
        } });
        this.create();
    }

    create() {
        this.game?.dispose();
        this.elapsed = 0;
        this.phase = 'tutorial';
        this.started = false;
        this.game = this.factory({ random: seededRandom(this.seed),
            pace: this.description.difficulty === 'standard' ? 1 : .8,
            sound: event => this.sound(event), reducedMotion: this.reducedMotion,
            message: text => this.message(text), finish: text => this.finish(text) });
        this.router.setPhase(this.phase);
    }

    publish() {
        this.changed({ phase: this.phase, score: Math.floor(this.game.state.score),
            lives: Math.max(0, this.game.state.lives),
            elapsed: Math.floor(this.elapsed),
            remaining: this.game.endless ? null : Math.max(0, Math.ceil(this.game.remainingSeconds?.() ?? (this.description.duration - this.elapsed))) });
    }

    play() {
        if (this.phase === 'closed' || this.phase === 'finished') return;
        if (this.started) this.game.resume(); else this.game.start();
        this.started = true;
        this.phase = 'playing'; this.lastFrame = this.clock();
        this.router.setPhase(this.phase); this.publish();
    }

    pause(reason = 'Paused') {
        if (this.phase !== 'playing') return;
        this.phase = 'paused'; this.game.pause(); this.router.setPhase(this.phase);
        this.message(reason); this.publish();
    }

    tutorial() {
        if (this.phase === 'closed') return;
        if (this.phase === 'finished') { this.create(); this.publish(); return; }
        this.game.pause(); this.phase = 'tutorial'; this.router.setPhase(this.phase); this.publish();
    }

    restart() { this.create(); this.play(); }

    finish(text = 'Round complete') {
        if (this.phase !== 'playing') return;
        this.phase = 'finished'; this.game.pause(); this.router.setPhase(this.phase);
        this.message(text); this.publish();
    }

    step(timestamp, { hold = false } = {}) {
        if (hold && this.game.holdOnTrackingLoss !== false) { this.lastFrame = timestamp; return; }
        if (this.phase !== 'playing') { this.lastFrame = timestamp; return; }
        const gap = Math.max(0, (timestamp - this.lastFrame) / 1000);
        this.lastFrame = timestamp;
        // At low FPS the simulation slows instead of jumping through collisions.
        const fixedDuration = !this.game.endless && !this.game.remainingSeconds;
        let remaining = Math.min(.1, gap, fixedDuration ? this.description.duration - this.elapsed : Infinity);
        while (remaining > .000001 && this.phase === 'playing') {
            const dt = Math.min(1 / 60, remaining);
            this.game.update(dt); this.elapsed += dt; remaining -= dt;
        }
        if (fixedDuration && this.elapsed >= this.description.duration - .000001) this.finish();
    }

    dispose() {
        this.phase = 'closed'; this.router.setPhase(this.phase); this.game.dispose();
    }
}
