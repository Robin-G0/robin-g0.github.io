// Aqua materials (Mac OS X, 2001-2007): pinstriped backdrops, brushed-metal bars, lickable gel
// capsules with a specular cap and a caustic glow, traffic-light buttons, candy-striped progress
// bars and translucent drop shadows. Drawn at logical width 720 with a responsive height.
// Decoration is derived from simulation time and fixed hashes: it never consumes gameplay RNG.

export const FAMILY = "'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Verdana, 'Open Sans', sans-serif";

/** Gel tones: [rim, top, middle, bottom glow]. Blue is the Aqua default button; graphite the 2003 appearance. */
export const GEL = {
    blue: ['#1d5ea8', '#a9d8ff', '#2f87dc', '#7fd0ff'],
    graphite: ['#59636e', '#e6ebf0', '#8d98a4', '#d0d8e0'],
    clear: ['#8ea4b8', '#ffffff', '#e4edf5', '#ffffff'],
    red: ['#a2342a', '#ffc2b4', '#e0503c', '#ff9c86'],
    yellow: ['#a07d1c', '#fff4b8', '#e8b52e', '#ffe48a'],
    green: ['#3d7f2e', '#d4f8bf', '#5cae46', '#b3ec92'],
    purple: ['#5b3a8c', '#e4d2ff', '#8d62c8', '#c9a9f5'],
    orange: ['#a4521a', '#ffd9b0', '#e8822e', '#ffc07e']
};

export function isDark(p) {
    const hex = String(p.colors?.bg || '#fff').replace('#', '');
    if (hex.length < 6) return false;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return (r * .299 + g * .587 + b * .114) < 110;
}

/** A gradient where the context supports one, otherwise its first colour (unit-test painters). */
export function linear(p, x0, y0, x1, y1, stops) {
    const g = p.c.createLinearGradient?.(x0, y0, x1, y1);
    if (!g?.addColorStop) return stops[0][1];
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
}
function radial(p, x0, y0, r0, x1, y1, r1, stops) {
    const g = p.c.createRadialGradient?.(x0, y0, r0, x1, y1, r1);
    if (!g?.addColorStop) return stops.at(-1)[1];
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
}

export function text(p, value, x, y, size, color = 'ink', align = 'left', weight = 400) {
    const c = p.c; c.save();
    c.font = `${weight} ${Math.round(size)}px ${FAMILY}`; c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = p.color(color); c.fillText(String(value), x, y); c.restore();
}
/** Embossed Aqua label: a one-pixel white (or dark) shadow under the glyphs. */
export function etched(p, value, x, y, size, color = 'ink', align = 'left', weight = 400) {
    text(p, value, x, y + 1, size, isDark(p) ? '#00000088' : '#ffffffcc', align, weight);
    text(p, value, x, y, size, color, align, weight);
}

