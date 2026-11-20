// Matrix / Construct materials: phosphor code on near-black, monospace terminal text and a
// blinking block cursor. Every colour is a palette token (bg, ink, muted, border, accent, soft,
// gold) so the canvas follows the theme's light and dark values from assets/profile.json.
// Decoration is a pure function of simulation time and never consumes gameplay RNG.
export const FAMILY = "'Share Tech Mono', Consolas, 'Lucida Console', monospace";
// Glyphs present in Share Tech Mono; mirrored like the film's code rain without copying its typeface.
export const GLYPHS = '0123456789ZTXYKLMNEAH:=*+<>|¦';

/** Monospace canvas text in the bundled terminal face. */
export function mono(p, text, x, y, size, color = 'ink', align = 'left', mirrored = false) {
    const c = p.c; c.save();
    c.font = `${size}px ${FAMILY}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = p.color(color);
    if (mirrored) { c.translate(x, y); c.scale(-1, 1); c.fillText(String(text), 0, 0); }
    else c.fillText(String(text), x, y);
    c.restore();
}

/** A terminal block cursor; blinks on simulation time, steady under reduced motion. */
export function cursor(p, x, y, w, h, time, reduced = false, color = 'accent') {
    if (reduced || Math.floor(time * 2.2) % 2 === 0) p.rect(x, y, w, h, color);
}

/** Canvas status line. The room header already names the game and the HUD counts lives,
 * so this carries live status only: a prompt on the left, a figure on the right. */
export function header(p, status, detail = '', time = 0, reduced = false) {
    const compact = p.compact, y = compact ? 42 : 30, size = compact ? 34 : 24;
    mono(p, `> ${status}`, 24, y, size, 'ink');
    const c = p.c; c.save(); c.font = `${size}px ${FAMILY}`;
    const width = c.measureText?.(`> ${status}`)?.width || (status.length + 2) * size * .55; c.restore();
    cursor(p, 30 + width, y - size * .42, size * .5, size * .84, time, reduced);
    if (detail) mono(p, detail, 696, y, compact ? 28 : 21, 'muted', 'right');
}

/** Falling code: a few columns of glyph trails drawn between x0 and x1. Deterministic per column. */
export function rain(p, time, { x0 = 0, x1 = 720, top = 0, bottom = p.h, columns = 12, alpha = .22, size = 16, reduced = false, speed = 1 } = {}) {
    const c = p.c, height = bottom - top, pitch = (x1 - x0) / columns; c.save(); c.globalAlpha = alpha;
    for (let col = 0; col < columns; col++) {
        const rate = (38 + (col * 37) % 41) * speed, length = 6 + (col * 5) % 6, phase = (col * 131) % 997;
        const head = reduced ? (phase % height) : ((time * rate + phase) % (height + length * size)) ;
        const x = x0 + pitch * (col + .5);
        for (let i = 0; i < length; i++) {
            const y = top + head - i * size; if (y < top || y > bottom) continue;
            const glyph = GLYPHS[(col * 7 + i * 13 + Math.floor((reduced ? 0 : time) * 3 + i)) % GLYPHS.length];
            mono(p, glyph, x, y, size, i === 0 ? 'ink' : i < 3 ? 'accent' : 'border', 'center', col % 2 === 0);
        }
    }
    c.restore();
}

/** The Construct floor: a perspective grid receding to a horizon line. */
export function constructFloor(p, horizon, bottom = p.h) {
    const c = p.c; c.save(); c.globalAlpha = .55;
    p.line([[0, horizon], [720, horizon]], 'border', 1);
    for (let i = -6; i <= 6; i++) p.line([[360 + i * 18, horizon], [360 + i * 150, bottom]], 'border', 1);
    for (let k = 1; k <= 6; k++) { const y = horizon + (bottom - horizon) * (k / 6) ** 1.8; p.line([[0, y], [720, y]], 'border', 1); }
    c.restore();
}

export function addBurst(s, text, x, y, good = true, size = 0) {
    s.bursts.push({ text, x, y, good, size, at: s.time }); s.bursts = s.bursts.slice(-6);
}
/** Score text that types itself out character by character, then rises and fades. */
export function bursts(s, p, reduced = false) {
    for (const burst of s.bursts) {
        const age = s.time - burst.at; if (age > 1.2) continue;
        const shown = reduced ? burst.text : burst.text.slice(0, Math.max(1, Math.ceil(age / .025)));
        const c = p.c; c.save(); c.globalAlpha = age > .8 ? Math.max(0, (1.2 - age) / .4) : 1;
        mono(p, shown, burst.x, burst.y - (reduced ? 0 : age * 20), burst.size || (p.compact ? 36 : 28), burst.good ? 'ink' : 'gold', 'center');
        c.restore();
    }
}
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.2); }
export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-16); }
export function pruneEffects(s, life = 1) { s.effects = s.effects.filter(effect => s.time - effect.at < life); }

/** Bullet-time ripple: concentric rings spreading from a point; a single steady ring under reduced motion. */
export function ripple(p, x, y, age, radius, color = 'accent', reduced = false, life = .6) {
    if (age < 0 || age > life) return;
    const c = p.c; c.save();
    if (reduced) { p.circle(x, y, radius, color, false); c.restore(); return; }
    for (let k = 0; k < 3; k++) {
        const t = age / life - k * .18; if (t <= 0 || t >= 1) continue;
        c.globalAlpha = (1 - t) * .8; p.circle(x, y, radius * (.4 + t), color, false);
    }
    c.restore();
}

/** A meter of square cells, like a progress readout on a terminal. */
export function cells(p, x, y, count, filled, size = 12, gap = 4, color = 'accent') {
    for (let i = 0; i < count; i++) {
        if (i < filled) p.rect(x + i * (size + gap), y, size, size, color);
        else p.outline(x + i * (size + gap) + 1, y + 1, size - 2, size - 2, 'border', 2);
    }
}

export function loseLife(s, env) {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
