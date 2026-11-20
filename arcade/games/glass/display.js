// Glass / Fluent materials: acrylic panels, a reveal light that follows the action, depth layers and
// soft refraction. Drawn at logical width 720 with a responsive height. Decoration reads simulation time
// only and never consumes gameplay RNG; reduced motion freezes drift and shimmer, never rules.

/** The theme chart from assets/profile.json (dark and light) plus the three spectrum hues the games share. */
export const PALETTE = {
    dark: { bg: '#1a2035', ink: '#f0f2ff', muted: '#b4bfdc', border: '#4a557c', accent: '#b2bfff', soft: '#303d61', gold: '#f3d392',
        panel: 'rgba(214,226,255,.10)', edge: 'rgba(240,244,255,.38)', shadow: 'rgba(4,8,24,.45)', danger: '#ff9d8a', veil: 'rgba(16,22,44,.42)' },
    light: { bg: '#f1f3ff', ink: '#202440', muted: '#5e6481', border: '#c4cbe9', accent: '#4b52ad', soft: '#dfe4fb', gold: '#84612c',
        panel: 'rgba(255,255,255,.62)', edge: 'rgba(255,255,255,.95)', shadow: 'rgba(40,48,110,.16)', danger: '#b23a2a', veil: 'rgba(241,243,255,.40)' }
};
/** Spectrum rays: each colour also has its own shape so colour is never the only cue. */
export const SPECTRUM = [
    { name: 'rose', dark: '#ff8fb4', light: '#c2185b', shape: 'triangle' },
    { name: 'mint', dark: '#74f0c4', light: '#00806a', shape: 'square' },
    { name: 'sky', dark: '#8cc8ff', light: '#1565c0', shape: 'circle' }
];
const FAMILY = "'Segoe UI Variable Display', 'Segoe UI Variable Text', 'Segoe UI', 'Open Sans', Arial, sans-serif";

/** The site's glass room stays a dark acrylic in both appearances (its body overrides the light root
 * values), so the canvas follows the room's actual background, not the switch: the light chart is used only
 * if that background is light. Checked once per appearance change; tests use the dark chart. */
let modeKey = null, modeValue = 'dark';
export function mode() {
    if (typeof document === 'undefined' || !document.body || typeof getComputedStyle === 'undefined') return 'dark';
    const key = `${document.documentElement.dataset.mode}|${document.documentElement.dataset.theme}`;
    if (key !== modeKey) {
        modeKey = key;
        const hex = getComputedStyle(document.body).getPropertyValue('--bg').trim();
        const n = /^#[0-9a-f]{6}/i.test(hex) ? parseInt(hex.slice(1, 7), 16) : 0;
        modeValue = ((n >> 16) * .3 + (n >> 8 & 255) * .59 + (n & 255) * .11) > 150 ? 'light' : 'dark';
    }
    return modeValue;
}
export const tone = key => PALETTE[mode()][key];
export const hue = index => SPECTRUM[index][mode()];

export function text(p, value, x, y, size, color = tone('ink'), align = 'left', weight = 400) {
    const c = p.c; c.save();
    c.font = `${weight} ${size}px ${FAMILY}`; c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = color; c.fillText(String(value), x, y); c.restore();
}

// ---- Art: decoded once per page, drawn with a vector fallback until ready. ----
const ART = { far: 'glass-aurora-far-v1.png', mid: 'glass-aurora-mid-v1.png', near: 'glass-aurora-near-v1.png',
    depths: 'glass-abyss-depths-v1.jpg', sky: 'glass-space-sky-v1.jpg', horizon: 'glass-lunar-horizon-v1.jpg',
    earth: 'glass-space-earth-v1.png', jelly: 'glass-abyss-jellyfish-v1.png' };
const images = new Map();
export function art(name) {
    if (typeof Image === 'undefined' || !ART[name]) return null;
    let entry = images.get(name);
    if (!entry) {
        const image = new Image(); entry = { image, ready: false }; images.set(name, entry);
        image.onload = () => { entry.ready = true; };
        image.src = new URL(`../../../assets/art/${ART[name]}`, import.meta.url).href;
    }
    return entry.ready ? entry.image : null;
}
function cover(c, image, x, y, w, h, alpha = 1) {
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
    c.save(); c.globalAlpha = alpha; c.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); c.restore();
}

