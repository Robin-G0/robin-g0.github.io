import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';
import { clamp } from '../core/random.js';

export function orbital(env) {
    const state = { angle: Math.PI / 2, ball: { x: 360, y: 200, vx: 35, vy: 65 }, hits: 0 };
    return game(state, {
        feedback(s, event) { return { x: 360 + Math.cos(s.angle) * 160, y: 215 + Math.sin(s.angle) * 160 }; },
        input(s, event) { s.angle += (event.action === 'left' ? -1 : 1) * Math.PI / 4; },
        update(s, dt) {
            const ball = s.ball;
            ball.x += ball.vx * env.pace * dt; ball.y += ball.vy * env.pace * dt;
            const dx = ball.x - 360, dy = ball.y - 215, radius = Math.hypot(dx, dy);
            if (radius <= 155 || dx * ball.vx + dy * ball.vy <= 0) return;
            const angle = Math.atan2(dy, dx);
            const delta = Math.atan2(Math.sin(angle - s.angle), Math.cos(angle - s.angle));
            if (Math.abs(delta) < 1.25) {
                const nx = dx / radius, ny = dy / radius, dot = ball.vx * nx + ball.vy * ny;
                ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
                ball.x = 360 + nx * 150; ball.y = 215 + ny * 150;
                s.hits++; reward(s, env, 20, 'Reflected');
            } else { hurt(s, env, 'Turn the shield toward the ball.'); Object.assign(ball, { x: 360, y: 215, vx: 35, vy: 65 }); }
        },
        render(s, p) {
            hearts(s, p); p.text('ORBITAL BREAKER', 30, 25, 18);
            p.circle(360, 215, 160, 'border', false);
            const points = Array.from({ length: 24 }, (_, i) => {
                const angle = s.angle - 1.25 + i / 23 * 2.5;
                return [360 + Math.cos(angle) * 160, 215 + Math.sin(angle) * 160];
            });
            p.line(points, 'accent', 12); p.ball(s.ball.x, s.ball.y, 13);
            for (let i = 0; i < 6; i++) p.circle(75 + i * 26, 390, 5, i < s.hits % 7 ? 'accent' : 'border');
        }
    });
}

export function beat(env) {
    const state = { notes: [{ action: 'left', due: 3 }, { action: 'right', due: 6 }], next: 9, streak: 0 };
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 235 : 485, y: 318 }; },
        input(s, event) {
            const at = event.at ?? s.time;
            const note = s.notes.find(note => !note.hit && note.action === event.action && Math.abs(note.due - at) <= .42);
            if (note) { note.hit = true; s.streak++; reward(s, env, 10 + Math.min(20, s.streak * 2), 'In time'); }
            else env.message('Wait for the note to reach its line.');
        },
        update(s) {
            if (s.time > s.next - 4) {
                s.notes.push({ action: env.random() < .5 ? 'left' : 'right', due: s.next });
                s.next += Math.max(1.8, 3 - s.score / 250) / env.pace;
            }
            for (const note of s.notes) if (!note.hit && s.time > note.due + .45) {
                note.hit = true; s.streak = 0; hurt(s, env, 'Next note. There is time to lower your wrist.');
            }
            s.notes = s.notes.filter(note => !note.hit);
        },
        render(s, p) {
            hearts(s, p); p.text('CHROME BEAT', 30, 25, 18);
            for (const [action, x] of [['left', 235], ['right', 485]]) {
                p.outline(x - 65, 65, 130, 290, 'border', 1);
                p.rect(x - 65, 300, 130, 35, 'soft', 4); p.line([[x - 65, 318], [x + 65, 318]], 'accent', 3);
                p.arrow(x, 377, action);
            }
            for (const note of s.notes) {
                const y = 318 - (note.due - s.time) * 77;
                if (y > 60 && y < 365) p.ball(note.action === 'left' ? 235 : 485, y, 20);
            }
        }
    });
}

export function reactor(env) {
    const state = { heat: .45, power: .5, glow: 0 };
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 119 : 601, y: 210 }; },
        input(s, event) {
            if (event.action === 'left') { s.heat -= .18; s.power -= .045; }
            else { s.heat += .065; s.power += .12; }
            s.heat = Math.max(.02, s.heat); s.power = clamp(s.power, .1, 1); s.glow = .3;
        },
        update(s, dt) {
            s.heat += (s.power * .2 - .09 + Math.sin(s.time * .3) * .03) * dt * env.pace;
            s.score += s.power * dt * 4; s.glow = Math.max(0, s.glow - dt);
            if (s.heat > 1 || s.heat < 0) { hurt(s, env, 'Keep the heat inside the marked range.'); s.heat = .45; s.power = .45; }
        },
        render(s, p) {
            hearts(s, p); p.text('REACTOR BALANCE', 30, 25, 18);
            if (!p.sprite('chrome', 200, 100, 320, 200)) p.ball(360, 210, 70);
            p.rect(100, 85, 38, 250, 'soft', 6); p.rect(100, 335 - s.heat * 250, 38, s.heat * 250, 'gold', 6);
            p.line([[85, 110], [151, 110]], 'muted'); p.line([[85, 310], [151, 310]], 'muted');
            p.rect(582, 85, 38, 250, 'soft', 6); p.rect(582, 335 - s.power * 250, 38, s.power * 250, 'accent', 6);
            p.text('HEAT', 119, 370, 18, 'ink', 'center'); p.text('POWER', 601, 370, 18, 'ink', 'center');
            p.text(s.glow ? 'CORE RESPONDING' : 'VENT / CHARGE', 360, 365, 18, 'muted', 'center');
        }
    });
}
