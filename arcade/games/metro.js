import { game, hurt, reward, hearts } from '../core/game.js';
import { integer } from '../core/random.js';

export function memory(env) {
    const state = { sequence: ['left'], phase: 'show', started: 0, index: 0, rounds: 0 };
    return game(state, {
        input(s, event) {
            if (s.phase !== 'repeat') { env.message('Watch the tiles first.'); return; }
            if (event.action !== s.sequence[s.index]) {
                hurt(s, env, 'Watch the same sequence again.'); s.phase = 'show'; s.started = s.time + .5; s.index = 0; return;
            }
            s.index++;
            if (s.index === s.sequence.length) {
                reward(s, env, s.sequence.length * 15, 'Sequence matched'); s.rounds++;
                s.sequence.push(env.random() < .5 ? 'left' : 'right');
                if (s.sequence.length > 6) s.sequence = s.sequence.slice(-4);
                s.phase = 'show'; s.started = s.time + 1; s.index = 0;
            }
        },
        update(s) {
            if (s.phase === 'show' && s.time >= s.started + s.sequence.length * 1.3) {
                s.phase = 'repeat'; env.message('Your turn');
            }
        },
        render(s, p) {
            hearts(s, p); p.text('TILE MEMORY', 30, 25, 20);
            const cue = Math.floor((s.time - s.started) / 1.3);
            for (const [side, x, color] of [['left', 110, '#0078ad'], ['right', 390, '#7434a6']]) {
                const lit = s.phase === 'show' && s.time >= s.started && s.sequence[cue] === side && (s.time - s.started) % 1.3 < .85;
                p.rect(x, 100, 220, 220, lit ? '#f1e8aa' : color);
                p.arrow(x + 110, 210, side, lit ? '#253344' : '#fff');
            }
            p.text(s.phase === 'show' ? 'Watch' : `Your turn / ${s.index + 1} of ${s.sequence.length}`, 360, 365, 25, 'ink', 'center');
        }
    });
}

export function collapse(row) {
    const packed = row.filter(Boolean), result = [];
    let points = 0;
    for (let i = 0; i < packed.length; i++) {
        if (packed[i] === packed[i + 1]) { result.push(packed[i] * 2); points += packed[i] * 2; i++; }
        else result.push(packed[i]);
    }
    while (result.length < row.length) result.push(0);
    return { row: result, points };
}

export function merge(env) {
    const state = { tiles: [2, 0, 2, 0, 0], moves: 0 };
    return game(state, {
        input(s, event) {
            const source = event.action === 'left' ? [...s.tiles] : [...s.tiles].reverse();
            const next = collapse(source);
            if (event.action === 'right') next.row.reverse();
            if (next.row.every((tile, i) => tile === s.tiles[i])) { env.message('Try the other direction.'); return; }
            s.tiles = next.row; s.moves++; reward(s, env, next.points);
            const free = s.tiles.map((value, i) => value ? -1 : i).filter(i => i >= 0);
            if (free.length) s.tiles[free[integer(env.random, 0, free.length - 1)]] = env.random() < .1 ? 4 : 2;
            if (!s.tiles.includes(0) && !s.tiles.some((tile, i) => i < 4 && tile === s.tiles[i + 1])) env.finish('Board full');
        },
        render(s, p) {
            p.text('TILE MERGE', 30, 25, 20);
            s.tiles.forEach((value, i) => {
                const colors = ['#145e93', '#654698', '#b3512b', '#347c62', '#a13b74'];
                const color = value ? colors[Math.log2(value) % colors.length] : 'soft';
                p.rect(40 + i * 133, 125, 120, 135, color);
                if (value) p.text(value, 100 + i * 133, 194, value >= 100 ? 35 : 45, '#fff', 'center');
            });
            p.text('Equal neighbours merge once per move.', 360, 325, 23, 'muted', 'center');
            p.text(`${s.moves} moves`, 360, 370, 20, 'muted', 'center');
        }
    });
}

export function rail(env) {
    const state = { route: 0, destination: 0, trains: [], lastDispatch: -2 };
    return game(state, {
        input(s, event) {
            if (event.action === 'left') { s.route = 1 - s.route; return; }
            if (s.time - s.lastDispatch < 1) { env.message('Leave room between trains.'); return; }
            s.trains.push({ progress: 0, target: s.destination, route: null });
            s.destination = integer(env.random, 0, 1); s.lastDispatch = s.time;
        },
        update(s, dt) {
            for (const train of s.trains) {
                train.progress += .22 * env.pace * dt;
                if (train.route == null && train.progress >= .5) train.route = s.route;
                if (!train.done && train.progress >= 1) {
                    train.done = true;
                    if (train.route === train.target) reward(s, env, 30, 'Arrived');
                    else hurt(s, env, 'Set the junction before the train reaches it.');
                }
            }
            s.trains = s.trains.filter(train => !train.done);
        },
        render(s, p) {
            hearts(s, p); p.text('RAIL JUNCTION', 30, 25, 20);
            p.line([[360, 360], [360, 220], [190, 85]], 'border', 9);
            p.line([[360, 220], [530, 85]], 'border', 9);
            p.line([[360, 250], [360, 220], [s.route ? 410 : 310, 180]], 'accent', 8);
            p.rect(135, 58, 110, 45, '#0078ad'); p.rect(475, 58, 110, 45, '#a23d79');
            p.text('A', 190, 80, 25, '#fff', 'center'); p.text('B', 530, 80, 25, '#fff', 'center');
            for (const train of s.trains) {
                const t = train.progress;
                const x = t < .5 ? 360 : 360 + (train.route ? 170 : -170) * (t - .5) * 2;
                const y = t < .5 ? 360 - t * 280 : 220 - (t - .5) * 270;
                p.rect(x - 16, y - 20, 32, 40, train.target ? '#a23d79' : '#0078ad');
            }
            p.text(`Next train: ${s.destination ? 'B' : 'A'}`, 550, 350, 22, 'ink', 'center');
        }
    });
}