function capsulePath(c, x, y, w, h, r = Math.min(h, w) / 2) {
    c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** Pinstripe backdrop: the Aqua window body, two-pixel stripes. Dark appearance keeps it as graphite. */
export function pinstripes(p, top = 0, bottom = p.h) {
    const c = p.c, dark = isDark(p);
    c.fillStyle = dark ? '#1b2834' : '#eef2f6'; c.fillRect(0, top, 720, bottom - top);
    c.fillStyle = dark ? '#21303d' : '#f7f9fb';
    for (let y = top; y < bottom; y += 4) c.fillRect(0, y, 720, 2);
}

/** Brushed metal: vertical sheen plus fixed hairline streaks. */
export function brushed(p, x, y, w, h, radius = 0) {
    const c = p.c, dark = isDark(p);
    c.save(); capsulePath(c, x, y, w, h, radius); c.clip();
    c.fillStyle = linear(p, 0, y, 0, y + h, dark
        ? [[0, '#5d6a76'], [.45, '#3f4b56'], [1, '#2c353e']]
        : [[0, '#f4f5f6'], [.45, '#d4d8dc'], [1, '#b7bec5']]);
    c.fillRect(x, y, w, h);
    c.globalAlpha = dark ? .12 : .22; c.fillStyle = dark ? '#ffffff' : '#7d8790';
    for (let i = 0; i < Math.min(60, h / 2); i++) {
        const sy = y + ((i * 37) % Math.max(1, h)), sx = x + ((i * 151) % Math.max(1, w)) * .6;
        c.fillRect(sx, sy, w * (.25 + ((i * 13) % 7) / 10), 1);
    }
    c.restore();
    p.c.save(); p.c.strokeStyle = dark ? '#1a2027' : '#8b949c'; p.c.lineWidth = 1;
    capsulePath(p.c, x + .5, y + .5, w - 1, h - 1, radius); p.c.stroke(); p.c.restore();
}

/** Lickable gel: rim, deep body, a bright caustic glow at the bottom and a glossy specular cap on top. */
export function gel(p, x, y, w, h, tone = 'blue', { radius, alpha = 1, glow = 0 } = {}) {
    const [rim, top, middle, bottom] = GEL[tone] || GEL.blue, c = p.c, r = radius ?? Math.min(w, h) / 2;
    if (w <= 0 || h <= 0) return;
    c.save(); c.globalAlpha *= alpha;
    if (glow > 0) { c.shadowColor = '#4aa8ff'; c.shadowBlur = 18 * glow; }
    else { c.shadowColor = '#0a284633'; c.shadowBlur = Math.min(10, h * .25); c.shadowOffsetY = Math.min(4, h * .08); }
    capsulePath(c, x, y, w, h, r);
    c.fillStyle = linear(p, 0, y, 0, y + h, [[0, top], [.5, middle], [.52, middle], [1, bottom]]); c.fill();
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.lineWidth = Math.max(1, Math.min(2, h * .05)); c.strokeStyle = rim; c.stroke();
    // Specular cap: a white lozenge across the upper half, fading downward.
    const inset = Math.min(w, h) * .12;
    capsulePath(c, x + inset, y + h * .06, w - inset * 2, h * .42, Math.max(0, r - inset));
    c.fillStyle = linear(p, 0, y + h * .06, 0, y + h * .48, [[0, '#ffffffee'], [1, '#ffffff22']]); c.fill();
    c.restore();
}

/** A glass marble with a specular point and a coloured core. */
export function marble(p, x, y, r, tone = 'blue', alpha = 1) {
    const [rim, top, middle, bottom] = GEL[tone] || GEL.blue, c = p.c;
    c.save(); c.globalAlpha *= alpha;
    c.shadowColor = '#0a284655'; c.shadowBlur = r * .5; c.shadowOffsetY = r * .25;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = radial(p, x - r * .3, y - r * .35, r * .1, x, y, r, [[0, top], [.45, middle], [.85, rim], [1, bottom]]); c.fill();
    c.shadowColor = 'transparent';
    c.beginPath(); c.ellipse(x - r * .25, y - r * .45, r * .45, r * .28, -.4, 0, Math.PI * 2);
    c.fillStyle = '#ffffffcc'; c.fill();
    c.beginPath(); c.arc(x + r * .35, y + r * .4, r * .18, 0, Math.PI * 2); c.fillStyle = '#ffffff55'; c.fill();
    c.restore();
}

/** Traffic-light window button: red close ×, yellow minimise −, green zoom +. */
export function light(p, x, y, r, kind) {
    const tone = { close: 'red', minimise: 'yellow', zoom: 'green', plain: 'blue' }[kind] || 'blue';
    marble(p, x, y, r, tone);
    const c = p.c; c.save(); c.strokeStyle = GEL[tone][0]; c.lineWidth = Math.max(2, r * .22); c.lineCap = 'round';
    const k = r * .42; c.beginPath();
    if (kind === 'close') { c.moveTo(x - k, y - k); c.lineTo(x + k, y + k); c.moveTo(x + k, y - k); c.lineTo(x - k, y + k); }
    if (kind === 'minimise' || kind === 'zoom') { c.moveTo(x - k, y); c.lineTo(x + k, y); }
    if (kind === 'zoom') { c.moveTo(x, y - k); c.lineTo(x, y + k); }
    if (kind === 'plain') { c.moveTo(x, y - k); c.lineTo(x, y + k * .7); c.moveTo(x - k * .6, y + k * .1); c.lineTo(x, y + k * .7); c.lineTo(x + k * .6, y + k * .1); }
    c.stroke(); c.restore();
}

/** The brushed-metal toolbar with an iTunes-style status display. It never repeats the room title or lives. */
export function toolbar(p, status, detail = '') {
    const compact = p.compact, h = compact ? 84 : 52, dark = isDark(p);
    brushed(p, 0, 0, 720, h);
    const w = compact ? 560 : 380, x = 360 - w / 2, y = compact ? 12 : 8, lh = h - y * 2;
    const c = p.c; c.save();
    capsulePath(c, x, y, w, lh, lh * .35);
    c.fillStyle = linear(p, 0, y, 0, y + lh, dark ? [[0, '#2f3d29'], [1, '#43543a']] : [[0, '#e9f2d2'], [1, '#f9fbef']]); c.fill();
    c.strokeStyle = dark ? '#151b12' : '#8d9a7c'; c.lineWidth = 1; c.stroke(); c.restore();
    const ink = dark ? '#d8ecc0' : '#2b3622';
    if (detail) {
        text(p, status, 360, y + lh * .34, compact ? 30 : 17, ink, 'center', 700);
        text(p, detail, 360, y + lh * .74, compact ? 24 : 13, ink, 'center', 400);
    } else text(p, status, 360, y + lh / 2, compact ? 32 : 19, ink, 'center', 700);
    return h;
}

/** Candy-striped Aqua progress bar; the barber-pole stripes move on simulation time. */
export function progress(p, x, y, w, h, fraction, time = 0, reduced = false, tone = 'blue') {
    const c = p.c, f = Math.max(0, Math.min(1, fraction));
    c.save(); capsulePath(c, x, y, w, h, h / 2);
    c.fillStyle = linear(p, 0, y, 0, y + h, isDark(p) ? [[0, '#121a22'], [1, '#2a3846']] : [[0, '#c9d2db'], [1, '#f4f7fa']]); c.fill();
    c.strokeStyle = isDark(p) ? '#0b1117' : '#8094a8'; c.lineWidth = 1; c.stroke(); c.restore();
    if (f <= 0) return;
    gel(p, x, y, Math.max(h, w * f), h, tone, { radius: h / 2 });
    c.save(); capsulePath(c, x, y, Math.max(h, w * f), h, h / 2); c.clip();
    c.globalAlpha = .28; c.fillStyle = '#ffffff';
    const shift = reduced ? 0 : (time * h * 1.6) % (h * 2);
    for (let sx = x - h * 2 + shift; sx < x + w * f + h; sx += h * 2) {
        c.beginPath(); c.moveTo(sx, y + h); c.lineTo(sx + h, y); c.lineTo(sx + h * 1.8, y); c.lineTo(sx + h * .8, y + h); c.fill();
    }
    c.restore();
}

/** The wait cursor: a spinning rainbow disc (original vector drawing). */
export function beachball(p, x, y, r, angle = 0) {
    const colors = ['#e8463a', '#f39a2b', '#f5d63a', '#5cb84a', '#3b8ee0', '#8e5cd0'], c = p.c;
    c.save(); c.shadowColor = '#0a284655'; c.shadowBlur = r * .4;
    for (let i = 0; i < 6; i++) {
        c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, angle + i * Math.PI / 3, angle + (i + 1) * Math.PI / 3); c.closePath();
        c.fillStyle = colors[i]; c.fill(); c.shadowColor = 'transparent';
    }
    c.beginPath(); c.ellipse(x - r * .2, y - r * .45, r * .55, r * .3, 0, 0, Math.PI * 2); c.fillStyle = '#ffffff77'; c.fill();
    c.restore();
}

