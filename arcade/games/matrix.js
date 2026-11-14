import { game, hurt, reward, hearts } from '../core/game.js';
import { clamp, integer } from '../core/random.js';

export function parry(env) {
    const state = { attacks: [{ side: 'left', due: 3 }], next: 4.5, guard: null, until: 0 };
    return game(state, {
        input(s, event) { s.guard = event.action; s.until = s.time + 1.6; env.message('Guard raised'); },
        update(s) {
            if (s.time >= s.next) {
                s.attacks.push({ side: env.random() < .5 ? 'left' : 'right', due: s.time + 3 });
                s.next = s.time + Math.max(2, 3.5 - s.score / 150) / env.pace;
            }
            for (const attack of s.attacks) if (!attack.done && s.time >= attack.due) {
                attack.done = true;
                if (s.guard === attack.side && s.until >= s.time) reward(s, env, 20, 'Blocked');
                else hurt(s, env, 'Raise the matching guard near impact.');
            }
            s.attacks = s.attacks.filter(attack => !attack.done);
        },
        render(s, p) {
            hearts(s, p); p.text('CONSTRUCT / DEFENCE', 30, 25, 17);
            p.circle(360, 135, 22, 'accent', false);
            p.line([[360, 158], [360, 275], [320, 340]], 'accent', 3);
            p.line([[360, 275], [400, 340]], 'accent', 3);
            p.line([[360, 180], [305, 220], [275, 170]], 'accent', 3);
            p.line([[360, 180], [415, 220], [445, 170]], 'accent', 3);
            for (const attack of s.attacks) {
                const progress = clamp(1 - (attack.due - s.time) / 3, 0, 1);
                const x = attack.side === 'left' ? 50 + progress * 220 : 670 - progress * 220;
                p.rect(x - 16, 170, 32, 12, 'ink');
                p.line([[x, 176], [x + (attack.side === 'left' ? -45 : 45), 176]], 'accent', 2);
            }
            if (s.until > s.time) {
                const x = s.guard === 'left' ? 260 : 460;
                p.line([[x, 130], [x, 240]], 'ink', 7);
            }
            p.text('ONE WRIST / ONE GUARD', 360, 385, 18, 'muted', 'center');
        }
    });
}

export function binary(env) {
    const state = { bits: [0, 0, 0, 0], target: [1, 0, 1, 0], solved: 0 };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') s.bits.push(s.bits.shift());
            else s.bits[0] = 1 - s.bits[0];
            if (s.bits.every((bit, i) => bit === s.target[i])) {
                reward(s, env, 50, 'Register unlocked'); s.solved++;
                s.target = s.bits.map(() => integer(env.random, 0, 1));
                if (s.target.every((bit, i) => bit === s.bits[i])) s.target[0] = 1 - s.target[0];
            }
        },
        render(s, p) {
            p.text('BINARY REGISTER', 360, 35, 24, 'accent', 'center');
            p.text('TARGET', 70, 125, 18, 'muted');
            p.text('CURRENT', 70, 245, 18, 'muted');
            for (let i = 0; i < 4; i++) {
                const x = 250 + i * 95;
                p.text(s.target[i], x, 125, 44, 'accent', 'center');
                p.outline(x - 35, 205, 70, 80, i === 0 ? 'ink' : 'border', i === 0 ? 3 : 1);
                p.text(s.bits[i], x, 245, 46, 'ink', 'center');
            }
            p.text('Rotate the row / flip its first bit', 360, 355, 21, 'muted', 'center');
        }
    });
}

export function gravity(env) {
    const state = { y: 330, velocity: 0, gravity: 1, walls: [{ x: 650, top: false }],
        next: 4, slowUntil: 0, ready: 0 };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.gravity *= -1; s.velocity = 0; }
            else if (s.time >= s.ready) { s.slowUntil = s.time + 2; s.ready = s.time + 5; env.message('Time slowed'); }
        },
        update(s, dt) {
            s.velocity += s.gravity * 140 * dt; s.y = clamp(s.y + s.velocity * dt, 75, 345);
            if (s.y === 75 || s.y === 345) s.velocity = 0;
            if (s.time > s.next) {
                s.walls.push({ x: 760, top: env.random() < .5 }); s.next = s.time + 4.5 / env.pace;
            }
            const speed = s.time < s.slowUntil ? 28 : 65 * env.pace;
            for (const wall of s.walls) {
                wall.x -= speed * dt;
                if (!wall.passed && wall.x < 170) {
                    wall.passed = true;
                    if (wall.top ? s.y < 230 : s.y > 190) hurt(s, env, 'Switch to the other surface.');
                    else reward(s, env, 25);
                }
            }
            s.walls = s.walls.filter(wall => wall.x > -50);
        },
        render(s, p) {
            hearts(s, p); p.text('GRAVITY / CONSTRUCT', 30, 25, 17);
            p.line([[20, 60], [700, 60]], 'accent'); p.line([[20, 360], [700, 360]], 'accent');
            s.walls.forEach(wall => p.rect(wall.x, wall.top ? 60 : 210, 40, 150, 'soft'));
            p.rect(154, s.y - 14, 28, 28, 'ink');
            p.text(s.time >= s.ready ? 'SLOW TIME READY' : 'RECOVERING', 360, 395, 17, 'muted', 'center');
        }
    });
}
