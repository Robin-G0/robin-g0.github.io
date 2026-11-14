import { game, hurt, reward } from '../core/game.js';
import { integer } from '../core/random.js';

export function clockwork(env) {
    const state = { gears: [0, 0], targets: [2, 3], solved: 0 };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.gears[0] = (s.gears[0] + 1) % 8; s.gears[1] = (s.gears[1] + 1) % 8; }
            else s.gears[1] = (s.gears[1] + 1) % 8;
            if (s.gears.every((gear, i) => gear === s.targets[i])) {
                reward(s, env, 80, 'Mechanism aligned'); s.solved++;
                s.targets = s.gears.map(gear => (gear + integer(env.random, 1, 3)) % 8);
            }
        },
        render(s, p) {
            p.text('CLOCKWORK / ALIGNMENT STUDY', 30, 26, 17);
            for (let i = 0; i < 2; i++) {
                const x = 225 + i * 270, y = 215;
                p.circle(x, y, 83, 'muted', false); p.circle(x, y, 72, 'border', false);
                for (let mark = 0; mark < 8; mark++) {
                    const a = mark * Math.PI / 4;
                    p.line([[x + Math.sin(a) * 76, y - Math.cos(a) * 76], [x + Math.sin(a) * 89, y - Math.cos(a) * 89]], 'muted');
                }
                const target = s.targets[i] * Math.PI / 4, angle = s.gears[i] * Math.PI / 4;
                p.circle(x + Math.sin(target) * 91, y - Math.cos(target) * 91, 7, 'gold', false);
                p.line([[x, y], [x + Math.sin(angle) * 66, y - Math.cos(angle) * 66]], 'accent', 4);
                p.circle(x, y, 6, 'ink'); p.text(i + 1, x, 350, 23, 'muted', 'center');
            }
            p.line([[308, 215], [412, 215]], 'border', 1, [2, 5]);
        }
    });
}

export function containsPoint(polygon, point) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

export function contour(env) {
    const state = { path: [{ x: 1, y: 1 }], direction: 0, point: { x: 3.5, y: 2.5 }, surveys: 0 };
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const reset = s => { s.path = [{ x: 1, y: 1 }]; s.direction = 0; };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.direction = (s.direction + 1) % 4; return; }
            const last = s.path.at(-1), [dx, dy] = directions[s.direction];
            const next = { x: last.x + dx, y: last.y + dy };
            if (next.x < 0 || next.x > 8 || next.y < 0 || next.y > 5) { env.message('Turn before the edge of the paper.'); return; }
            const closing = s.path.length >= 4 && next.x === s.path[0].x && next.y === s.path[0].y;
            if (closing) {
                if (containsPoint(s.path, s.point)) { reward(s, env, 100, 'Survey enclosed'); s.surveys++; }
                else env.message('The survey point needs to be inside.');
                reset(s); return;
            }
            if (s.path.some(point => point.x === next.x && point.y === next.y)) {
                hurt(s, env, 'The boundary crossed itself. Start a new outline.'); reset(s); return;
            }
            s.path.push(next);
        },
        render(s, p) {
            p.text('CONTOUR SURVEY', 30, 26, 18);
            const project = point => [110 + point.x * 60, 75 + point.y * 53];
            for (let x = 0; x <= 8; x++) for (let y = 0; y <= 5; y++) p.circle(...project({ x, y }), 1.5, 'muted');
            p.circle(...project(s.point), 10, 'gold', false); p.circle(...project(s.point), 3, 'gold');
            p.line(s.path.map(project), 'accent', 3); p.circle(...project(s.path[0]), 5, 'ink');
            const last = s.path.at(-1), [dx, dy] = directions[s.direction], [px, py] = project(last);
            p.line([[px, py], [px + dx * 27, py + dy * 27]], 'ink', 3);
            p.text('Turn clockwise / draw one segment', 360, 395, 18, 'muted', 'center');
        }
    });
}

const stars = [{ x: 120, y: 245 }, { x: 280, y: 170 }, { x: 450, y: 265 }, { x: 585, y: 195 }, { x: 350, y: 355 }];
export function constellations(env) {
    const state = { sequence: [0, 2, 4, 1, 3], path: [0], selected: 1 };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.selected = (s.selected + 1) % stars.length; return; }
            if (s.selected !== s.sequence[s.path.length]) { env.message('Follow the next star in the reference.'); return; }
            s.path.push(s.selected); reward(s, env, 20);
            if (s.path.length === stars.length) {
                env.message('Constellation drawn');
                const tail = [1, 2, 3, 4];
                for (let i = tail.length - 1; i > 0; i--) { const j = integer(env.random, 0, i); [tail[i], tail[j]] = [tail[j], tail[i]]; }
                s.sequence = [0, ...tail]; s.path = [0];
            }
            s.selected = (s.selected + 1) % stars.length;
        },
        render(s, p) {
            p.text('CONSTELLATION / FIELD SKETCH', 30, 26, 17);
            const reference = index => [385 + stars[index].x * .37, 5 + stars[index].y * .29];
            p.line(s.sequence.map(reference), 'muted', 1);
            s.sequence.forEach((star, i) => { const [x, y] = reference(star); p.circle(x, y, 2, 'ink'); p.text(i + 1, x + 9, y, 14, 'muted'); });
            p.line(s.path.map(index => [stars[index].x, stars[index].y]), 'accent', 2);
            stars.forEach((star, i) => {
                p.line([[star.x - 6, star.y], [star.x + 6, star.y]], 'ink');
                p.line([[star.x, star.y - 6], [star.x, star.y + 6]], 'ink');
                if (i === s.selected) p.circle(star.x, star.y, 18, 'accent', false);
            });
            p.text('Select a star / draw the connection', 360, 395, 18, 'muted', 'center');
        }
    });
}