/** Genie: a window pours out of (t → 1) or back into (t → 0) a point, with curved sides. */
export function genie(p, fromX, fromY, rect, t, { title = '', tone = 'blue' } = {}) {
    if (t <= 0) return;
    const c = p.c, e = t * t * (3 - 2 * t), { x, y, w, h } = rect;
    const top = fromY + (y - fromY) * e, bottom = fromY + (y + h - fromY) * Math.min(1, e * 1.25);
    const lx = fromX + (x - fromX) * e, rx = fromX + (x + w - fromX) * e, nx = 6 + 6 * (1 - e);
    c.save(); c.globalAlpha *= Math.min(1, t * 2.5);
    c.shadowColor = '#0a284650'; c.shadowBlur = 20 * e; c.shadowOffsetY = 8 * e;
    c.beginPath(); c.moveTo(lx, top); c.lineTo(rx, top);
    c.bezierCurveTo(rx, top + (bottom - top) * .5, fromX + nx, bottom - (bottom - top) * .25, fromX + nx, bottom);
    c.lineTo(fromX - nx, bottom);
    c.bezierCurveTo(fromX - nx, bottom - (bottom - top) * .25, lx, top + (bottom - top) * .5, lx, top);
    c.closePath();
    c.fillStyle = isDark(p) ? '#26394a' : '#f7f9fb'; c.fill();
    c.shadowColor = 'transparent'; c.strokeStyle = isDark(p) ? '#0e1820' : '#8a9db0'; c.lineWidth = 1; c.stroke();
    if (e > .7) {
        const k = (e - .7) / .3, bar = Math.min(26, h * .16);
        c.globalAlpha *= k; brushed(p, x, y, w, bar, 6);
        for (const [i, kind] of ['close', 'minimise', 'zoom'].entries()) light(p, x + 14 + i * bar * .75, y + bar / 2, bar * .26, kind);
        if (title) text(p, title, x + w / 2, y + bar / 2, bar * .5, isDark(p) ? '#e6f5ff' : '#25455f', 'center', 700);
        gel(p, x + w * .58, y + h - bar * 1.25, w * .32, bar * .9, tone);
    }
    c.restore();
}