// ---- Acrylic noise: a fixed 96 px tile from a hash, never from gameplay randomness. ----
let noiseTile = null;
function noise(c) {
    if (noiseTile === null) {
        noiseTile = false;
        if (typeof document !== 'undefined' && document.createElement) {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
            const g = canvas.getContext('2d'), data = g.createImageData(96, 96);
            for (let i = 0; i < 96 * 96; i++) {
                const v = (Math.imul(i ^ 0x9e3779b9, 2654435761) >>> 24);
                data.data.set([v, v, v, 14], i * 4);
            }
            g.putImageData(data, 0, 0); noiseTile = canvas;
        }
    }
    if (!noiseTile || !c.createPattern) return null;
    return c.createPattern(noiseTile, 'repeat');
}

/** Scene backdrops: deep space, deep sea or aurora, each in two or three parallax layers. */
export function scene(p, kind, time, reduced = false) {
    const c = p.c, w = 720, h = p.h, light = mode() === 'light', t = reduced ? 0 : time;
    const base = c.createLinearGradient ? c.createLinearGradient(0, 0, 0, h) : null;
    const stops = { space: light ? ['#e9ecfb', '#d9def6'] : ['#0b1024', '#1a2035'],
        abyss: light ? ['#e4f1fb', '#c9d9ee'] : ['#16304a', '#070d1c'],
        aurora: light ? ['#eef0ff', '#dfe4fb'] : ['#141a33', '#1d2440'] }[kind];
    if (base) { base.addColorStop(0, stops[0]); base.addColorStop(1, stops[1]); c.fillStyle = base; }
    else c.fillStyle = stops[1];
    c.fillRect(0, 0, w, h);
    if (kind === 'space') {
        const sky = art('sky'); if (sky) cover(c, sky, -20 - (t * 1.2) % 20, 0, w + 40, h, light ? .16 : .8);
        else for (let i = 0; i < 40; i++) p.rect((i * 173) % w, (i * 97) % h, 2, 2, tone('muted'));
    } else if (kind === 'abyss') {
        const depths = art('depths'); if (depths) cover(c, depths, 0, 0, w, h, light ? .22 : .7);
        // Caustics: soft light shafts from the surface, swaying slowly.
        c.save(); c.globalAlpha = light ? .35 : .16;
        for (let i = 0; i < 5; i++) {
            const x = 90 + i * 140 + Math.sin(t * .35 + i * 1.7) * 26, spread = 30 + i % 2 * 18;
            const g = c.createLinearGradient ? c.createLinearGradient(0, 0, 0, h * .7) : null;
            if (g) { g.addColorStop(0, light ? '#ffffff' : '#bfe8ff'); g.addColorStop(1, 'rgba(191,232,255,0)'); c.fillStyle = g; }
            c.beginPath(); c.moveTo(x - spread, 0); c.lineTo(x + spread, 0); c.lineTo(x + spread * 2.4 - 60, h * .7); c.lineTo(x - spread * .4 - 60, h * .7); c.fill();
        }
        c.restore();
    } else {
        for (const [name, speed, alpha] of [['far', 3, .55], ['mid', 6, .45], ['near', 11, .4]]) {
            const layer = art(name); if (!layer) continue;
            const width = Math.max(w, layer.naturalWidth * h / layer.naturalHeight), offset = -((t * speed) % width);
            c.save(); c.globalAlpha = light ? alpha * .5 : alpha;
            c.drawImage(layer, offset, 0, width, h); c.drawImage(layer, offset + width, 0, width, h); c.restore();
        }
    }
    // Mica veil keeps play readable on top of any photograph.
    c.fillStyle = tone('veil'); c.fillRect(0, 0, w, h);
}

/** An acrylic panel: translucent tint, noise, a bright top edge and a soft drop shadow. */
export function acrylic(p, x, y, w, h, radius = 22, { tint = tone('panel'), edge = tone('edge'), glow = 0 } = {}) {
    const c = p.c; c.save();
    c.shadowColor = tone('shadow'); c.shadowBlur = 18; c.shadowOffsetY = 6;
    c.fillStyle = tint; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
    c.shadowColor = 'transparent';
    const pattern = noise(c); if (pattern) { c.fillStyle = pattern; c.fill(); }
    c.lineWidth = 1.2; c.strokeStyle = edge; c.globalAlpha = .9; c.stroke();
    if (glow > 0) { c.globalAlpha = Math.min(1, glow); c.lineWidth = 2.5; c.strokeStyle = tone('accent'); c.stroke(); }
    c.restore();
}

