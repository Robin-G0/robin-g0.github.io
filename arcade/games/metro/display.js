// Metro materials: flat colour tiles, white glyphs and light Segoe-style type.
// Drawn at logical width 720 with a responsive height; decoration never consumes gameplay RNG.
export const METRO = { blue:'#087aa5', purple:'#7434a6', green:'#347c62', orange:'#d86924',
    magenta:'#b33c7b', slate:'#145e93', white:'#ffffff' };
const FAMILY = "'Segoe UI Light', 'Open Sans', 'Segoe UI', Arial, sans-serif";

/** Light-weight canvas text; Open Sans 300 stands in where Segoe UI Light is absent. */
export function light(p, text, x, y, size, color = 'ink', align = 'left', weight = 300) {
    const c = p.c; c.save();
    c.font = `${weight} ${size}px ${FAMILY}`; c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = p.color(color); c.fillText(String(text), x, y); c.restore();
}

/** Start-screen header: a lowercase light title, a right-aligned detail and three square lives. */
export function header(p, title, detail, lives, slots = 3) {
    const compact = p.compact, y = compact ? 44 : 34;
    light(p, title, 28, y, compact ? 46 : 34, 'ink');
    light(p, detail, 692, y, compact ? 30 : 23, 'muted', 'right');
    const size = compact ? 16 : 11, gap = compact ? 10 : 7, top = compact ? 76 : 58;
    for (let i = 0; i < slots; i++) {
        const x = 692 - size - i * (size + gap);
        if (i < lives) p.rect(x, top, size, size, 'ink');
        else p.outline(x + 1, top + 1, size - 2, size - 2, 'border', 2);
    }
}

/** A live tile: solid colour, white glyph, inverted while lit and outlined while selected. */
export function tile(p, x, y, w, h, color, glyph = '', { lit = false, selected = false, size = h * .45, label = '' } = {}) {
    p.rect(x, y, w, h, lit ? METRO.white : color);
    const edge = Math.max(3, Math.min(8, Math.round(w * .06)));
    if (lit) p.outline(x + edge / 2, y + edge / 2, w - edge, h - edge, color, edge); // Inverted tiles stay visible on a white page.
    if (glyph !== '') light(p, glyph, x + w / 2, y + h / 2 - (label ? h * .06 : 0), size, lit ? color : METRO.white, 'center');
    if (label) light(p, label, x + 14, y + h - 18, Math.max(14, h * .12), lit ? color : METRO.white, 'left', 400);
    if (selected) p.outline(x + 3, y + 3, w - 6, h - 6, lit ? color : METRO.white, 4);
}

export function meter(p, x, y, width, fraction, color = 'accent', height = 8) {
    p.rect(x, y, width, height, 'border');
    p.rect(x, y, Math.max(0, Math.min(1, fraction)) * width, height, color);
}

export function addBurst(s, text, x, y, good = true) {
    s.bursts.push({ text, x, y, good, at: s.time }); s.bursts = s.bursts.slice(-6);
}
export function bursts(s, p, reduced = false) {
    for (const burst of s.bursts) {
        const age = s.time - burst.at; if (age > 1.1) continue;
        light(p, burst.text, burst.x, burst.y - (reduced ? 0 : age * 22), p.compact ? 36 : 30, burst.good ? 'ink' : METRO.orange, 'center', burst.good ? 300 : 400);
    }
}
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.1); }

/** Decorative effects run on simulation time and never touch rules or RNG. */
export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-16); }
export function pruneEffects(s) { s.effects = s.effects.filter(effect => s.time - effect.at < 1); }
/** A flat pop and a square ripple around a tile. Returns the scale to draw the tile with; reduced motion keeps a steady outline. */
export function ripple(p, x, y, w, h, age, color, reduced = false) {
    if (age < 0 || age > .6) return 1;
    if (reduced) { if (age < .35) p.outline(x + 2, y + 2, w - 4, h - 4, color, 4); return 1; }
    const grow = Math.min(1, age / .5), spread = Math.min(26, Math.max(6, w * .3)) * grow, c = p.c;
    c.save(); c.globalAlpha = (1 - grow) * .9;
    p.outline(x - spread, y - spread, w + spread * 2, h + spread * 2, color, 3); c.restore();
    return age < .25 ? 1 + .16 * Math.sin(age / .25 * Math.PI) : 1;
}
/** Draws a tile scaled about its centre, for pops. */
export function scaledTile(p, x, y, w, h, scale, color, glyph, options) {
    tile(p, x - (w * scale - w) / 2, y - (h * scale - h) / 2, w * scale, h * scale, color, glyph, options);
}

export function loseLife(s, env) {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
