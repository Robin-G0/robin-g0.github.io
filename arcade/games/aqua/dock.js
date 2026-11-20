import { game } from '../../core/game.js?v=eras-4';
import { integer } from '../../core/random.js?v=eras-4';
import { decodeGesture } from '../../core/commands.js?v=eras-4';
import { toolbar, gel, progress, beachball, genie, poof, isDark, text, linear,
    addBurst, bursts, pruneBursts, addEffect, pruneEffects, loseLife } from './display.js?v=eras-4';

// Dock Bounce: seven icons on the Dock. Apps bounce to ask for attention; later some hang with the
// wait cursor. Sweep either wrist sideways to glide the magnified pointer one icon; raise L to open
// the bouncing app under it, raise R to force-quit the hung one. A request that runs out costs a life.
export const DOCK = { icons: 7, start: 3, fuse: 12, minFuse: 8, urgentFuse: .7, spawn: 4.6, minSpawn: 3.4, first: 1.2,
    points: { open: 20, quit: 30 }, speed: 20, urgent: 2, heartEvery: 8, glide: .2,
    stages: [0, 20, 40, 70], limits: [1, 2, 2, 3], hangChance: .4, urgentChance: .3 };
export const APPS = Object.freeze([
    { name: 'Mail', tone: 'blue', glyph: 'mail' }, { name: 'Web', tone: 'blue', glyph: 'globe' },
    { name: 'Music', tone: 'purple', glyph: 'note' }, { name: 'Photos', tone: 'orange', glyph: 'photo' },
    { name: 'Chat', tone: 'green', glyph: 'chat' }, { name: 'Calendar', tone: 'red', glyph: 'calendar' },
    { name: 'Terminal', tone: 'graphite', glyph: 'terminal' }
]);
/** Stage 0 one bouncing app at a time; 1 two at once; 2 hung apps (force quit with R); 3 urgent badges (x2, shorter fuse), three at once. */
export const stageAt = time => DOCK.stages.filter(at => time >= at).length - 1;
export const fuseSeconds = (pace, urgent = false) => Math.max(DOCK.minFuse, DOCK.fuse / pace) * (urgent ? DOCK.urgentFuse : 1);
export const spawnSeconds = pace => Math.max(DOCK.minSpawn, DOCK.spawn / pace);
/** Opening (L raise) answers a bouncing app; force-quitting (R raise) answers a hung one. */
export const verbFor = wrist => wrist === 'left' ? 'open' : 'quit';
export const needs = request => request.kind === 'hang' ? 'quit' : 'open';
export function requestPoints(request, time) {
    const left = Math.max(0, request.due - time) / (request.due - request.born);
    return (DOCK.points[needs(request)] + Math.round(DOCK.speed * left)) * (request.urgent ? DOCK.urgent : 1);
}
const STAGE_NEWS = ['', 'new · two apps at once', 'new · hung apps: raise R to force quit', 'new · urgent ! badges score ×2'];

