// Material materials: paper sheets at defined elevations, ink ripples, chips, a linear progress
// indicator and a snackbar. Drawn at logical width 720 with a responsive height. The palette is the
// site's Material theme (assets/profile.json) read through the painter; piece swatches follow the
// Material 500 (light) and 200 (dark) tones. Decoration never consumes gameplay RNG.
export const FONT = "'Roboto', 'Open Sans', Arial, sans-serif";
const SWATCHES = {
    purple: ['#673ab7', '#b39ddb'], pink: ['#d81b60', '#f48fb1'], teal: ['#00897b', '#80cbc4'],
    amber: ['#ffa000', '#ffe082'], indigo: ['#3f51b5', '#9fa8da'], blue: ['#0288d1', '#81d4fa'],
    orange: ['#f4511e', '#ffab91'], green: ['#43a047', '#a5d6a7'], red: ['#d32f2f', '#ef9a9a']
};
export const SWATCH_NAMES = Object.freeze(Object.keys(SWATCHES));

function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255;
}
/** Dark appearance follows the theme's own background, so canvas and room always agree. */
export const isDark = p => luminance(p.colors.bg) < .5;
export const swatch = (p, name) => (SWATCHES[name] || SWATCHES.purple)[isDark(p) ? 1 : 0];
/** Text on a swatch: white on Material 500 tones, near-black on the pale dark-theme 200 tones. */
export const onSwatch = p => (isDark(p) ? '#1d1a26' : '#ffffff');
export function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = shift => Math.round((pa >> shift & 255) * (1 - t) + (pb >> shift & 255) * t);
    return '#' + [16, 8, 0].map(shift => ch(shift).toString(16).padStart(2, '0')).join('');
}
const hex = (p, value) => { const v = p.color(value); return /^#[0-9a-f]{6}$/i.test(v) ? v : '#888888'; };
/** A tint of one colour toward another, for pale fills that stay opaque (no stacked alpha). */
export const tint = (p, color, toward, t) => mix(hex(p, color), hex(p, toward), t);
/** Surface colour at an elevation: white paper in light mode, the 2019 dark-theme white overlay in dark mode. */
export function surface(p, dp = 1) {
    if (!isDark(p)) return '#ffffff';
    const overlay = dp >= 24 ? .16 : dp >= 16 ? .15 : dp >= 12 ? .14 : dp >= 8 ? .12 : dp >= 4 ? .09 : dp >= 2 ? .07 : .05;
    return mix(hex(p, 'bg'), '#ffffff', overlay);
}

// Material motion curves.
function bezier(x1, y1, x2, y2) {
    return t => {
        if (t <= 0) return 0; if (t >= 1) return 1;
        let lo = 0, hi = 1, u = t;
        for (let i = 0; i < 18; i++) {
            const x = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3;
            if (x < t) lo = u; else hi = u; u = (lo + hi) / 2;
        }
        return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
    };
}
export const ease = { standard: bezier(.4, 0, .2, 1), decelerate: bezier(0, 0, .2, 1), accelerate: bezier(.4, 0, 1, 1) };
export const clamp01 = t => Math.max(0, Math.min(1, t));

/** Roboto canvas text. `caps` sets the Material button/overline style: uppercase, medium, tracked. */
export function type(p, text, x, y, size, color = 'ink', align = 'left', weight = 400, caps = false) {
    const c = p.c; c.save();
    c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    c.letterSpacing = caps ? `${(size * .06).toFixed(1)}px` : '0px';
    c.fillStyle = p.color(color); c.fillText(caps ? String(text).toUpperCase() : String(text), x, y); c.restore();
}
export function textWidth(p, text, size, weight = 400) {
    const c = p.c; c.save(); c.font = `${weight} ${size}px ${FONT}`;
    const width = c.measureText?.(String(text))?.width; c.restore();
    return Number.isFinite(width) ? width : String(text).length * size * .55;
}

/** Fill a path with Material's two shadows (a soft ambient one and a directional key light), then the surface. */
export function elevated(p, dp, path, fill) {
    const c = p.c, dark = isDark(p);
    c.save();
    if (dp > 0) {
        c.shadowColor = dark ? 'rgba(0,0,0,.45)' : 'rgba(33,26,64,.16)';
        c.shadowBlur = 2 + dp * 1.7; c.shadowOffsetX = 0; c.shadowOffsetY = dp * .35;
        c.fillStyle = fill; path(c); c.fill();
        c.shadowColor = dark ? 'rgba(0,0,0,.5)' : 'rgba(33,26,64,.22)';
        c.shadowBlur = 1 + dp * .8; c.shadowOffsetY = dp * .5;
    }
    c.fillStyle = fill; path(c); c.fill();
    c.restore();
}
export const roundPath = (x, y, w, h, r) => c => { c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), r); };
/** A sheet of paper: rounded corners, the surface tint of its elevation and its shadow. */
export function sheet(p, x, y, w, h, dp = 1, { radius = 4, fill = null } = {}) {
    elevated(p, dp, roundPath(x, y, w, h, radius), fill ? p.color(fill) : surface(p, dp));
}

/** The ink ripple: a disc that spreads from the touch point on the decelerate curve and fades, clipped to its surface. */
export function ink(p, x, y, age, radius, color, { clip = null, reduced = false, duration = .6, alpha = .3 } = {}) {
    if (age < 0 || age > duration) return;
    const c = p.c; c.save();
    if (clip) { clip(c); c.clip(); }
    if (reduced) { if (age < duration * .6) { c.globalAlpha = alpha * .7; p.circle(x, y, radius, color); } c.restore(); return; }
    const t = age / duration;
    c.globalAlpha = alpha * (1 - ease.accelerate(t));
    p.circle(x, y, Math.max(1, radius * ease.decelerate(Math.min(1, t * 1.4))), color);
    c.restore();
}

