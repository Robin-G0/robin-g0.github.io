import { game, hurt, reward, hearts } from '../core/game.js';
import { clamp, integer } from '../core/random.js';

function paperShape(p, type, x, y, rotation, color, filled) {
    const shapes = [ [[-45, 35], [45, 35], [-45, -35]],
        [[-40, -40], [0, -40], [0, 0], [40, 0], [40, 40], [-40, 40]],
        [[-45, -20], [15, -20], [45, 20], [-15, 20]] ];
    const c = p.c; c.save(); c.translate(x, y); c.rotate(rotation * Math.PI / 2);
    c.beginPath(); shapes[type].forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py));
    c.closePath(); c.fillStyle = c.strokeStyle = p.color(color); c.lineWidth = 3;
    if (filled) c.fill(); else c.stroke(); c.restore();
}

export function tangram(env) {
    const state = { piece: 0, rotation: 0, targets: [1, 3, 2], placed: [false, false, false] };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.rotation = (s.rotation + 1) % 4; return; }
            if (s.rotation !== s.targets[s.piece]) { env.message('Match the outlined shape before stamping.'); return; }
            s.placed[s.piece] = true; reward(s, env, 30, 'Shape fitted'); s.piece++; s.rotation = 0;
            if (s.piece === 3) { s.piece = 0; s.targets = s.targets.map(() => integer(env.random, 0, 3)); s.placed.fill(false); }
        },
        render(s, p) {
            p.text('PAPER TANGRAM', 30, 26, 20);
            for (let i = 0; i < 3; i++) {
                paperShape(p, i, 170 + i * 190, 140, s.targets[i], s.placed[i] ? 'accent' : 'border', s.placed[i]);
                if (i === s.piece) p.line([[120 + i * 190, 203], [220 + i * 190, 203]], 'accent', 3);
            }
            paperShape(p, s.piece, 360, 310, s.rotation, 'accent', true);
            p.text('Rotate / stamp', 360, 390, 20, 'muted', 'center');
        }
    });
}

export function golf(env) {
    const state = { x: 95, velocity: 0, power: 1, cup: 535, strokes: 0, next: 0 };
    const powers = [95, 125, 155];
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.power = (s.power + 1) % powers.length; return; }
            if (s.velocity || s.time < s.next) return;
            s.velocity = powers[s.power]; s.strokes++;
        },
        update(s, dt) {
            if (!s.velocity) return;
            const step = dt * env.pace;
            s.x += s.velocity * step; s.velocity *= Math.exp(-.23 * step);
            if (Math.abs(s.x - s.cup) < 19 && s.velocity < 65) {
                reward(s, env, Math.max(10, 100 - s.strokes * 5), 'In the cup');
                s.x = 95; s.velocity = 0; s.strokes = 0; s.cup = [455, 535, 615][integer(env.random, 0, 2)]; s.next = s.time + .6;
            } else if (s.velocity < 6 || s.x > 680) { s.x = 95; s.velocity = 0; env.message('Try another power.'); }
        },
        render(s, p) {
            p.text('RIPPLE GOLF', 30, 26, 20);
            p.rect(45, 278, 640, 65, 'soft', 25); p.rect(s.cup - 20, 278, 40, 20, 'ink', 7);
            p.line([[s.cup + 18, 278], [s.cup + 18, 190], [s.cup + 65, 205], [s.cup + 18, 218]], 'accent', 3);
            p.ball(s.x, 265, 13);
            p.text(['SOFT', 'MEDIUM', 'FIRM'][s.power], 110, 150, 22, 'accent', 'center');
            for (let i = 0; i < 3; i++) p.circle(80 + i * 30, 190, 7, i <= s.power ? 'accent' : 'border');
            p.text(`${s.strokes} strokes`, 360, 380, 20, 'muted', 'center');
        }
    });
}

export function balance(env) {
    const state = { weights: [3, 3], angle: 0, velocity: 0, warning: 0, next: 4 };
    return game(state, {
        input(s, event) { s.weights[event.action === 'left' ? 0 : 1] += .6; },
        update(s, dt) {
            if (s.time > s.next) { s.weights[integer(env.random, 0, 1)] += .9; s.next = s.time + 4 / env.pace; }
            const torque = (s.weights[1] - s.weights[0]) * .5;
            s.velocity += (torque - s.angle * 3 - s.velocity * 2) * dt;
            s.angle += s.velocity * dt;
            s.warning = Math.abs(s.angle) > .55 ? s.warning + dt : Math.max(0, s.warning - dt);
            if (Math.abs(s.angle) < .25) s.score += dt * 3;
            if (s.warning > 1.4) {
                hurt(s, env, 'Counterweight the lighter side.');
                const average = (s.weights[0] + s.weights[1]) / 2;
                s.weights = [average, average]; s.angle = 0; s.velocity = 0; s.warning = 0;
            }
        },
        render(s, p) {
            hearts(s, p); p.text('PAPER BALANCE', 30, 26, 20);
            p.line([[360, 55], [360, 150]], 'muted', 2); p.circle(360, 150, 7);
            const c = p.c; c.save(); c.translate(360, 150); c.rotate(clamp(s.angle, -.8, .8));
            p.line([[-210, 0], [210, 0]], 'accent', 5);
            s.weights.forEach((weight, i) => {
                const x = i ? 190 : -190;
                p.line([[x, 0], [x, 95]], 'muted', 1);
                p.rect(x - 48, 95, 96, 60, 'soft', 4);
                p.text(weight.toFixed(1), x, 125, 28, 'accent', 'center');
            });
            c.restore();
            p.text('Keep the mobile close to level.', 360, 385, 20, 'muted', 'center');
        }
    });
}
