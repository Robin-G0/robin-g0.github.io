// Field Notes materials: the site's own palette tokens (bg paper, ink, muted pencil, border grid,
// accent fountain-pen ink, soft wash, gold brass), Caveat handwriting and a Georgia serif.
// Everything here is decoration: it runs on simulation time and never touches gameplay RNG.
export const MARGIN = '#b46253'; // The red margin rule of the room's notebook page (arcade/themes.css).

const hand = p => p.colors?.displayFont || "'Caveat', 'Segoe Print', cursive";
const serif = p => p.colors?.font || 'Georgia, serif';

/** Handwritten (Caveat) or serif text, optionally rotated a little like a note in the margin. */
export function write(p, text, x, y, size, color = 'ink', align = 'left', { serifFace = false, weight = serifFace ? 400 : 600, rotate = 0, alpha = 1, italic = false } = {}) {
    const c = p.c; c.save();
    if (alpha !== 1) c.globalAlpha = alpha;
    c.translate(x, y); if (rotate) c.rotate(rotate);
    c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${serifFace ? serif(p) : hand(p)}`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = p.color(color);
    c.fillText(String(text), 0, 0); c.restore();
}

/** Live status in the page header (handwritten, left) and a serif figure on the right. The room
 * header already names the game and the HUD counts lives, so neither is repeated here. */
export function header(p, status, detail = '') {
    const compact = p.compact, y = compact ? 46 : 30, rule = y + (compact ? 30 : 19);
    write(p, status, compact ? 70 : 58, y, compact ? 46 : 31, 'accent', 'left');
    if (detail) write(p, detail, 694, y + 2, compact ? 30 : 19, 'muted', 'right', { serifFace: true, italic: true });
    p.line([[compact ? 60 : 50, rule], [704, rule]], 'border', 1);
}

/** The notebook page: the painter has laid the square grid; add the red margin rule of the room's page. */
export function page(p) {
    const c = p.c, x = p.compact ? 48 : 40;
    c.save(); c.globalAlpha = .5; p.line([[x, 0], [x, p.h]], MARGIN, 1.5); c.restore();
}

/** Fountain-pen ink: a faint bleed under a crisp stroke. `progress` draws the polyline stroke by stroke. */
export function ink(p, points, color = 'accent', width = 3, progress = 1, dash = []) {
    if (points.length < 2 || progress <= 0) return;
    const drawn = partial(points, progress), c = p.c;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalAlpha = .16; p.line(drawn, color, width + 4, dash);
    c.globalAlpha = 1; p.line(drawn, color, width, dash); c.restore();
}
/** Graphite: thinner, greyer, slightly transparent. */
export function pencil(p, points, width = 2, dash = [], alpha = .85, color = 'muted') {
    if (points.length < 2) return;
    const c = p.c; c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
    p.line(points, color, width, dash); c.restore();
}
/** The leading part of a polyline, `progress` in [0, 1] of its length. */
export function partial(points, progress) {
    if (progress >= 1) return points;
    const lengths = []; let total = 0;
    for (let i = 1; i < points.length; i++) { const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); lengths.push(l); total += l; }
    let left = total * Math.max(0, progress); const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
        if (left >= lengths[i - 1]) { out.push(points[i]); left -= lengths[i - 1]; continue; }
        const k = lengths[i - 1] ? left / lengths[i - 1] : 0, a = points[i - 1], b = points[i];
        out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); break;
    }
    return out;
}

/** A rubber stamp: double square border, serif capitals, a slight tilt. It lands with a short thud (scale 1.35 to 1). */
export function stamp(p, text, x, y, age, color = 'accent', reduced = false, size = 22, rotate = -.08) {
    if (age < 0) return;
    const c = p.c, k = reduced || age > .14 ? 1 : 1.35 - .35 * (age / .14);
    const fade = age > 1.3 ? Math.max(0, 1 - (age - 1.3) / .5) : 1; if (!fade) return;
    c.save(); c.globalAlpha = .88 * fade; c.translate(x, y); c.rotate(rotate); c.scale(k, k);
    c.font = `700 ${size}px ${serif(p)}`; const w = (c.measureText?.(text)?.width || text.length * size * .7) + size * 1.1, h = size * 1.7;
    p.rect(-w / 2, -h / 2, w, h, 'bg');
    p.outline(-w / 2, -h / 2, w, h, color, 3); p.outline(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, color, 1);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = p.color(color); c.fillText(text, 0, 1);
    c.restore();
}

/** An ink blot: a few overlapping discs with fixed offsets (no randomness). */
export function blot(p, x, y, r, color = 'ink', alpha = .8) {
    const c = p.c; c.save(); c.globalAlpha = alpha;
    [[0, 0, 1], [.7, -.3, .45], [-.6, .5, .4], [.2, .8, .3], [-.8, -.6, .25]].forEach(([dx, dy, k]) => p.circle(x + dx * r, y + dy * r, r * k, color));
    c.restore();
}

/** Pencil hatching inside a polygon; `progress` sweeps the strokes in from the left. */
export function hatch(p, polygon, progress = 1, color = 'muted', gap = 9, alpha = .45) {
    if (polygon.length < 3 || progress <= 0) return;
    const c = p.c, xs = polygon.map(q => q[0]), ys = polygon.map(q => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), tall = maxY - minY;
    c.save(); c.beginPath(); polygon.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.clip();
    c.globalAlpha = alpha; const end = minX - tall + (maxX - minX + tall) * Math.min(1, progress);
    for (let x = minX - tall; x <= end; x += gap) p.line([[x, maxY], [x + tall, minY]], color, 1.4);
    c.restore();
}

/** A small four-pointed ink star, as printed in star atlases. */
export function star(p, x, y, r, color = 'ink') {
    const c = p.c; c.save(); c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, k = i % 2 ? r * .32 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    c.closePath(); c.fillStyle = p.color(color); c.fill(); c.restore();
}

/** A label tag: a small circle with a glyph, used for the L / R / arrow tags beside objects. */
export function tag(p, glyph, x, y, r, color = 'accent', filled = true) {
    p.circle(x, y, r, filled ? color : 'bg'); if (!filled) p.circle(x, y, r, color, false);
    write(p, glyph, x, y + 1, r * 1.25, filled ? 'bg' : color, 'center', { serifFace: true, weight: 700 });
}

export function addBurst(s, text, x, y, good = true, at = s.time) { s.bursts.push({ text, x, y, good, at }); s.bursts = s.bursts.slice(-6); }
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.2); }
/** Handwritten score notes that drift up a little as the ink dries; reduced motion keeps them still. */
export function bursts(s, p, reduced = false, project = b => [b.x, b.y], size = p.compact ? 44 : 30) {
    for (const b of s.bursts) {
        const age = s.time - b.at; if (age < 0 || age > 1.2) continue;
        const [x, y] = project(b);
        write(p, b.text, Math.max(120, Math.min(600, x)), y - (reduced ? 0 : age * 18), size, b.good ? 'accent' : 'gold', 'center', { alpha: age > .9 ? (1.2 - age) / .3 : 1, rotate: -.04, weight: 700 });
    }
}
export function addEffect(s, effect, at = s.time) { s.effects.push({ at, ...effect }); s.effects = s.effects.slice(-12); }
export function pruneEffects(s, life = 2) { s.effects = s.effects.filter(e => s.time - e.at < life); }

export function loseLife(s, env, text = 'Game over') {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish(text); }
}
