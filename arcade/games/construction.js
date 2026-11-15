import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';

export { popups } from './popup-panic.js?v=gestures-7';

export { maze } from './link-maze.js?v=upward-10';

export function juggle(env) {
    const state = { balls: [{ x: 205, y: 205, velocity: -90 }, { x: 515, y: 110, velocity: 15 }] };
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 205 : 515, y: s.balls[event.action === 'left' ? 0 : 1].y }; },
        input(s, event) {
            const ball = s.balls[event.action === 'left' ? 0 : 1];
            if (ball.y > 150 && ball.velocity > 0) { ball.velocity = -185; reward(s, env, 10, 'Bounce'); }
            else env.message('Wait until the GIF is coming down.');
        },
        update(s, dt) {
            for (const ball of s.balls) {
                ball.velocity += 80 * env.pace * dt; ball.y += ball.velocity * env.pace * dt;
                if (ball.y > 350) { hurt(s, env, 'Catch the next bounce.'); ball.y = 190; ball.velocity = -120; }
                if (ball.y < 60) { ball.y = 60; ball.velocity = Math.max(0, ball.velocity); }
            }
        },
        render(s, p) {
            hearts(s, p); p.text('GIF JUGGLER', 360, 28, 25, 'gold', 'center');
            s.balls.forEach((ball, i) => {
                p.line([[ball.x, 65], [ball.x, 340]], 'border', 1, [3, 8]);
                p.rect(ball.x - 55, 355, 110, 15, 'gold');
                p.rect(ball.x - 32, ball.y - 22, 64, 44, i ? '#25d5db' : '#ffef00');
                p.text(i ? '@' : 'GIF', ball.x, ball.y, 25, '#100c43', 'center');
                p.text(i ? 'RIGHT' : 'LEFT', ball.x, 395, 18, 'ink', 'center');
            });
        }
    });
}
