import { game, hurt, reward, hearts } from '../core/game.js?v=tutorial-3';
import { clamp, integer, distance } from '../core/random.js';

const rotateCell = (x, y, turns) => {
    for (let i = 0; i < turns; i++) [x, y] = [4 - y, x];
    return { x, y };
};

export function traceMirrors(mirrors, rotation = 0) {
    const start = rotateCell(-1, 2, rotation), target = rotateCell(5, 4, rotation);
    let dx = 1, dy = 0;
    for (let i = 0; i < rotation; i++) [dx, dy] = [-dy, dx];
    let { x, y } = start;
    const path = [{ x, y }];
    const seen = new Set();
    for (let step = 0; step < 80; step++) {
        x += dx; y += dy; path.push({ x, y });
        if (x < 0 || x > 4 || y < 0 || y > 4) break;
        const key = `${x},${y},${dx},${dy}`;
        if (seen.has(key)) break;
        seen.add(key);
        const mirror = mirrors.find(mirror => mirror.x === x && mirror.y === y);
        if (mirror) [dx, dy] = mirror.angle === 0 ? [-dy, -dx] : [dy, dx];
    }
    return { path, hit: x === target.x && y === target.y, target };
}

export function prisms(env) {
    const state = { mirrors: [], selected: 0, rotation: 0, solved: false, next: 0 };
    function setup(s) {
        const cells = [[1, 2], [1, 0], [3, 0], [3, 4]];
        s.mirrors = cells.map(([x, y], i) => ({ ...rotateCell(x, y, s.rotation), angle: (i > 1 ? 1 : 0) ^ s.rotation % 2 }));
        // Start one or two flips away from a known solvable optical route.
        s.mirrors[0].angle ^= 1; s.mirrors[2].angle ^= 1;
        s.solved = false; s.selected = 0;
    }
    setup(state);
    return game(state, {
        feedback(s, event) { return { x: 226 + s.mirrors[s.selected].x * 62, y: 86 + s.mirrors[s.selected].y * 62 }; },
        input(s, event) {
            if (s.solved) { env.message('Light received. The next puzzle is arriving.'); return; }
            if (event.action === 'left') s.mirrors[s.selected].angle ^= 1;
            else s.selected = (s.selected + 1) % 4;
            if (traceMirrors(s.mirrors, s.rotation).hit) {
                reward(s, env, 100, 'Light received'); s.solved = true; s.next = s.time + 1;
            }
        },
        update(s) { if (s.solved && s.time >= s.next) { s.rotation = (s.rotation + 1) % 4; setup(s); } },
        render(s, p) {
            p.text('PRISMS', 30, 26, 20);
            const ray = traceMirrors(s.mirrors, s.rotation);
            for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) p.outline(195 + x * 62, 55 + y * 62, 62, 62, 'border', .5);
            const screen = point => [226 + point.x * 62, 86 + point.y * 62];
            p.line(ray.path.map(screen), s.solved ? '#b3f6ba' : '#8fe7ff', 4);
            p.circle(...screen(ray.target), 14, 'gold', false);
            s.mirrors.forEach((mirror, i) => {
                const [x, y] = screen(mirror), sign = mirror.angle ? 1 : -1;
                p.line([[x - 20, y - sign * 20], [x + 20, y + sign * 20]], 'ink', 5);
                if (i === s.selected) p.circle(x, y, 28, 'accent', false);
            });
        }
    });
}

