import { InputRouter } from './input.js?v=gestures-7';
import { seededRandom } from './random.js';
import { PRESSURE_RULES, RoundPressure, pressureMultiplier } from './pressure.js';

/** Owns simulation time. Games never own timers, animation loops or cameras. */
export class GameRunner {
    constructor(description, factory, { clock = () => performance.now(), feedback = () => {},
        message = () => {}, changed = () => {}, sound = () => {}, reducedMotion = false } = {}) {
        Object.assign(this, { description, factory, clock, message, changed, sound, reducedMotion });
        this.seed = description.seed ?? (Date.now() >>> 0);
        this.router = new InputRouter({ clock, feedback, actions: description.controls ? Object.keys(description.controls) : undefined, accept: event => {
            const lag = Math.max(0, this.clock() - event.timestamp) / 1000;
            this.game.input({ ...event, at: Math.max(0, this.game.state.time - lag) });
            this.updatePressure();
            this.publish();
        } });
        this.create();
    }

    create() {
        this.game?.dispose();
        this.elapsed = 0;
        this.phase = 'tutorial';
        this.started = false;
        this.resultText = null;
        this.pressurePolicy = PRESSURE_RULES[this.description.engine];
        const runner = this, basePace = this.description.difficulty === 'standard' ? 1 : .8;
        this.basePace = basePace; this.currentPace = basePace;
        this.roundPressure = this.pressurePolicy?.kind === 'rounds'
            ? new RoundPressure(this.pressurePolicy.seconds, basePace) : null;
        this.game = this.factory({ random: seededRandom(this.seed),
            get pace() { return runner.currentPace; },
            sound: event => this.sound(event), reducedMotion: this.reducedMotion,
            message: text => this.message(text), finish: text => this.finish(text) });
        if (this.pressurePolicy && this.pressurePolicy.kind !== 'custom') this.game.endless = true;
        if (this.roundPressure) this.game.remainingSeconds = () => this.roundPressure.remaining(this.elapsed);
        this.router.setPhase(this.phase);
    }

    publish() {
        this.changed({ phase: this.phase, score: Math.floor(this.game.state.score),
            result: this.resultText,
            lives: Math.max(0, this.game.state.lives),
            elapsed: Math.floor(this.elapsed),
            clockLabel: this.roundPressure ? 'Next score' : this.game.endless ? 'Survived' : 'Time',
            remaining: this.game.remainingSeconds ? Math.max(0, Math.ceil(this.game.remainingSeconds()))
                : this.game.endless ? null : Math.max(0, Math.ceil(this.description.duration - this.elapsed)) });
    }

    updatePressure() {
        if (!this.roundPressure || this.phase !== 'playing') return;
        const state = this.game.state;
        const waiting = state.phase === 'show' || state.solved === true;
        if (this.roundPressure.step(this.elapsed, state.score, waiting)) {
            state.lives = Math.max(0, state.lives - 1);
            this.message('Time up');
            if (!state.lives) this.finish('Time up');
        }
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
        if (reason) this.message(reason);
        this.publish();
    }

    tutorial() {
        if (this.phase === 'closed') return;
        if (this.phase === 'finished') { this.create(); this.publish(); return; }
        this.game.pause(); this.phase = 'tutorial'; this.router.setPhase(this.phase); this.publish();
    }

    restart() { this.create(); this.play(); }

    finish(text = 'Round complete') {
        if (this.phase !== 'playing') return;
        this.resultText = text;
        this.phase = 'finished'; this.game.pause(); this.router.setPhase(this.phase);
        this.message(text); this.publish();
    }

    step(timestamp) {
        if (this.phase !== 'playing') { this.lastFrame = timestamp; return; }
        const gap = Math.max(0, (timestamp - this.lastFrame) / 1000);
        this.lastFrame = timestamp;
        // At low FPS the simulation slows instead of jumping through collisions.
        const fixedDuration = !this.game.endless && !this.game.remainingSeconds;
        let remaining = Math.min(.1, gap, fixedDuration ? this.description.duration - this.elapsed : Infinity);
        while (remaining > .000001 && this.phase === 'playing') {
            const dt = Math.min(1 / 60, remaining);
            if (this.pressurePolicy?.pace) this.currentPace = this.basePace * pressureMultiplier(this.elapsed);
            this.game.update(dt); this.elapsed += dt; remaining -= dt;
            this.updatePressure();
        }
        if (fixedDuration && this.elapsed >= this.description.duration - .000001) this.finish();
    }

    dispose() {
        this.phase = 'closed'; this.router.setPhase(this.phase); this.game.dispose();
    }
}
