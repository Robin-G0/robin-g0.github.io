// Y2K Chrome materials: brushed chrome bevels, translucent candy plastic, starbursts, lens flares and
// Orbitron techno type. Colours come from the theme palette (assets/profile.json, light and dark) through
// painter tokens; the chrome stops are fixed, like the site's header strip. Drawn at logical width 720 with
// a responsive height. Decoration runs on simulation time and never consumes gameplay RNG.
export const TECHNO = "'Orbitron', 'Arial Black', Arial, sans-serif";
export const CHROME = ['#ffffff', '#c9d3ea', '#8394b6', '#ffffff', '#657596', '#dce3f1'];
const STOPS = [0, .3, .48, .5, .53, 1];

/** Orbitron canvas text; heavy uppercase is the site's Y2K heading voice. */
export function techno(p, text, x, y, size, color = 'ink', align = 'left', weight = 700) {
    const c = p.c; c.save();
    c.font = `${weight} ${size}px ${TECHNO}`; c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = p.color(color); c.fillText(String(text), x, y); c.restore();
}

/** A chrome gradient across a box, the same banding as the site header strip. Falls back to flat grey. */
export function chrome(p, x0, y0, x1, y1, stops = CHROME) {
    const g = p.c.createLinearGradient?.(x0, y0, x1, y1);
    if (!g?.addColorStop) return '#c9d3ea';
    stops.forEach((color, i) => g.addColorStop(STOPS[i] ?? i / (stops.length - 1), color));
    return g;
}

/** Translucent candy plastic: a tinted body, a white core and a specular highlight. */
export function candy(p, x, y, r, color, alpha = .9) {
    const c = p.c; c.save(); c.globalAlpha = alpha;
    const g = c.createRadialGradient?.(x - r * .35, y - r * .4, r * .05, x, y, r);
    if (g?.addColorStop) { g.addColorStop(0, '#ffffff'); g.addColorStop(.3, p.color(color)); g.addColorStop(1, p.color(color)); }
    p.circle(x, y, r, g?.addColorStop ? g : color);
    c.globalAlpha = .7; c.beginPath(); c.ellipse?.(x - r * .25, y - r * .5, r * .42, r * .18, -.3, 0, Math.PI * 2);
    c.fillStyle = '#ffffff'; c.fill(); c.restore();
}

/** A rounded capsule with a chrome rim; the Y2K pill button. */
export function pill(p, x, y, w, h, fill, rim = true) {
    const r = Math.min(h, w) / 2;
    if (rim) p.rect(x - 3, y - 3, w + 6, h + 6, chrome(p, x, y - 3, x, y + h + 3), r + 3);
    p.rect(x, y, w, h, fill, r);
    const c = p.c; c.save(); c.globalAlpha = .5;
    p.rect(x + r * .5, y + h * .1, Math.max(0, w - r), h * .28, '#ffffff', h * .14); c.restore();
}

/** A slanted chrome plate like the site's parallelogram buttons. */
export function plate(p, x, y, w, h, slant = 10) {
    const c = p.c; c.save(); c.beginPath();
    c.moveTo(x + slant, y); c.lineTo(x + w, y); c.lineTo(x + w - slant, y + h); c.lineTo(x, y + h); c.closePath();
    c.fillStyle = chrome(p, x, y, x, y + h); c.fill(); c.strokeStyle = '#8394b6'; c.lineWidth = 1; c.stroke(); c.restore();
}

/** An n-point starburst, the era's sticker and sparkle shape. */
export function starburst(p, x, y, r, color, points = 8, rotation = 0, inner = .45) {
    const c = p.c; c.save(); c.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const a = rotation + i * Math.PI / points, rr = i % 2 ? r * inner : r;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = p.color(color); c.fill(); c.restore();
}