/** The Fluent reveal light: a soft radial glow centred on whatever the player just moved. */
export function reveal(p, x, y, radius, color = tone('accent'), strength = .5) {
    const c = p.c; if (!c.createRadialGradient || radius <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, withAlpha(color, strength)); g.addColorStop(1, withAlpha(color, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill(); c.restore();
}
export function withAlpha(hex, alpha) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/** Live status in an acrylic pill: the room header already names the game and the HUD counts lives. */
export function header(p, status, detail = '') {
    const compact = p.compact, size = compact ? 34 : 22, y = compact ? 22 : 14, height = compact ? 62 : 40;
    const c = p.c; c.save(); c.font = `400 ${size}px ${FAMILY}`;
    const width = Math.min(compact ? 676 : 420, (c.measureText?.(status)?.width ?? status.length * size * .55) + (compact ? 48 : 36)); c.restore();
    acrylic(p, 22, y, width, height, height / 2);
    text(p, status, 22 + width / 2, y + height / 2 + 1, size, tone('ink'), 'center', 400);
    if (detail) {
        if (compact) text(p, detail, 698, y + height + 30, 26, tone('muted'), 'right', 400);
        else text(p, detail, 698, y + height / 2 + 1, 19, tone('muted'), 'right', 400);
    }
}

export function shape(p, kind, x, y, r, color, filled = true, width = 3) {
    const c = p.c; c.save(); c.beginPath();
    if (kind === 'triangle') { c.moveTo(x, y - r); c.lineTo(x + r * .92, y + r * .62); c.lineTo(x - r * .92, y + r * .62); c.closePath(); }
    else if (kind === 'square') c.roundRect(x - r * .78, y - r * .78, r * 1.56, r * 1.56, r * .22);
    else if (kind === 'hexagon') { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
    else if (kind === 'shard') { const pts = [[0, -1], [.55, -.2], [.9, .35], [.15, .95], [-.6, .6], [-.85, -.15]]; pts.forEach(([u, v], i) => c[i ? 'lineTo' : 'moveTo'](x + u * r, y + v * r)); c.closePath(); }
    else c.arc(x, y, r, 0, Math.PI * 2);
    if (filled) { c.fillStyle = color; c.fill(); } else { c.lineWidth = width; c.strokeStyle = color; c.stroke(); }
    c.restore();
}

/** Bounded score bursts at the object that earned them; they rise unless motion is reduced. */
export function addBurst(s, text, x, y, good = true) { s.bursts.push({ text, x, y, good, at: s.time }); s.bursts = s.bursts.slice(-6); }
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.1); }
/** Draws bursts; `project` maps a burst's stored anchor to canvas coordinates for the current layout. */
export function bursts(s, p, reduced = false, project = b => [b.x, b.y]) {
    for (const b of s.bursts) {
        const age = s.time - b.at; if (age > 1.1) continue;
        const c = p.c; c.save(); c.globalAlpha = Math.min(1, (1.1 - age) * 2.5);
        const [bx, y] = project(b), x = Math.max(p.compact ? 150 : 100, Math.min(p.compact ? 570 : 620, bx));
        text(p, b.text, x, y - (reduced ? 0 : age * 26), p.compact ? 36 : 26, b.good ? tone('ink') : tone('danger'), 'center', b.good ? 400 : 600);
        c.restore();
    }
}
export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-16); }
export function pruneEffects(s) { s.effects = s.effects.filter(e => s.time - e.at < 1.2); }

/** An expanding refraction ring for a capture; reduced motion keeps one steady ring. */
export function ripple(p, x, y, radius, age, color, reduced = false, reach = 34) {
    if (age < 0 || age > .7) return;
    const c = p.c; c.save();
    if (reduced) { c.globalAlpha = age < .45 ? .9 : 0; shape(p, 'circle', x, y, radius + reach * .4, color, false, 3); c.restore(); return; }
    const u = age / .7; c.globalAlpha = (1 - u) * .9;
    shape(p, 'circle', x, y, radius + reach * u, color, false, 3 * (1 - u) + 1);
    c.globalAlpha = (1 - u) * .5; shape(p, 'circle', x, y, radius + reach * .55 * u, withAlpha('#ffffff', .8), false, 1.5);
    c.restore();
}

export function meter(p, x, y, width, fraction, color = tone('accent'), height = 10) {
    const c = p.c; c.save(); c.fillStyle = withAlpha(tone('ink'), .16); c.beginPath(); c.roundRect(x, y, width, height, height / 2); c.fill();
    c.fillStyle = color; c.beginPath(); c.roundRect(x, y, Math.max(height, Math.max(0, Math.min(1, fraction)) * width), height, height / 2); c.fill(); c.restore();
}

export function loseLife(s, env) {
    s.lives = Math.max(0, s.lives - 1); env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
