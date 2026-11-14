import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';
import { clamp, integer } from '../core/random.js';

export function invaders(env) {
    const state = { x: 360, bullets: [], aliens: [], nextShot: 0, wave: 0 };
    function fleet(s) {
        s.wave++;
        s.aliens = Array.from({ length: 10 }, (_, i) => ({ x: 130 + i % 5 * 110,
            y: 75 + Math.floor(i / 5) * 58, alive: true }));
    }
    fleet(state);
    return game(state, {
        feedback(s, event) { return { x: s.x, y: 360 }; },
        input(s, event) { s.x = clamp(s.x + (event.action === 'left' ? -90 : 90), 55, 665); },
        update(s, dt) {
            if (s.time >= s.nextShot) { s.bullets.push({ x: s.x, y: 352 }); s.nextShot = s.time + .85; }
            for (const bullet of s.bullets) {
                bullet.y -= 230 * dt;
                const hit = s.aliens.find(a => a.alive && Math.abs(a.x - bullet.x) < 27 && Math.abs(a.y - bullet.y) < 20);
                if (hit) { hit.alive = false; bullet.y = -100; reward(s, env, 10); }
            }
            s.bullets = s.bullets.filter(b => b.y > 0);
            for (const alien of s.aliens) {
                alien.x += Math.cos(s.time * .65) * 16 * dt;
                alien.y += (6 + s.wave) * env.pace * dt;
                if (alien.alive && alien.y > 345) { alien.alive = false; hurt(s, env, 'One slipped through.'); }
            }
            if (!s.aliens.some(a => a.alive)) fleet(s);
        },
        render(s, p) {
            p.text(`FLEET ${s.wave}`, 30, 26, 17, 'accent'); hearts(s, p);
            for (const a of s.aliens.filter(a => a.alive)) {
                p.rect(a.x - 18, a.y - 9, 36, 18); p.rect(a.x - 26, a.y, 8, 16);
                p.rect(a.x + 18, a.y, 8, 16); p.rect(a.x - 10, a.y - 4, 5, 5, 'bg');
                p.rect(a.x + 5, a.y - 4, 5, 5, 'bg');
            }
            s.bullets.forEach(b => p.rect(b.x - 2, b.y, 4, 12));
            p.rect(s.x - 25, 360, 50, 15); p.rect(s.x - 5, 347, 10, 15);
            p.line([[25, 389], [695, 389]], 'muted', 1);
        }
    });
}

export function lander(env) {
    const state = { y: 65, velocity: 5, fuel: 100, landings: 0, flame: 0 };
    const reset = s => { s.y = 65; s.velocity = 5; s.fuel = 100; };
    return game(state, {
        feedback(s, event) { return { x: 360, y: s.y }; },
        input(s, event) {
            if (s.fuel <= 0) { env.message('No fuel left. Watch the descent.'); return; }
            if (event.action === 'left') { s.velocity -= 28; s.fuel -= 7; s.flame = .35; }
            else { s.velocity *= .4; s.fuel -= 4; env.message('Air brake'); }
        },
        update(s, dt) {
            s.velocity += (13 + s.landings) * env.pace * dt;
            s.y = Math.max(45, s.y + s.velocity * dt); s.flame = Math.max(0, s.flame - dt);
            if (s.y >= 340) {
                if (s.velocity < 32) { reward(s, env, 100, 'Soft landing'); s.landings++; }
                else hurt(s, env, 'Too fast. A short thrust slows the descent.');
                reset(s);
            }
        },
        render(s, p) {
            hearts(s, p); p.text('LUNAR APPROACH', 30, 25, 17);
            p.line([[0, 375], [70, 340], [140, 368], [230, 350], [280, 365], [440, 365], [530, 345], [620, 370], [720, 330]], 'accent');
            p.line([[285, 365], [435, 365]], 'ink', 5);
            p.outline(341, s.y - 18, 38, 28); p.line([[341, s.y], [326, s.y + 23], [318, s.y + 23]]);
            p.line([[379, s.y], [394, s.y + 23], [402, s.y + 23]]);
            if (s.flame) p.line([[352, s.y + 13], [360, s.y + 40], [368, s.y + 13]], 'gold', 3);
            p.text(`DESCENT ${Math.round(s.velocity)}`, 40, 90, 19);
            p.text(`FUEL ${Math.max(0, s.fuel)}`, 40, 125, 19);
            p.rect(40, 150, Math.max(0, s.fuel) * 1.5, 5);
            p.text('SOFT: BELOW 32', 510, 345, 16, 'muted');
        }
    });
}

export function snake(env) {
    const state = { body: [{ x: 8, y: 4 }, { x: 7, y: 4 }, { x: 6, y: 4 }],
        direction: 0, turn: null, nextStep: 1.5, food: { x: 12, y: 4 } };
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    function food(s) {
        const free = [];
        for (let y = 0; y < 9; y++) for (let x = 0; x < 18; x++) {
            if (!s.body.some(part => part.x === x && part.y === y)) free.push({ x, y });
        }
        if (!free.length) { env.finish('Grid complete'); return; }
        s.food = free[integer(env.random, 0, free.length - 1)];
    }
    return game(state, {
        feedback(s, event) { return { x: 103 + s.body[0].x * 30, y: 83 + s.body[0].y * 30 }; },
        input(s, event) {
            if (s.turn != null) { env.message('Turn already set for the next step.'); return; }
            s.turn = event.action === 'left' ? -1 : 1;
        },
        pause(s) { s.turn = null; },
        update(s) {
            if (s.time < s.nextStep) return;
            s.nextStep = s.time + Math.max(.95, 1.4 - s.time * .003) / env.pace;
            s.direction = (s.direction + (s.turn || 0) + 4) % 4; s.turn = null;
            const [dx, dy] = directions[s.direction];
            const next = { x: s.body[0].x + dx, y: s.body[0].y + dy };
            const eating = next.x === s.food.x && next.y === s.food.y;
            const occupied = eating ? s.body : s.body.slice(0, -1);
            if (next.x < 0 || next.x >= 18 || next.y < 0 || next.y >= 9 || occupied.some(p => p.x === next.x && p.y === next.y)) {
                hurt(s, env, 'Watch the next corner.');
                s.body = [{ x: 8, y: 4 }, { x: 7, y: 4 }]; s.direction = 0; food(s); return;
            }
            s.body.unshift(next);
            if (eating) { reward(s, env, 20); food(s); }
            else s.body.pop();
        },
        render(s, p) {
            hearts(s, p); p.text('SIGNAL ROUTING', 30, 25, 17);
            p.outline(88, 68, 544, 274, 'muted', 1);
            s.body.forEach((part, i) => p.rect(90 + part.x * 30, 70 + part.y * 30, 26, 26, i ? 'accent' : 'ink'));
            p.text('+', 103 + s.food.x * 30, 83 + s.food.y * 30, 28, 'gold', 'center');
            p.text(s.turn == null ? 'NEXT CORNER: FREE' : 'TURN SET', 360, 377, 17, 'muted', 'center');
        }
    });
}