/** A lens flare: bright core, halo, cross streaks and two ghost discs along the optical axis. */
export function flare(p, x, y, r, alpha = 1, color = 'accent') {
    const c = p.c; c.save();
    c.globalAlpha = .3 * alpha; p.circle(x, y, r, color);
    c.globalAlpha = .95 * alpha; p.circle(x, y, r * .3, '#ffffff');
    c.globalAlpha = .55 * alpha; p.line([[x - r * 1.7, y], [x + r * 1.7, y]], '#ffffff', 2); p.line([[x, y - r * 1.2], [x, y + r * 1.2]], '#ffffff', 1.5);
    c.globalAlpha = .2 * alpha; p.circle(x - r * 1.9, y + r * 1.1, r * .4, color); p.circle(x - r * 2.7, y + r * 1.7, r * .22, color);
    c.restore();
}

/** Canvas backdrop: a radial palette wash that fades to the page colour at the edges, and faint orbit lines. */
export function backdrop(p, orbits = true) {
    const c = p.c, h = p.h;
    const g = c.createRadialGradient?.(360, h * .42, 20, 360, h * .42, Math.max(360, h * .6));
    if (g?.addColorStop) { g.addColorStop(0, p.color('soft')); g.addColorStop(1, p.color('bg')); p.rect(0, 0, 720, h, g); }
    if (!orbits) return;
    c.save(); c.globalAlpha = .35; c.strokeStyle = p.color('border'); c.lineWidth = 1;
    for (let i = 0; i < 2; i++) { c.beginPath(); c.ellipse?.(360, h * .42, 250 + i * 90, 70 + i * 34, -.16, 0, Math.PI * 2); c.stroke(); }
    c.restore();
}

/** Live status only: the room header names the game and the HUD counts lives. */
export function header(p, status, detail = '') {
    const compact = p.compact, y = compact ? 48 : 34;
    techno(p, status, 26, y, compact ? 32 : 22, 'ink', 'left', 800);
    if (detail) techno(p, detail, 694, y, compact ? 32 : 22, 'accent', 'right', 900);
}

/** A segmented meter, like a Winamp volume slider. */
export function meter(p, x, y, width, fraction, segments, color = 'accent', height = 10) {
    const gap = 3, seg = (width - gap * (segments - 1)) / segments, lit = Math.round(Math.max(0, Math.min(1, fraction)) * segments);
    for (let i = 0; i < segments; i++) p.rect(x + i * (seg + gap), y, seg, height, i < lit ? color : 'border', 2);
}

export function addBurst(s, text, x, y, good = true, extra = {}) {
    s.bursts.push({ text, x, y, good, at: s.time, ...extra }); s.bursts = s.bursts.slice(-6);
}
export function bursts(s, p, reduced = false, project = burst => burst) {
    for (const item of s.bursts) {
        const age = s.time - item.at; if (age > 1.1 || age < 0) continue;
        const burst = project(item);
        const c = p.c; c.save(); c.globalAlpha = Math.min(1, (1.1 - age) * 3);
        techno(p, burst.text, Math.max(90, Math.min(630, burst.x)), burst.y - (reduced ? 0 : age * 24), p.compact ? 30 : 21, burst.good ? 'accent' : 'gold', 'center', 900);
        c.restore();
    }
}
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.1); }
export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-16); }
export function pruneEffects(s) { s.effects = s.effects.filter(effect => s.time - effect.at < 1); }

/** A chrome shatter: shards fly out on a fixed pattern (no RNG). Reduced motion keeps a steady starburst. */
export function shatter(p, x, y, age, color, reduced = false, size = 1) {
    if (age < 0 || age > .7) return;
    const c = p.c; c.save(); c.globalAlpha = Math.max(0, 1 - age / .7);
    if (reduced) { starburst(p, x, y, 24 * size, color, 8, 0); c.restore(); return; }
    starburst(p, x, y, (14 + age * 40) * size, color, 8, age * 2, .32);
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + .3, d = (12 + age * 110) * size;
        p.rect(x + Math.cos(a) * d - 3, y + Math.sin(a) * d - 3, 6, 6, '#ffffff', 1);
    }
    c.restore();
}

export function loseLife(s, env) {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
export function gainLife(s, env) {
    if (s.lives >= 3) return false;
    s.lives++; env.sound?.({ kind: 'rescue' }); return true;
}
