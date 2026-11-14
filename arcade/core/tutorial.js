import { seededRandom } from './random.js';

/** Practice uses the real engine in isolation. Gestures can never start a round. */
export class Tutorial {
    constructor(factory, message = () => {}) {
        this.factory = factory; this.message = message; this.reset();
    }
    reset() {
        this.game?.dispose(); this.stage = 'learn'; this.tried = new Set();
        this.game = this.factory({ random: seededRandom(123), pace: .65, practice: true,
            message: text => this.message(text), finish: text => { this.completed = true; this.message(text); } });
        this.completed = false; this.game.start();
    }
    next() {
        if (this.stage === 'learn') this.stage = 'practice';
        else if (this.stage === 'practice') this.stage = 'ready';
    }
    input(event) {
        if (this.stage !== 'practice' || !['left', 'right'].includes(event.action)) return false;
        if (this.completed) {
            const tried = this.tried; this.reset(); this.stage = 'practice'; this.tried = tried;
        }
        this.tried.add(event.action);
        this.game.input({ ...event, at: this.game.state.time });
        this.game.state.lives = 3;
        return true;
    }
    update(seconds) {
        if (this.stage !== 'practice' || this.completed) return;
        this.game.update(Math.min(.05, Math.max(0, seconds)));
        this.game.state.lives = 3;
    }
    dispose() { this.game.dispose(); }
}