export function abyss(env) {
    const state = { y: 210, velocity: 0, reefs: [{ x: 500, gap: 210 }], next: 6 };
    return game(state, {
        feedback(s, event) { return { x: 175, y: s.y }; },
        input(s, event) { s.velocity = event.action === 'left' ? -65 : 45; },
        update(s, dt) {
            s.velocity += 10 * dt; s.velocity *= Math.exp(-dt * .18); s.y += s.velocity * dt;
            if (s.y < 50 || s.y > 370) { hurt(s, env, 'Keep the jellyfish in open water.'); s.y = 210; s.velocity = 0; }
            if (s.time > s.next) { s.reefs.push({ x: 750, gap: integer(env.random, 140, 280) }); s.next = s.time + 6 / env.pace; }
            for (const reef of s.reefs) {
                reef.x -= 55 * env.pace * dt;
                if (!reef.passed && reef.x < 175) {
                    reef.passed = true;
                    if (Math.abs(s.y - reef.gap) > 73) hurt(s, env, 'Aim for the clear water.');
                    else reward(s, env, 30, 'Reef passed');
                }
            }
            s.reefs = s.reefs.filter(reef => reef.x > -60);
        },
        render(s, p) {
            hearts(s, p); p.text('ABYSS DRIFT', 30, 26, 20);
            for (const reef of s.reefs) {
                p.rect(reef.x, 45, 40, reef.gap - 130, '#1c354a', 8);
                p.rect(reef.x, reef.gap + 85, 40, 375 - reef.gap - 85, '#1c354a', 8);
                p.line([[reef.x + 4, reef.gap - 88], [reef.x + 35, reef.gap - 88]], '#7fbecc', 1);
            }
            if (!p.sprite('jelly', 140, s.y - 45, 70, 90)) p.ball(175, s.y, 19);
        }
    });
}

const angles = [-.1, 0, .1];
export function probeStep(probe, gravity, dt) {
    const dx = 360 - probe.x, dy = 210 - probe.y;
    const radius = Math.max(1, Math.hypot(dx, dy));
    probe.vx += gravity * dx / radius ** 3 * dt;
    probe.vy += gravity * dy / radius ** 3 * dt;
    probe.x += probe.vx * dt; probe.y += probe.vy * dt;
}
export function probeRoute(angle, gravity) {
    const probe = { x: 95, y: 310, vx: 180 * Math.cos(angle), vy: 180 * Math.sin(angle) };
    const path = [{ x: probe.x, y: probe.y }];
    for (let i = 0; i < 500; i++) {
        probeStep(probe, gravity, .02); path.push({ x: probe.x, y: probe.y });
        if (probe.x >= 625 || probe.y < 25 || probe.y > 395 || distance(probe, { x: 360, y: 210 }) < 50) break;
    }
    return path;
}

export function orbit(env) {
    const state = { selected: 1, probe: null, gravity: 450000, target: { x: 625, y: 239 }, rounds: 0 };
    function target(s) {
        const index = integer(env.random, 0, 2);
        s.target = probeRoute(angles[index], s.gravity).at(-1);
    }
    target(state);
    return game(state, {
        feedback(s, event) { return { x: 95, y: 310 }; },
        input(s, event) {
            if (event.action === 'left') { s.selected = (s.selected + 1) % 3; return; }
            if (!s.probe) {
                const angle = angles[s.selected];
                s.probe = { x: 95, y: 310, vx: 180 * Math.cos(angle), vy: 180 * Math.sin(angle), trail: [] };
            } else env.message('Probe in flight. Wait before launching another.');
        },
        update(s, dt) {
            if (!s.probe) return;
            const probe = s.probe;
            // Small substeps keep the orbital trajectory stable on a slow device.
            let remaining = dt * env.pace;
            while (remaining > 0) { const step = Math.min(.02, remaining); probeStep(probe, s.gravity, step); remaining -= step; }
            probe.trail.push({ x: probe.x, y: probe.y }); probe.trail = probe.trail.slice(-180);
            if (distance(probe, s.target) < 28) { reward(s, env, 75, 'Probe received'); s.probe = null; s.rounds++; target(s); }
            else if (probe.x > 720 || probe.y < 10 || probe.y > 410 || distance(probe, { x: 360, y: 210 }) < 50) {
                s.probe = null; env.message('Try another launch angle.');
            }
        },
        render(s, p) {
            p.text('ORBITAL ASSIST', 30, 26, 20);
            p.circle(360, 210, 96, 'border', false); p.circle(360, 210, 50, 'soft');
            p.sprite('earth', 295, 145, 130, 130);
            p.circle(s.target.x, s.target.y, 28, 'gold', false);
            if (s.probe) { p.line(s.probe.trail.map(point => [point.x, point.y]), 'accent', 2); p.circle(s.probe.x, s.probe.y, 6, 'ink'); }
            else {
                const preview = probeRoute(angles[s.selected], s.gravity).slice(0, 30);
                p.line(preview.map(point => [point.x, point.y]), 'accent', 2, [3, 6]); p.circle(95, 310, 7, 'ink');
            }
            p.text(`Launch angle ${s.selected + 1} / 3`, 360, 390, 19, 'muted', 'center');
        }
    });
}
