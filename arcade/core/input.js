import { decodeGesture } from './commands.js';

/** Only accepted logical commands enter a game. No pose recognition lives here. */
export class InputRouter {
    constructor({ accept, feedback = () => {}, clock = () => performance.now(), actions = ['left', 'right'] }) {
        this.accept = accept;
        this.feedback = feedback;
        this.clock = clock;
        this.phase = 'tutorial';
        this.lastMotion = new Map();
        this.actions = new Set(actions);
    }

    setPhase(phase) {
        this.phase = phase;
        this.lastMotion.clear();
    }

    dispatch(action, { source = 'keyboard', timestamp = this.clock() } = {}) {
        if (!this.actions.has(action)) return false;
        const age = this.clock() - timestamp;
        if (age < -50 || age > 250) {
            this.feedback('late', action);
            return false;
        }
        if (this.phase !== 'playing') {
            this.feedback(this.phase === 'tutorial' ? 'practice' : 'paused', action);
            return false;
        }
        // MIG already rearms its own profile. This only guards duplicate delivery
        // of the same callback, not a second physical movement or the other wrist.
        if (source === 'motion') {
            const previous = this.lastMotion.get(action) ?? -Infinity;
            if (timestamp - previous < 120) {
                this.feedback('duplicate', action);
                return false;
            }
            this.lastMotion.set(action, timestamp);
        }
        this.accept({ action, source, timestamp, ...decodeGesture(action) });
        this.feedback('accepted', action);
        return true;
    }
}

export function bindAlternativeControls(element, router, signal, scheme = 'wrist-up') {
    const keyActions = scheme==='wrist-directions'
        ? { a: 'left_left', w: 'left_up', d: 'left_right', j: 'right_left', i: 'right_up', l: 'right_right',
            ArrowLeft: 'right_left', ArrowUp: 'right_up', ArrowRight: 'right_right' }
        : { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right' };
    element.addEventListener('keydown', event => {
        if (event.target.matches('input, select, textarea') || event.ctrlKey || event.metaKey) return;
        const action = keyActions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
        if (!action) return;
        event.preventDefault();
        if (!event.repeat) router.dispatch(action);
    }, { signal });
    for (const button of element.querySelectorAll('[data-arcade-input]')) {
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            router.dispatch(button.dataset.arcadeInput, { source: 'touch' });
        }, { signal });
        // Keyboard / assistive activation has detail=0. Pointer activation has
        // already been handled on pointerdown; do not turn one tap into two inputs.
        button.addEventListener('click', event => {
            if (event.detail === 0) router.dispatch(button.dataset.arcadeInput);
        }, { signal });
    }
}
