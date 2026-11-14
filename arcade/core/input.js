/** Only accepted logical commands enter a game. No pose recognition lives here. */
export class InputRouter {
    constructor({ accept, feedback = () => {}, clock = () => performance.now() }) {
        this.accept = accept;
        this.feedback = feedback;
        this.clock = clock;
        this.phase = 'tutorial';
        this.lastMotion = new Map();
    }

    setPhase(phase) {
        this.phase = phase;
        this.lastMotion.clear();
    }

    dispatch(action, { source = 'keyboard', timestamp = this.clock() } = {}) {
        if (action !== 'left' && action !== 'right') return false;
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
        this.accept({ action, source, timestamp });
        this.feedback('accepted', action);
        return true;
    }
}

export function bindAlternativeControls(element, router, signal) {
    const keyActions = { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right', A: 'left', D: 'right' };
    element.addEventListener('keydown', event => {
        if (event.target.matches('input, select, textarea') || event.ctrlKey || event.metaKey) return;
        const action = keyActions[event.key];
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