/** The Dock "poof": a small cloud that puffs out where an item vanished. */
export function poof(p, x, y, size, age) {
    if (age < 0 || age > .5) return;
    const c = p.c, k = age / .5; c.save(); c.globalAlpha = 1 - k;
    for (let i = 0; i < 5; i++) {
        const a = i * 1.257, d = size * (.2 + k * .5);
        c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, size * (.28 - k * .1), 0, Math.PI * 2);
        c.fillStyle = isDark(p) ? '#d6e2ec' : '#ffffff'; c.fill();
        c.strokeStyle = '#9fb3c6'; c.lineWidth = 1; c.stroke();
    }
    c.restore();
}

/** The pulsing default button: 0..1 on a 1.6 s throb, still for reduced motion. */
export const throb = (time, reduced = false) => reduced ? .6 : .5 + .5 * Math.sin(time * Math.PI * 2 / 1.6);

export function addBurst(s, text, x, y, good = true, at = s.time) {
    s.bursts.push({ text, x, y, good, at }); s.bursts = s.bursts.slice(-6);
}
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.2); }
/** Score callouts: Lucida bold over a soft halo, rising gently unless motion is reduced. */
export function bursts(s, p, reduced = false) {
    for (const b of s.bursts) {
        const age = s.time - b.at; if (age < 0 || age > 1.1) continue;
        const size = (p.compact ? 34 : 24) * (b.text.length > 14 ? .8 : 1), y = b.y - (reduced ? 0 : age * 24);
        const c = p.c; c.save(); c.globalAlpha = age > .8 ? (1.1 - age) / .3 : 1;
        c.shadowColor = isDark(p) ? '#000000' : '#ffffff'; c.shadowBlur = 6;
        text(p, b.text, Math.max(90, Math.min(630, b.x)), y, size, b.good ? 'accent' : (isDark(p) ? '#ff9c86' : '#b2302a'), 'center', 700);
        c.restore();
    }
}

export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-12); }
export function pruneEffects(s, life = 1.2) { s.effects = s.effects.filter(e => s.time - e.at < life); }

export function loseLife(s, env) {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
