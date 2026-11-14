import { game, hurt, reward, hearts } from '../core/game.js';
import { clamp, integer, distance } from '../core/random.js';

export function school(env) {
    const state = { gates: [false, false], swimmers: [{ lane: 0, y: 70, shark: false }], next: 3, groups: 0 };
    return game(state, {
        input(s, event) {
            const lane = event.action === 'left' ? 0 : 1;
            s.gates[lane] = !s.gates[lane];
            env.message(s.gates[lane] ? 'Gate open' : 'Gate closed');
        },
        update(s, dt) {
            if (s.time > s.next) {
                const lane = integer(env.random, 0, 1); s.groups++;
                if (s.groups % 3 === 0) s.swimmers.push({ lane, y: 40, shark: true });
                else for (let i = 0; i < 3; i++) s.swimmers.push({ lane, y: 40 - i * 34, shark: false });
                s.next = s.time + 3.5 / env.pace;
            }
            for (const fish of s.swimmers) {
                fish.y += 55 * env.pace * dt;
                if (!fish.done && fish.y > 300) {
                    fish.done = true;
                    if (fish.shark && s.gates[fish.lane]) { hurt(s, env, 'Close the gate for the warning silhouette.'); s.gates[fish.lane] = false; }
                    else if (fish.shark) reward(s, env, 20, 'Reef protected');
                    else if (s.gates[fish.lane]) reward(s, env, 5);
                    else env.message('Open a gate for the fish.');
                }
            }
            s.swimmers = s.swimmers.filter(fish => !fish.done);
        },
        render(s, p) {
            hearts(s, p); p.text('SCHOOL RESCUE', 30, 27, 18);
            for (let lane = 0; lane < 2; lane++) {
                const x = 220 + lane * 280;
                p.line([[x, 65], [x, 320]], 'border', 1, [4, 8]);
                p.rect(x - 85, 307, 170, 12, s.gates[lane] ? 'soft' : 'accent', 6);
                p.text(s.gates[lane] ? 'OPEN' : 'CLOSED', x, 365, 19, 'ink', 'center');
            }
            for (const fish of s.swimmers) {
                const x = 220 + fish.lane * 280;
                if (fish.shark) { p.line([[x - 38, fish.y], [x + 30, fish.y], [x - 6, fish.y - 23], [x - 10, fish.y]], 'ink', 6); p.text('!', x + 50, fish.y, 27, 'gold'); }
                else if (!p.sprite('fish', x - 40, fish.y - 22, 80, 45)) p.ball(x, fish.y, 12);
            }
        }
    });
}

export function bubbles(env) {
    const state = { arc: 0, shot: null, bubbles: [], rounds: 0 };
    function refill(s) {
        s.bubbles = [];
        for (const start of [140, 420]) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            s.bubbles.push({ x: start + col * 70, y: 95 + row * 62 });
        }
        s.rounds++;
    }
    refill(state);
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.arc = 1 - s.arc; return; }
            if (!s.shot) s.shot = { x: 360, y: 380, vx: s.arc ? 105 : -105, vy: -300 };
            else env.message('One bubble at a time.');
        },
        update(s, dt) {
            if (!s.shot) return;
            const shot = s.shot; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.vy += 120 * dt;
            const hit = s.bubbles.find(bubble => distance(bubble, shot) < 35);
            if (hit) {
                const burst = new Set([hit]);
                for (const bubble of burst) for (const neighbor of s.bubbles) {
                    if (distance(bubble, neighbor) < 78) burst.add(neighbor);
                }
                reward(s, env, burst.size * 10, `${burst.size} bubbles in the cascade`);
                s.bubbles = s.bubbles.filter(bubble => !burst.has(bubble)); s.shot = null;
                if (!s.bubbles.length) refill(s);
            } else if (shot.y > 430 || shot.x < 0 || shot.x > 720) { s.shot = null; env.message('Try the other arc.'); }
        },
        render(s, p) {
            p.text('BUBBLE CASCADE', 30, 27, 18);
            s.bubbles.forEach((bubble, i) => p.ball(bubble.x, bubble.y, 25, i % 2 ? 'accent' : 'gold'));
            p.circle(360, 380, 22, 'soft');
            p.line([[360, 380], [360 + (s.arc ? 50 : -50), 310]], 'accent', 5);
            if (s.shot) p.ball(s.shot.x, s.shot.y, 13);
            else p.ball(360, 380, 13);
        }
    });
}

export function garden(env) {
    const state = { plants: Array.from({ length: 3 }, () => ({ water: .6, light: .6, growth: 0 })), active: 0, next: 6 };
    return game(state, {
        input(s, event) {
            const plant = s.plants[s.active], key = event.action === 'left' ? 'water' : 'light';
            plant[key] += .25;
            if (plant[key] > 1.25) { hurt(s, env, 'A little care is enough.'); plant[key] = .65; }
        },
        update(s, dt) {
            for (const plant of s.plants) {
                plant.water = Math.max(0, plant.water - .013 * dt * env.pace);
                plant.light = Math.max(0, plant.light - .011 * dt * env.pace);
                if (plant.water > .25 && plant.light > .25) { plant.growth += dt * .3; s.score += dt; }
            }
            if (s.time >= s.next) { s.active = (s.active + 1) % 3; s.next = s.time + 6; }
        },
        render(s, p) {
            hearts(s, p); p.text('LIVING GARDEN', 30, 27, 18);
            s.plants.forEach((plant, i) => {
                const x = 160 + i * 200, height = 40 + Math.min(105, plant.growth * 5);
                p.rect(x - 45, 300, 90, 55, '#9dbb91', 10);
                p.line([[x, 300], [x, 300 - height]], '#448957', 5);
                p.c.save(); p.c.translate(x, 300 - height * .6); p.c.rotate(-.5);
                p.c.fillStyle = '#70b75a'; p.c.beginPath(); p.c.ellipse(-19, 0, 26, 11, 0, 0, Math.PI * 2); p.c.fill(); p.c.restore();
                if (plant.growth > 8) p.ball(x, 300 - height, 17, 'gold');
                p.rect(x - 50, 365, 100, 7, 'soft', 4); p.rect(x - 50, 365, clamp(plant.water, 0, 1) * 100, 7, '#45acda', 4);
                p.rect(x - 50, 382, 100, 7, 'soft', 4); p.rect(x - 50, 382, clamp(plant.light, 0, 1) * 100, 7, '#d7af41', 4);
                if (i === s.active) { p.outline(x - 72, 65, 144, 335, 'accent', 2); p.text('CARE', x, 90, 17, 'accent', 'center'); }
            });
        }
    });
}