/** Material chip: a pill. Filled chips take the colour; outlined chips stay on paper. */
export function chip(p, x, y, text, { color = 'accent', filled = false, size = 18, height = size * 1.8, minWidth = 0, textColor = null } = {}) {
    const width = Math.max(minWidth, textWidth(p, text, size, 500) + height * .9);
    const left = x - width / 2, top = y - height / 2, c = p.c;
    if (filled) p.rect(left, top, width, height, color, height / 2);
    else { c.save(); c.beginPath(); c.roundRect(left, top, width, height, height / 2); c.fillStyle = surface(p, 2); c.fill();
        c.strokeStyle = p.color(color); c.lineWidth = Math.max(1.5, size / 10); c.stroke(); c.restore(); }
    type(p, text, x, y + 1, size, textColor || (filled ? onSwatch(p) : color), 'center', 500);
    return width;
}

/** Linear progress indicator: a pale track and a solid bar. */
export function progress(p, x, y, width, fraction, color = 'accent', height = 4) {
    const c = p.c; c.save(); c.globalAlpha = .22; p.rect(x, y, width, height, color, height / 2); c.restore();
    p.rect(x, y, Math.max(0, Math.min(1, fraction)) * width, height, color, height / 2);
}

/** Floating action button: a circular sheet at 6 dp with a centred glyph. */
export function fab(p, x, y, r, color, glyph = '', { dp = 6, size = r * .9, glyphColor = null } = {}) {
    elevated(p, dp, c => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }, p.color(color));
    if (glyph) type(p, glyph, x, y + 1, size, glyphColor || onSwatch(p), 'center', 500);
}

/** Snackbar: a dark strip that rises from the bottom edge (decelerate), waits, then leaves (accelerate). */
export const SNACK = 2.4;
export function snackbar(p, text, age, reduced = false) {
    if (age < 0 || age > SNACK) return;
    const compact = p.compact, size = compact ? 28 : 17, height = compact ? 76 : 46;
    const width = Math.min(680, textWidth(p, text, size, 400) + (compact ? 64 : 48));
    const enter = reduced ? 1 : ease.decelerate(clamp01(age / .25)), leave = reduced ? 0 : ease.accelerate(clamp01((age - SNACK + .25) / .25));
    if (reduced && age > SNACK - .25) return;
    const y = p.h - (compact ? 24 : 12) - height + (1 - enter + leave) * (height + 24);
    const c = p.c; c.save();
    c.beginPath(); c.rect(0, 0, 720, p.h); c.clip();
    elevated(p, 6, roundPath(360 - width / 2, y, width, height, 4), isDark(p) ? '#ece6f5' : '#323232');
    type(p, text, 360, y + height / 2 + 1, size, isDark(p) ? '#211e2b' : '#ffffff', 'center', 400);
    c.restore();
}
export function addSnack(s, text) { s.snacks.push({ text, at: s.time }); s.snacks = s.snacks.slice(-2); }
/** One snackbar at a time, as Material asks; a newer message replaces the older one. */
export function drawSnacks(s, p, reduced) { const latest = s.snacks.at(-1); if (latest) snackbar(p, latest.text, s.time - latest.at, reduced); }

/** The canvas floor: the pale app background of Material (light) so white sheets read as raised paper; dark keeps the theme ground. */
export function backdrop(p) {
    const c = p.c; c.save(); c.fillStyle = isDark(p) ? p.color('bg') : tint(p, 'bg', 'soft', .45); c.fillRect(0, 0, 720, p.h); c.restore();
}
/** Canvas header: live status left, a secondary figure right. The room names the game and the HUD counts lives. */
export function header(p, status, detail = '') {
    const compact = p.compact, y = compact ? 46 : 30;
    type(p, status, 28, y, compact ? 34 : 20, 'ink', 'left', 500);
    if (detail) type(p, detail, 692, y, compact ? 28 : 16, 'muted', 'right', 400);
}

/** Short score bursts: Roboto Medium caps, rising on the decelerate curve, held still for reduced motion. */
export function addBurst(s, text, x, y, good = true) { s.bursts.push({ text, x, y, good, at: s.time }); s.bursts = s.bursts.slice(-6); }
export function drawBursts(s, p, reduced = false, place = b => b) {
    for (const raw of s.bursts) {
        const b = place(raw);
        const age = s.time - b.at; if (age < 0 || age > 1.1) continue;
        const c = p.c; c.save(); c.globalAlpha = age > .8 ? (1.1 - age) / .3 : 1;
        const size = p.compact ? 32 : 22, x = Math.max(textWidth(p, b.text, size, 500) / 2 + 12, Math.min(708 - textWidth(p, b.text, size, 500) / 2, b.x));
        type(p, b.text, x, b.y - (reduced ? 0 : 24 * ease.decelerate(clamp01(age / .8))), size,
            b.good ? 'accent' : swatch(p, 'red'), 'center', 500, true);
        c.restore();
    }
}
export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-16); }
export function prune(s) {
    s.bursts = s.bursts.filter(b => s.time - b.at < 1.1);
    s.effects = s.effects.filter(e => s.time - e.at < (e.life ?? 1));
    s.snacks = s.snacks.filter(n => s.time - n.at < SNACK);
}
export function loseLife(s, env) {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