export function dock(env) {
    const s = { cursor: DOCK.start, from: DOCK.start, movedAt: -10, requests: [], nextSpawn: DOCK.first, served: 0, streak: 0,
        stage: 0, ids: 0, bumpAt: -10, bursts: [], effects: [], ended: false };
    function spawn() {
        const busy = new Set(s.requests.map(r => r.icon));
        const free = APPS.map((_, i) => i).filter(i => !busy.has(i) && i !== s.cursor); // Never under the pointer: idle earns nothing.
        if (!free.length) return;
        const icon = free[integer(env.random, 0, free.length - 1)];
        const kind = s.stage >= 2 && env.random() < DOCK.hangChance ? 'hang' : 'bounce';
        const urgent = s.stage >= 3 && env.random() < DOCK.urgentChance, fuse = fuseSeconds(env.pace, urgent);
        s.requests.push({ id: ++s.ids, icon, kind, urgent, born: s.time, due: s.time + fuse });
        env.sound?.({ kind: 'input', action: icon < 3 ? 'left' : 'right' });
    }
    function answer(verb) {
        const request = s.requests.find(r => r.icon === s.cursor);
        if (!request) { addEffect(s, { kind: 'click', icon: s.cursor }); return; } // Clicking a quiet icon is harmless.
        if (needs(request) !== verb) {
            s.streak = 0; addEffect(s, { kind: 'shake', icon: s.cursor });
            addBurst(s, request.kind === 'hang' ? 'hung · R to quit' : 'bouncing · L to open', s.cursor, 0, false);
            env.sound?.({ kind: 'brake' }); return;
        }
        const points = requestPoints(request, s.time);
        s.requests = s.requests.filter(r => r !== request);
        s.score += points; s.served++; s.streak++;
        addEffect(s, { kind: verb, icon: request.icon, urgent: request.urgent });
        addBurst(s, request.urgent ? `+${points} ×2` : `+${points}`, request.icon, 0);
        env.sound?.(verb === 'open' ? { kind: 'clear', count: 3, chain: Math.min(4, 1 + Math.floor(s.streak / 3)), perfect: request.urgent } : { kind: 'powerup' });
        if (s.served % DOCK.heartEvery === 0 && s.lives < 3) {
            s.lives++; addEffect(s, { kind: 'heart' }); env.sound?.({ kind: 'rescue' });
        }
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            const gesture = decodeGesture(event.action); if (!gesture) return;
            if (gesture.direction === 'up') { answer(verbFor(gesture.wrist)); return; }
            const to = s.cursor + (gesture.direction === 'left' ? -1 : 1);
            if (to < 0 || to >= DOCK.icons) { s.bumpAt = s.time; return; } // The Dock's end: harmless.
            s.from = s.cursor; s.cursor = to; s.movedAt = s.time;
            env.sound?.({ kind: 'turn', action: gesture.direction });
        },
        update(s) {
            pruneBursts(s); pruneEffects(s, 1.6); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) { s.stage = stage; addEffect(s, { kind: 'stage', stage }); }
            if (s.time >= s.nextSpawn) {
                if (s.requests.length < DOCK.limits[s.stage]) { spawn(); s.nextSpawn = s.time + spawnSeconds(env.pace); }
                else s.nextSpawn = s.time + .5;
            }
            for (const request of [...s.requests]) {
                if (s.time < request.due) continue;
                s.requests = s.requests.filter(r => r !== request); s.streak = 0;
                addEffect(s, { kind: 'fail', icon: request.icon });
                addBurst(s, 'not responding', request.icon, 0, false); loseLife(s, env);
                if (s.ended) return;
            }
        },
        render(s, p) {
            const compact = p.compact, reduced = env.reducedMotion, dark = isDark(p), c = p.c;
            // The desktop: an original blue Aqua-style wallpaper with soft swooshes (graphite in dark appearance).
            c.fillStyle = linear(p, 0, 0, 0, p.h, dark ? [[0, '#1a2b3c'], [1, '#0d1824']] : [[0, '#5c9ad6'], [.6, '#2f6fb4'], [1, '#1d4f8f']]);
            c.fillRect(0, 0, 720, p.h);
            c.save(); c.globalAlpha = dark ? .08 : .16; c.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                c.beginPath(); c.moveTo(0, p.h * (.35 + i * .12));
                c.bezierCurveTo(240, p.h * (.18 + i * .1), 480, p.h * (.62 + i * .06), 720, p.h * (.3 + i * .14));
                c.lineTo(720, p.h * (.36 + i * .14)); c.bezierCurveTo(480, p.h * (.7 + i * .06), 240, p.h * (.26 + i * .1), 0, p.h * (.41 + i * .12));
                c.fill();
            }
            c.restore();
            const news = s.effects.findLast(e => e.kind === 'stage');
            const toHeart = DOCK.heartEvery - s.served % DOCK.heartEvery;
            const top = toolbar(p, `${s.served} answered`, news ? STAGE_NEWS[news.stage] : s.streak >= 2 ? `streak ${s.streak} · ♥ in ${toHeart}` : `♥ back every ${DOCK.heartEvery}`);
            // Dock geometry with magnification: icons near the pointer swell and push their neighbours apart.
            const base = compact ? 76 : 60, pad = compact ? 8 : 14, glide = Math.min(1, (s.time - s.movedAt) / DOCK.glide);
            const pointer = reduced ? s.cursor : s.from + (s.cursor - s.from) * glide * glide * (3 - 2 * glide);
            const scales = APPS.map((_, i) => 1 + .55 * Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(i - pointer) * Math.PI / 3.2))));
            const widths = scales.map(k => base * k + pad), total = widths.reduce((a, b) => a + b, 0);
            const dockY = compact ? p.h - 210 : p.h - 70, slabH = compact ? 64 : 48, slabW = APPS.length * (base + pad) + 40;
            c.save(); c.shadowColor = '#00000055'; c.shadowBlur = 18; c.shadowOffsetY = 6;
            p.rect(360 - slabW / 2, dockY - slabH * .55, slabW, slabH, dark ? '#c8d6e266' : '#ffffffb0', 14);
            c.shadowColor = 'transparent'; c.globalAlpha = .35; c.fillStyle = dark ? '#ffffff22' : '#c9d6e2';
            for (let y = dockY - slabH * .55 + 2; y < dockY + slabH * .45; y += 4) c.fillRect(360 - slabW / 2 + 8, y, slabW - 16, 1);
            c.restore();
            let x = 360 - total / 2; const centers = [];
            for (let i = 0; i < APPS.length; i++) { centers.push(x + widths[i] / 2); x += widths[i]; }
            const iconBottom = dockY + slabH * .2;
            const fx = (kind, i, life) => s.effects.findLast(e => e.kind === kind && e.icon === i && s.time - e.at < life);
            for (let i = 0; i < APPS.length; i++) {
                const request = s.requests.find(r => r.icon === i), size = base * scales[i];
                let lift = 0;
                if (request?.kind === 'bounce') lift = reduced ? size * .22 : Math.abs(Math.sin((s.time - request.born) * Math.PI / .55)) * size * .45;
                const shake = fx('shake', i, .4), dx = shake && !reduced ? Math.sin((s.time - shake.at) * 60) * 6 : 0;
                const ix = centers[i] - size / 2 + dx, iy = iconBottom - size - lift;
                icon(p, APPS[i], ix, iy, size, request?.kind === 'hang' ? .55 : 1);
                if (shake && reduced) p.outline(ix - 3, iy - 3, size + 6, size + 6, '#e0503c', 3);
                if (request?.kind === 'hang') beachball(p, ix + size * .72, iy + size * .72, size * .26, reduced ? .3 : (s.time - request.born) * 7);
                if (request?.urgent) {
                    p.circle(ix + size * .9, iy + size * .1, size * .17, '#d93a2b');
                    text(p, '!', ix + size * .9, iy + size * .1, size * .26, '#ffffff', 'center', 700);
                }
                if (request) {
                    const left = (request.due - s.time) / (request.due - request.born);
                    progress(p, centers[i] - size * .45, iconBottom + (compact ? 10 : 6), size * .9, compact ? 16 : 10, left, s.time, reduced, left < .35 ? 'red' : request.kind === 'hang' ? 'graphite' : 'blue');
                }
                const fail = fx('fail', i, .9);
                if (fail) { c.save(); c.globalAlpha = 1 - (s.time - fail.at) / .9; beachball(p, centers[i], iy - size * .1, size * .3, reduced ? 0 : (s.time - fail.at) * 9); c.restore(); }
                const quit = fx('quit', i, .5); if (quit) poof(p, centers[i], iy + size / 2, size * 1.1, s.time - quit.at);
            }
            // The pointer: a running-app triangle under the icon and the Dock's name tag above it.
            const cx = centers[s.cursor], cs = base * scales[s.cursor];
            c.save(); c.fillStyle = dark ? '#e6f5ff' : '#10263c'; c.beginPath();
            const ty = iconBottom + (compact ? 30 : 22);
            c.moveTo(cx - 9, ty + 9); c.lineTo(cx + 9, ty + 9); c.lineTo(cx, ty); c.closePath(); c.fill(); c.restore();
            const name = APPS[s.cursor].name, tagW = name.length * (compact ? 18 : 11) + 30, tagH = compact ? 44 : 28;
            const tagY = iconBottom - cs - (compact ? 74 : 52);
            p.rect(cx - tagW / 2, tagY, tagW, tagH, '#0b1a28cc', tagH / 2);
            text(p, name, cx, tagY + tagH / 2, compact ? 28 : 17, '#ffffff', 'center', 700);
            if (s.time - s.bumpAt < .3 && !reduced) p.rect(s.cursor ? 360 + slabW / 2 - 6 : 360 - slabW / 2, dockY - slabH * .55, 6, slabH, '#4aa8ff', 3);
            // Answered apps: a window genies out of its icon (open) and back down again, or a poof (quit).
            for (const e of s.effects) {
                if (e.kind !== 'open') continue;
                const age = s.time - e.at; if (age > 1.5) continue;
                const t = reduced ? (age < 1.2 ? 1 : 0) : age < .45 ? age / .45 : age < 1 ? 1 : Math.max(0, 1 - (age - 1) / .5);
                const ww = compact ? 420 : 260, wh = compact ? Math.max(90, Math.min(240, dockY - 150 - top - 30)) : 150, wx = Math.max(20, Math.min(700 - ww, centers[e.icon] - ww / 2));
                const wy = top + 30;
                genie(p, centers[e.icon], iconBottom - base, { x: wx, y: wy, w: ww, h: wh }, t, { title: APPS[e.icon].name });
            }
            const heart = s.effects.findLast(e => e.kind === 'heart');
            if (heart && s.time - heart.at < 1.2) text(p, '♥ +1', 360, top + (compact ? 60 : 30), compact ? 34 : 22, '#ffffff', 'center', 700);
            bursts({ ...s, bursts: s.bursts.map(b => ({ ...b, x: centers[b.x] ?? 360, y: iconBottom - base * 1.7 - (compact ? 90 : 60) })) }, p, reduced);
        }
    });
}

