import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';
import { clamp, integer } from '../core/random.js';

export function sort(env) {
    const files = ['photo.png', 'notes.txt', 'holiday.jpg', 'readme.md', 'icon.png', 'letter.txt'];
    const state = { file: 'photo.png', correct: 'left', deadline: 4, streak: 0 };
    function next(s) {
        s.file = files[integer(env.random, 0, files.length - 1)];
        s.correct = /png|jpg/.test(s.file) ? 'left' : 'right';
        s.deadline = s.time + Math.max(2.5, 4 - s.score / 250) / env.pace;
    }
    return game(state, {
        feedback(s, event) { return { x: event.action === 'left' ? 150 : 570, y: 300 }; },
        input(s, event) {
            if (event.action === s.correct) { s.streak++; reward(s, env, 10 + Math.min(10, s.streak), 'Copied'); }
            else { s.streak = 0; hurt(s, env, 'Images on the left. Text on the right.'); }
            next(s);
        },
        update(s) { if (s.time > s.deadline) { hurt(s, env, 'The file waited too long.'); next(s); } },
        render(s, p) {
            hearts(s, p); p.text('COPY FILES', 30, 27, 18);
            for (const [x, label] of [[150, 'Images'], [570, 'Text']]) {
                p.rect(x - 60, 270, 120, 70, '#f0cd55'); p.rect(x - 60, 258, 52, 20, '#f0cd55');
                p.outline(x - 60, 270, 120, 70, '#8c740c', 1); p.text(label, x, 370, 24, 'ink', 'center');
            }
            p.rect(325, 90, 70, 84, '#fff'); p.outline(325, 90, 70, 84, '#888');
            p.line([[340, 110], [378, 110]], '#000080'); p.line([[340, 125], [378, 125]], '#000080');
            p.text(s.file, 360, 208, 27, 'ink', 'center');
            p.rect(260, 230, 200, 7, 'soft');
            p.rect(260, 230, clamp((s.deadline - s.time) / 5, 0, 1) * 200, 7, '#000080');
        }
    });
}

export function stack(env) {
    const state = { x: 30, velocity: 85, width: 290, layers: [{ x: 215, width: 290 }], placements: 0 };
    return game(state, {
        feedback(s, event) { return { x: s.x + s.width / 2, y: 322 - (s.layers.length - 1) * 28 }; },
        input(s, event) {
            if (event.action === 'right') { s.velocity *= -1; return; }
            const last = s.layers.at(-1);
            const left = Math.max(last.x, s.x), right = Math.min(last.x + last.width, s.x + s.width);
            if (right - left < 35) { hurt(s, env, 'Wait for more overlap.'); s.x = 30; return; }
            s.width = Math.max(115, right - left);
            s.layers.push({ x: left, width: s.width }); s.layers = s.layers.slice(-9);
            s.placements++; reward(s, env, 15, 'Window placed'); s.x = 15;
            s.velocity = Math.abs(s.velocity) + 2;
        },
        update(s, dt) {
            s.x += s.velocity * env.pace * dt;
            if (s.x < 15 || s.x + s.width > 705) { s.x = clamp(s.x, 15, 705 - s.width); s.velocity *= -1; }
        },
        render(s, p) {
            hearts(s, p); p.text('WINDOW STACK', 30, 27, 18);
            s.layers.forEach((layer, i) => {
                const y = 350 - i * 28;
                p.rect(layer.x, y, layer.width, 27, '#c0c0c0'); p.outline(layer.x, y, layer.width, 27, '#fff', 1);
                p.rect(layer.x + 3, y + 3, layer.width - 6, 8, '#000080');
            });
            const y = 322 - (s.layers.length - 1) * 28;
            p.rect(s.x, y, s.width, 27, '#c0c0c0'); p.rect(s.x + 3, y + 3, s.width - 6, 8, '#000080');
            p.text(`${s.placements} windows`, 360, 390, 19, 'muted', 'center');
        }
    });
}

export function ski(env) {
    const state = { lane: 1, gates: [{ gap: 1, y: 60 }], nextGate: 3.5 };
    return game(state, {
        feedback(s, event) { return { x: 150 + s.lane * 210, y: 325 }; },
        input(s, event) { s.lane = clamp(s.lane + (event.action === 'left' ? -1 : 1), 0, 2); },
        update(s, dt) {
            if (s.time > s.nextGate) { s.gates.push({ gap: integer(env.random, 0, 2), y: -20 }); s.nextGate = s.time + 3 / env.pace; }
            for (const gate of s.gates) {
                gate.y += (65 + s.time * .35) * env.pace * dt;
                if (!gate.passed && gate.y > 325) {
                    gate.passed = true;
                    if (s.lane === gate.gap) reward(s, env, 20, 'Clear'); else hurt(s, env, 'Use the open lane.');
                }
            }
            s.gates = s.gates.filter(gate => gate.y < 440);
        },
        render(s, p) {
            p.rect(45, 48, 630, 355, '#edf5fb'); hearts(s, p);
            p.text('SKI RUN', 30, 25, 18);
            for (const x of [255, 465]) p.line([[x, 50], [x, 400]], '#b5d0df', 1, [5, 10]);
            for (const gate of s.gates) for (let lane = 0; lane < 3; lane++) {
                if (lane === gate.gap) continue;
                const x = 150 + lane * 210;
                p.line([[x - 32, gate.y + 20], [x, gate.y - 25], [x + 32, gate.y + 20], [x - 32, gate.y + 20]], '#2d7651', 5);
                p.rect(x - 3, gate.y + 20, 6, 18, '#79593a');
            }
            const x = 150 + s.lane * 210;
            p.circle(x, 317, 8, '#dd6e37'); p.line([[x, 325], [x, 343]], '#000080', 5);
            p.line([[x - 14, 352], [x - 8, 333], [x + 8, 333], [x + 14, 352]], '#000080', 3);
        }
    });
}
