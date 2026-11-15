import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';
import { integer } from '../core/random.js';

export { popups } from './popup-panic.js?v=motion-6';

export function maze(env) {
    const state = { path: Array.from({ length: 6 }, () => env.random() < .5 ? 'left' : 'right'),
        depth: 0, dead: new Map(), visits: [], wrong: 0 };
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 195 : 525, y: 275 }; },
        input(s, event) {
            s.visits.push({ depth: s.depth, action: event.action });
            if (event.action === s.path[s.depth]) {
                s.depth++; reward(s, env, 20, 'Link found');
                if (s.depth === s.path.length) env.finish('Homepage found');
            } else { s.dead.set(s.depth, event.action); s.wrong++; env.message('404. Try the other link.'); }
        },
        render(s, p) {
            p.text('FIND THE HOMEPAGE', 360, 35, 26, 'gold', 'center');
            for (let i = 0; i < 6; i++) {
                const x = 110 + i * 100;
                if (i) p.line([[x - 80, 120], [x, 120]], 'muted', 2);
                p.circle(x, 120, 18, i < s.depth ? 'accent' : 'soft');
                p.text(i + 1, x, 120, 20, i < s.depth ? 'bg' : 'ink', 'center');
            }
            p.text(`PAGE ${Math.min(6, s.depth + 1)} / 6`, 360, 185, 20, 'ink', 'center');
            for (const [side, x] of [['left', 195], ['right', 525]]) {
                const broken = s.dead.get(s.depth) === side;
                p.outline(x - 120, 235, 240, 80, broken ? 'gold' : 'accent', 3);
                p.text(broken ? '404 / BROKEN' : 'ENTER >>', x, 275, 24, broken ? 'gold' : 'accent', 'center');
            }
            p.text('Broken links stay marked.', 360, 365, 20, 'muted', 'center');
        }
    });
}

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
