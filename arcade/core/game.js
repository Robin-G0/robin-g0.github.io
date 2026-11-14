/** Small, explicit lifecycle shared by every trusted game module. */
export function game(state, handlers) {
    state.score ??= 0;
    state.lives ??= 3;
    state.time = 0;
    let paused = false;
    let disposed = false;
    return {
        state,
        start() { paused = false; },
        input(event) {
            if (paused || disposed) return;
            const score = state.score, lives = state.lives;
            handlers.input?.(state, event);
            const target = handlers.feedback?.(state, event) || { x: event.action === 'left' ? 180 : 540, y: 210 };
            state.inputFeedback = { ...target, action: event.action, at: state.time,
                points: state.score - score, hurt: state.lives < lives };
        },
        update(dt) {
            if (paused || disposed) return;
            state.time += dt;
            handlers.update?.(state, dt);
        },
        render(painter) {
            if (disposed) return;
            handlers.render(state, painter);
            if (state.inputFeedback && state.time - state.inputFeedback.at < 1.4) painter.inputFeedback?.(state.inputFeedback);
        },
        pause() { paused = true; handlers.pause?.(state); },
        resume() { paused = false; handlers.resume?.(state); },
        dispose() { disposed = true; handlers.dispose?.(state); }
    };
}

export function hurt(state, environment, message = 'Try the next one.') {
    state.lives -= 1;
    environment.message(message);
    if (state.lives <= 0) environment.finish('Round complete');
}

export function reward(state, environment, points = 10, message = '') {
    state.score += points;
    if (message) environment.message(message);
}

export function hearts(state, painter) {
    if (state.lives == null) return;
    for (let i = 0; i < Math.max(0, state.lives); i++) {
        painter.circle(665 - i * 19, 25, 5, 'accent');
    }
}
