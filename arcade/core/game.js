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
        input(event) { if (!paused && !disposed) handlers.input?.(state, event); },
        update(dt) {
            if (paused || disposed) return;
            state.time += dt;
            handlers.update?.(state, dt);
        },
        render(painter) { if (!disposed) handlers.render(state, painter); },
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
