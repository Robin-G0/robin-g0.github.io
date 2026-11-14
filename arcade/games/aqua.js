import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';
import { clamp, integer } from '../core/random.js';

export function marble(env) {
    const state = { x: 360, y: 70, vx: 0, opening: 360, gates: 0 };
    return game(state, {
        feedback(s, event) { return { x: s.x, y: s.y }; },
        input(s, event) { s.vx = clamp(s.vx + (event.action === 'left' ? -65 : 65), -130, 130); },
        update(s, dt) {
            s.x = clamp(s.x + s.vx * dt, 65, 655); s.vx *= Math.exp(-dt * .7);
            s.y += 25 * env.pace * dt;
            if (s.y >= 285) {
                if (Math.abs(s.x - s.opening) < 85) { reward(s, env, 25, 'Through the gate'); s.gates++; }
                else hurt(s, env, 'Line up with the opening.');
                s.y = 70; s.vx *= .2; s.opening = integer(env.random, 200, 520);
            }
        },
        render(s, p) {
            hearts(s, p); p.text('MARBLE GATES', 30, 27, 18);
            p.outline(50, 55, 620, 330, 'border', 2);
            p.rect(50, 280, s.opening - 145, 24, 'soft', 8);
            p.rect(s.opening + 95, 280, 575 - s.opening, 24, 'soft', 8);
            p.line([[s.opening - 90, 308], [s.opening + 90, 308]], 'accent', 3);
            p.ball(s.x, s.y, 17); p.text('← nudge / nudge →', 360, 355, 20, 'muted', 'center');
        }
    });
}

export function gel(env) {
    const state = { size: .1, target: .5, packed: 0 };
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 235 : 485, y: 210 }; },
        input(s, event) {
            if (event.action === 'left') {
                s.size += .12;
                if (s.size > 1.05) { hurt(s, env, 'The gel overflowed.'); s.size = .1; }
                return;
            }
            if (Math.abs(s.size - s.target) < .11) { reward(s, env, 30, 'Perfect fit'); s.packed++; }
            else hurt(s, env, s.size < s.target ? 'Add a little more gel.' : 'That bubble was too large.');
            s.size = .1; s.target = .1 + integer(env.random, 2, 6) * .12;
        },
        render(s, p) {
            hearts(s, p); p.text('GEL FACTORY', 30, 27, 18);
            const radius = 20 + s.size * 70, targetRadius = 20 + s.target * 70;
            p.circle(485, 210, targetRadius + 9, 'border', false);
            p.circle(485, 210, targetRadius, 'accent', false);
            p.ball(235, 210, radius);
            p.text('Your bubble', 235, 340, 22, 'ink', 'center');
            p.text('Container', 485, 340, 22, 'ink', 'center');
            p.line([[330, 210], [390, 210]], 'muted', 1, [3, 5]);
            p.text(`${s.packed} packed`, 360, 390, 18, 'muted', 'center');
        }
    });
}

export function dock(env) {
    const state = { icons: [0, 1, 2], target: [2, 0, 1], solved: 0 };
    const names = ['Mail', 'Files', 'Music'], colors = ['#62bce9', '#77b16d', '#bd91da'];
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 280 : 440, y: 263 }; },
        input(s, event) {
            const a = event.action === 'left' ? 0 : 1;
            [s.icons[a], s.icons[a + 1]] = [s.icons[a + 1], s.icons[a]];
            if (s.icons.every((value, i) => value === s.target[i])) {
                s.solved++; reward(s, env, 40, 'Dock restored');
                s.target = [...s.icons];
                for (let i = 2; i > 0; i--) {
                    const j = integer(env.random, 0, i);
                    [s.target[i], s.target[j]] = [s.target[j], s.target[i]];
                }
                if (s.target.every((value, i) => value === s.icons[i])) [s.target[0], s.target[2]] = [s.target[2], s.target[0]];
            }
        },
        render(s, p) {
            p.text('RESTORE THE DOCK', 360, 33, 24, 'ink', 'center');
            p.text('Reference', 80, 110, 18, 'muted');
            s.target.forEach((icon, i) => { p.rect(205 + i * 145, 78, 90, 65, colors[icon], 13); p.text(names[icon], 250 + i * 145, 112, 18, '#17374d', 'center'); });
            p.rect(115, 210, 490, 105, 'soft', 22);
            s.icons.forEach((icon, i) => { p.rect(152 + i * 160, 223, 95, 80, colors[icon], 16); p.text(names[icon], 199 + i * 160, 263, 21, '#17374d', 'center'); });
            p.line([[190, 345], [350, 345]], 'accent', 2); p.arrow(195, 345, 'left'); p.arrow(345, 345, 'right');
            p.line([[370, 375], [530, 375]], 'accent', 2); p.arrow(375, 375, 'left'); p.arrow(525, 375, 'right');
        }
    });
}