/** Original glossy app icons: a gel tile with a white glyph whose shape names the app without colour. */
function icon(p, app, x, y, size, alpha = 1) {
    const c = p.c; c.save(); c.globalAlpha *= alpha;
    gel(p, x, y, size, size, app.tone, { radius: size * .22 });
    c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = Math.max(2, size * .06); c.lineJoin = 'round'; c.lineCap = 'round';
    const m = x + size / 2, n = y + size / 2, k = size * .26;
    c.beginPath();
    switch (app.glyph) {
    case 'mail': c.rect(m - k, n - k * .65, k * 2, k * 1.4); c.moveTo(m - k, n - k * .65); c.lineTo(m, n + k * .15); c.lineTo(m + k, n - k * .65); break;
    case 'globe': c.arc(m, n, k, 0, Math.PI * 2); c.moveTo(m - k, n); c.lineTo(m + k, n); c.ellipse(m, n, k * .45, k, 0, 0, Math.PI * 2); break;
    case 'note': c.moveTo(m - k * .4, n + k * .6); c.lineTo(m - k * .4, n - k * .8); c.lineTo(m + k * .7, n - k); c.lineTo(m + k * .7, n + k * .4);
        c.stroke(); c.beginPath(); c.arc(m - k * .65, n + k * .65, k * .3, 0, Math.PI * 2); c.arc(m + k * .45, n + k * .45, k * .3, 0, Math.PI * 2); c.fill(); c.beginPath(); break;
    case 'photo': c.rect(m - k, n - k * .75, k * 2, k * 1.5); c.moveTo(m - k, n + k * .6); c.lineTo(m - k * .3, n - k * .1); c.lineTo(m + k * .2, n + k * .35); c.lineTo(m + k * .55, n); c.lineTo(m + k, n + k * .5); break;
    case 'chat': c.ellipse(m, n - k * .15, k, k * .7, 0, 0, Math.PI * 2); c.moveTo(m - k * .4, n + k * .45); c.lineTo(m - k * .7, n + k * .95); c.lineTo(m, n + k * .52); break;
    case 'calendar': c.rect(m - k * .85, n - k * .8, k * 1.7, k * 1.7); c.moveTo(m - k * .85, n - k * .35); c.lineTo(m + k * .85, n - k * .35); break;
    case 'terminal': c.moveTo(m - k * .8, n - k * .5); c.lineTo(m - k * .2, n); c.lineTo(m - k * .8, n + k * .5); c.moveTo(m, n + k * .55); c.lineTo(m + k * .8, n + k * .55); break;
    }
    c.stroke();
    if (app.glyph === 'calendar') text(p, '17', m, n + k * .3, k * .9, '#ffffff', 'center', 700);
    c.restore();
}
