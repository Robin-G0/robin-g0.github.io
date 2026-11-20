// Frutiger Aero canvas materials: clean water, glossy orbs, glass panels with a specular band,
// Vista-style aurora ribbons and soft bloom. Logical width 720 with a responsive height.
// Decoration reads simulation time only and never consumes gameplay randomness.

/** Theme palette from assets/profile.json (light and dark) plus the era's saturated object colours. */
export const PALETTE = {
    light: { bg: '#effbff', ink: '#123b50', muted: '#39667b', border: '#85bfcc', accent: '#076ca8', soft: '#c7e8f5', gold: '#41651b', goldbg: '#e1efb4' },
    dark: { bg: '#102c40', ink: '#e5faff', muted: '#a3cddc', border: '#407a95', accent: '#83dbff', soft: '#204d65', gold: '#d1f58e', goldbg: '#3b542d' }
};
export const AERO = { aqua: '#18a9e0', sky: '#4cc4f2', deep: '#075f96', lime: '#78c832', leaf: '#3c9a26', sun: '#ffbf1f',
    orange: '#ff8a1e', coral: '#f0564a', pink: '#e2559b', violet: '#8b62d6', jelly: '#c056d2', white: '#ffffff', pebble: '#8d9aa3' };
const SANS = "'Segoe UI', 'Open Sans', Tahoma, sans-serif";
const LIGHT = "'Segoe UI Light', 'Segoe UI', 'Open Sans', sans-serif";

/** Dark appearance follows the site's appearance mode (the Aero room switches with it) or a dark --bg. */
export function isDark(p) {
    if (globalThis.document?.documentElement?.dataset?.mode === 'dark') return true;
    const hex = String(p.colors?.bg || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
    const n = parseInt(hex, 16);
    return ((n >> 16) & 255) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114 < 110;
}
export const tone = p => (isDark(p) ? PALETTE.dark : PALETTE.light);

function rgb(hex) {
    const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mix two hex colours; t=0 gives a, t=1 gives b. */
export function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const alpha = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Gradients degrade to a flat colour when a context cannot create them (unit-test painters).
export function linear(c, x0, y0, x1, y1, stops, fallback = stops[0][1]) {
    const g = typeof c.createLinearGradient === 'function' ? c.createLinearGradient(x0, y0, x1, y1) : null;
    if (!g || typeof g.addColorStop !== 'function') return fallback;
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
}
export function radial(c, x0, y0, r0, x1, y1, r1, stops, fallback = stops.at(-1)[1]) {
    const g = typeof c.createRadialGradient === 'function' ? c.createRadialGradient(x0, y0, r0, x1, y1, r1) : null;
    if (!g || typeof g.addColorStop !== 'function') return fallback;
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
}
function round(c, x, y, w, h, r) { c.beginPath(); c.roundRect?.(x, y, Math.max(0, w), Math.max(0, h), r); }

/** Segoe UI text (Light for large figures) with a soft white bloom so it reads on water and sky. */
export function text(p, value, x, y, size, color = 'ink', align = 'left', weight = 400, { glow = true } = {}) {
    const c = p.c, dark = isDark(p); c.save();
    c.font = `${weight} ${size}px ${weight <= 300 ? LIGHT : SANS}`; c.textAlign = align; c.textBaseline = 'middle';
    if (glow) { c.shadowColor = dark ? 'rgba(0,20,40,.85)' : 'rgba(255,255,255,.95)'; c.shadowBlur = Math.max(4, size * .35); }
    c.fillStyle = p.color(color === 'ink' || color === 'muted' ? tone(p)[color] : color);
    c.fillText(String(value), x, y); c.restore();
}

/**
 * A Vista glass panel: translucent body, a bright specular band across the top half,
 * a white inner rim and a soft outer edge. `tint` colours the glass.
 */
export function glass(p, x, y, w, h, r = 14, { tint = '#ffffff', strength = 1, shadow = true } = {}) {
    const c = p.c, dark = isDark(p); c.save();
    if (shadow) { c.shadowColor = dark ? 'rgba(0,0,0,.45)' : 'rgba(10,80,120,.25)'; c.shadowBlur = 14; c.shadowOffsetY = 4; }
    round(c, x, y, w, h, r);
    c.fillStyle = linear(c, 0, y, 0, y + h, dark
        ? [[0, alpha(mix(tint, '#0a2a40', .55), .62 * strength)], [1, alpha(mix(tint, '#03121f', .7), .7 * strength)]]
        : [[0, alpha(mix(tint, '#ffffff', .55), .72 * strength)], [1, alpha(mix(tint, '#ffffff', .15), .5 * strength)]]);
    c.fill(); c.restore(); c.save();
    round(c, x, y, w, h, r); c.clip();
    // Specular band: the defining Aero highlight, brightest at the top edge.
    c.fillStyle = linear(c, 0, y, 0, y + h * .5, [[0, `rgba(255,255,255,${dark ? .34 : .85})`], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(x, y, w, h * .5);
    c.restore(); c.save();
    round(c, x + .75, y + .75, w - 1.5, h - 1.5, Math.max(0, r - .75));
    c.strokeStyle = `rgba(255,255,255,${dark ? .35 : .9})`; c.lineWidth = 1.5; c.stroke();
    round(c, x, y, w, h, r); c.strokeStyle = dark ? 'rgba(140,220,255,.45)' : alpha(mix(tint, '#0b5c86', .6), .45); c.lineWidth = 1; c.stroke();
    c.restore();
}

/**
 * A glossy orb (Aero gel bubble): saturated body, light inner glow at the bottom and a white
 * specular ellipse at the top. Matte orbs (pebbles) skip the shine so they differ in material too.
 */
export function orb(p, x, y, r, color, { matte = false, opacity = 1, ring = null } = {}) {
    const c = p.c; c.save(); c.globalAlpha *= opacity;
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    c.fillStyle = matte
        ? radial(c, x - r * .3, y - r * .35, r * .1, x, y, r, [[0, mix(color, '#ffffff', .35)], [1, mix(color, '#1b2830', .35)]])
        : radial(c, x, y + r * .55, r * .1, x, y + r * .1, r * 1.15, [[0, mix(color, '#ffffff', .55)], [.55, color], [1, mix(color, '#002a44', .45)]]);
    c.fill();
    c.lineWidth = Math.max(1, r * .06); c.strokeStyle = mix(color, '#00243a', .5); c.stroke();
    if (!matte) {
        c.beginPath(); c.ellipse(x, y - r * .46, r * .62, r * .36, 0, 0, Math.PI * 2);
        c.fillStyle = linear(c, 0, y - r * .82, 0, y - r * .1, [[0, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,.08)']]);
        c.fill();
    }
    if (ring) { c.beginPath(); c.arc(x, y, r + 4, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = ring; c.stroke(); }
    c.restore();
}

/** A clear soap/air bubble: transparent body, bright rim and a small highlight. */
export function bubble(p, x, y, r, opacity = .8) {
    const c = p.c; c.save(); c.globalAlpha *= opacity;
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    c.fillStyle = radial(c, x, y, r * .2, x, y, r, [[0, 'rgba(255,255,255,0.04)'], [.8, 'rgba(210,250,255,0.18)'], [1, 'rgba(255,255,255,0.55)']]);
    c.fill(); c.lineWidth = Math.max(1, r * .08); c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
    c.beginPath(); c.ellipse(x - r * .35, y - r * .4, r * .28, r * .16, -.6, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fill(); c.restore();
}

/** A Windows Vista "Aurora": translucent ribbons of light swept across the scene. */
export function aurora(p, t, y, { amplitude = 40, opacity = .5, colors = ['#7cf7ff', '#b6ff6a', '#ffffff'], width = 720 } = {}) {
    const c = p.c; c.save(); c.globalCompositeOperation = 'lighter';
    colors.forEach((color, i) => {
        const phase = t * (.18 + i * .05) + i * 1.7, thick = 26 - i * 7;
        c.beginPath();
        for (let x = -20; x <= width + 20; x += 24) {
            const yy = y + Math.sin(x / 150 + phase) * amplitude * (1 - i * .2) + Math.sin(x / 61 - phase * 1.3) * 6;
            if (x === -20) c.moveTo(x, yy); else c.lineTo(x, yy);
        }
        c.lineWidth = thick; c.lineCap = 'round';
        c.strokeStyle = linear(c, 0, 0, width, 0, [[0, alpha(color, 0)], [.35, alpha(color, opacity * (1 - i * .25))], [.7, alpha(color, opacity * .5)], [1, alpha(color, 0)]], alpha(color, opacity * .4));
        c.stroke();
    });
    c.restore();
}

// Decorative particles come from a fixed hash of their index, never from env.random.
const hash = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Rising decorative bubbles on simulation time; frozen positions for reduced motion. */
export function risingBubbles(p, t, count = 12, { top = 0, bottom = p.h, left = 0, right = 720, opacity = .7 } = {}) {
    const span = bottom - top + 40;
    for (let i = 0; i < count; i++) {
        const speed = 22 + hash(i) * 38, r = 2.5 + hash(i + 40) * 6;
        const y = bottom + 20 - ((t * speed + hash(i + 80) * span) % span);
        const x = left + hash(i + 120) * (right - left) + Math.sin(t * 1.3 + i) * 5;
        bubble(p, x, y, r, opacity * Math.min(1, (y - top) / 60));
    }
}

/**
 * Clean aquarium water: bright surface, light shafts, caustic shimmer near the surface and
 * a pale sand bed with swaying grass. Dark appearance gives a deep night aquarium.
 */
export function water(p, t, { bed = true, shafts = true } = {}) {
    const c = p.c, h = p.h, dark = isDark(p); c.save();
    c.fillStyle = linear(c, 0, 0, 0, h, dark
        ? [[0, '#14678e'], [.3, '#0b4466'], [.75, '#06283f'], [1, '#041a2b']]
        : [[0, '#d7fbff'], [.22, '#79def3'], [.62, '#22a8d6'], [1, '#0a74a8']]);
    c.fillRect(0, 0, 720, h);
    if (shafts) {
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
            const x = 70 + i * 150 + Math.sin(t * .25 + i * 1.9) * 26, spread = 70 + hash(i + 7) * 60;
            c.beginPath(); c.moveTo(x - 18, 0); c.lineTo(x + 22, 0); c.lineTo(x + spread + 40, h * .85); c.lineTo(x + spread - 40, h * .85); c.closePath();
            c.fillStyle = linear(c, 0, 0, 0, h * .85, [[0, `rgba(255,255,255,${dark ? .12 : .3})`], [1, 'rgba(255,255,255,0)']]);
            c.fill();
        }
        // Caustics: interlaced wavy light lines under the surface.
        c.lineWidth = 1.5; c.strokeStyle = `rgba(255,255,255,${dark ? .1 : .32})`;
        for (let row = 0; row < 3; row++) {
            c.beginPath();
            for (let x = 0; x <= 720; x += 16) {
                const y = 12 + row * 15 + Math.sin(x / 38 + t * 1.2 + row * 2) * 4 + Math.sin(x / 17 - t * .9) * 2;
                if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
            }
            c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
    }
    if (bed) {
        const top = h - 34;
        c.fillStyle = linear(c, 0, top, 0, h, dark ? [[0, '#1b4a52'], [1, '#0b2a33']] : [[0, '#e9f7e4'], [1, '#bfe2c8']]);
        c.beginPath(); c.moveTo(0, top + 8);
        for (let x = 0; x <= 720; x += 40) c.quadraticCurveTo(x + 20, top - 6 + hash(x) * 8, x + 40, top + 6);
        c.lineTo(720, h); c.lineTo(0, h); c.closePath(); c.fill();
        grass(p, t, top + 6, { blades: 26, height: 30, dark });
        for (let i = 0; i < 9; i++) orb(p, 30 + hash(i + 300) * 660, h - 10 - hash(i + 350) * 10, 7 + hash(i + 400) * 7, dark ? '#5e7f8c' : '#dfeef2', { opacity: .9 });
    }
    c.restore();
}

/** Swaying grass blades along a baseline. */
export function grass(p, t, base, { blades = 30, height = 34, left = 0, right = 720, dark = isDark(p) } = {}) {
    const c = p.c; c.save();
    for (let i = 0; i < blades; i++) {
        const x = left + (i + hash(i + 900) * .8) * (right - left) / blades, tall = height * (.55 + hash(i + 950) * .6);
        const sway = Math.sin(t * 1.4 + i * .7) * 6;
        c.beginPath(); c.moveTo(x - 3, base); c.quadraticCurveTo(x + sway * .5, base - tall * .6, x + sway, base - tall); c.quadraticCurveTo(x + sway * .4 + 2, base - tall * .5, x + 3, base); c.closePath();
        c.fillStyle = linear(c, 0, base - tall, 0, base, dark ? [[0, '#6fcf5a'], [1, '#1d5a2a']] : [[0, '#b8f26a'], [1, '#2f8f2a']]);
        c.fill();
    }
    c.restore();
}

/**
 * An Aero meadow: Vista sky, lens light from the sun corner, rolling glossy hills.
 * Dark appearance gives a night sky with a green-cyan aurora.
 */
export function meadow(p, t, horizon) {
    const c = p.c, h = p.h, dark = isDark(p); c.save();
    c.fillStyle = linear(c, 0, 0, 0, horizon + 40, dark
        ? [[0, '#03142a'], [.6, '#0b3556'], [1, '#155b78']]
        : [[0, '#1c8fd8'], [.55, '#6fcaf2'], [1, '#e2f8ff']]);
    c.fillRect(0, 0, 720, h);
    if (dark) aurora(p, t, horizon * .45, { amplitude: 26, opacity: .42, colors: ['#3dffb5', '#45d4ff', '#c7ff7a'] });
    else {
        const sun = radial(c, 640, 40, 4, 640, 40, 240, [[0, 'rgba(255,255,240,1)'], [.12, 'rgba(255,255,220,.75)'], [1, 'rgba(255,255,255,0)']], null);
        if (sun) { c.fillStyle = sun; c.fillRect(380, 0, 340, 300); }
        for (const [d, r] of [[.35, 18], [.6, 9], [.85, 26]]) bubble(p, 640 - 300 * d, 40 + 190 * d, r, .35); // lens flare rings
        aurora(p, t, horizon * .55, { amplitude: 22, opacity: .38 });
    }
    // Two rolling hills with a glossy specular crest.
    for (const [offset, light, deep] of [[0, dark ? '#2f7a3a' : '#9be05a', dark ? '#123e22' : '#3fa233'], [36, dark ? '#3f9a45' : '#b6ef6a', dark ? '#174a27' : '#4cb63a']]) {
        const top = horizon + offset;
        c.beginPath(); c.moveTo(0, top + 30);
        c.bezierCurveTo(200, top - 30 + offset * .4, 420, top + 50, 720, top - 4);
        c.lineTo(720, h); c.lineTo(0, h); c.closePath();
        c.fillStyle = linear(c, 0, top - 20, 0, h, [[0, light], [.5, deep], [1, mix(deep, '#000000', .25)]]);
        c.fill();
        c.save(); c.clip();
        c.fillStyle = linear(c, 0, top - 30, 0, top + 40, [[0, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
        c.fillRect(0, top - 30, 720, 70); c.restore();
    }
    c.restore();
}

/**
 * Live status in a glass pill (left) and a smaller secondary figure (right). The room header names
 * the game and the HUD counts score and lives, so neither is repeated here.
 */
export function header(p, status, detail = '') {
    const compact = p.compact, y = compact ? 22 : 12, hgt = compact ? 58 : 40, size = compact ? 32 : 22;
    const c = p.c; c.save(); c.font = `400 ${size}px ${SANS}`;
    const width = Math.min(420, (c.measureText?.(status)?.width || status.length * size * .55) + 40);
    c.restore();
    glass(p, 14, y, width, hgt, hgt / 2);
    text(p, status, 34, y + hgt / 2 + 1, size, 'ink', 'left', 400);
    if (detail) {
        c.save(); c.font = `400 ${size * .8}px ${SANS}`;
        const dw = Math.min(330, (c.measureText?.(detail)?.width || detail.length * size * .45) + 34); c.restore();
        glass(p, 706 - dw, y + 4, dw, hgt - 8, (hgt - 8) / 2, { shadow: false, strength: .8 });
        text(p, detail, 706 - dw / 2, y + hgt / 2 + 1, size * .8, 'muted', 'center', 400);
    }
}

/** Floating score text near the object it describes; bounded to six. */
export function addBurst(s, value, x, y, good = true, big = false) {
    s.bursts.push({ text: value, x, y, good, big, at: s.time }); s.bursts = s.bursts.slice(-6);
}
export function pruneBursts(s) { s.bursts = s.bursts.filter(b => s.time - b.at < 1.2); }
export function bursts(p, s, reduced = false) {
    for (const b of s.bursts) {
        const age = s.time - b.at; if (age < 0 || age > 1.2) continue;
        const size = (p.compact ? 38 : 26) * (b.big ? 1.25 : 1), c = p.c;
        c.save(); c.globalAlpha = Math.min(1, (1.2 - age) * 3);
        text(p, b.text, Math.max(80, Math.min(640, b.x)), b.y - (reduced ? 0 : age * 26), size, b.good ? (isDark(p) ? '#d1f58e' : '#2c7a12') : AERO.coral, 'center', 600);
        c.restore();
    }
}

/** Effects are drawn from simulation time; at most sixteen are kept. */
export function addEffect(s, effect) { s.effects.push({ at: s.time, ...effect }); s.effects = s.effects.slice(-16); }
export function pruneEffects(s, life = 1.2) { s.effects = s.effects.filter(e => s.time - e.at < life); }

/** An expanding ring of light (pop, arrival). Reduced motion keeps a steady outline instead. */
export function ring(p, x, y, r, age, color = '#ffffff', reduced = false, life = .6) {
    if (age < 0 || age > life) return;
    const c = p.c; c.save();
    if (reduced) { c.globalAlpha = .8; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = color; c.stroke(); c.restore(); return; }
    const k = age / life; c.globalAlpha = 1 - k;
    c.beginPath(); c.arc(x, y, r * (1 + k * .9), 0, Math.PI * 2); c.lineWidth = 4 * (1 - k) + 1; c.strokeStyle = color; c.stroke();
    c.restore();
}

/** A glossy cartoon fish. angle 0 faces right; -PI/2 swims up the screen. */
export function fish(p, x, y, length, color, angle, t, { opacity = 1, wag = 1 } = {}) {
    const c = p.c, L = length; c.save(); c.globalAlpha *= opacity;
    c.translate(x, y); c.rotate(angle);
    const tail = Math.sin(t * 9 + x * .05) * .35 * wag;
    c.save(); c.translate(-L * .34, 0); c.rotate(tail);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-L * .3, -L * .2); c.quadraticCurveTo(-L * .22, 0, -L * .3, L * .2); c.closePath();
    c.fillStyle = mix(color, '#ffffff', .25); c.fill(); c.restore();
    c.beginPath(); c.moveTo(-L * .05, -L * .18); c.quadraticCurveTo(L * .05, -L * .34, L * .16, -L * .17); c.closePath();
    c.fillStyle = mix(color, '#ffffff', .3); c.fill();
    c.beginPath(); c.ellipse(0, 0, L * .4, L * .2, 0, 0, Math.PI * 2);
    c.fillStyle = linear(c, 0, -L * .2, 0, L * .2, [[0, mix(color, '#7a2400', .15)], [.55, color], [1, mix(color, '#ffffff', .65)]], color);
    c.fill(); c.lineWidth = 1; c.strokeStyle = mix(color, '#3a1400', .45); c.stroke();
    c.beginPath(); c.ellipse(L * .02, -L * .09, L * .26, L * .06, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    c.beginPath(); c.arc(L * .24, -L * .04, L * .055, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); c.arc(L * .255, -L * .04, L * .03, 0, Math.PI * 2); c.fillStyle = '#062033'; c.fill();
    c.restore();
}

/** A translucent jellyfish: glossy bell, frilled rim and waving tentacles. */
export function jellyfish(p, x, y, size, t, { opacity = 1 } = {}) {
    const c = p.c, r = size / 2; c.save(); c.globalAlpha *= opacity;
    c.lineCap = 'round'; c.lineWidth = Math.max(2, r * .09); c.strokeStyle = alpha(AERO.jelly, .75);
    for (let i = 0; i < 5; i++) {
        const ox = (i - 2) * r * .32; c.beginPath(); c.moveTo(x + ox, y + r * .2);
        for (let k = 1; k <= 4; k++) c.lineTo(x + ox + Math.sin(t * 3 + i + k) * r * .14, y + r * .2 + k * r * .28);
        c.stroke();
    }
    c.beginPath(); c.moveTo(x - r, y + r * .25); c.bezierCurveTo(x - r, y - r * 1.05, x + r, y - r * 1.05, x + r, y + r * .25);
    for (let i = 4; i >= 0; i--) c.quadraticCurveTo(x - r + (i + .5) * r * .4, y + r * .48, x - r + i * r * .4, y + r * .25);
    c.closePath();
    c.fillStyle = radial(c, x, y + r * .2, r * .1, x, y - r * .2, r * 1.2, [[0, 'rgba(255,190,250,.95)'], [.6, alpha(AERO.jelly, .85)], [1, alpha('#6a1f86', .9)]], AERO.jelly);
    c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke();
    c.beginPath(); c.ellipse(x - r * .15, y - r * .45, r * .5, r * .22, -.2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
    c.restore();
}

/** Small vector glyphs used inside orbs and badges: a second cue besides colour. */
export function glyph(p, kind, x, y, r, color = '#ffffff') {
    const c = p.c; c.save(); c.fillStyle = color; c.strokeStyle = color; c.lineWidth = Math.max(1.5, r * .16); c.lineJoin = 'round'; c.lineCap = 'round';
    c.shadowColor = 'rgba(0,40,70,.45)'; c.shadowBlur = r * .3;
    c.beginPath();
    if (kind === 'drop') { c.moveTo(x, y - r); c.bezierCurveTo(x + r * .9, y + r * .05, x + r * .7, y + r * .9, x, y + r * .9); c.bezierCurveTo(x - r * .7, y + r * .9, x - r * .9, y + r * .05, x, y - r); c.fill(); }
    else if (kind === 'sun') { c.arc(x, y, r * .45, 0, Math.PI * 2); c.fill(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(x + Math.cos(a) * r * .65, y + Math.sin(a) * r * .65); c.lineTo(x + Math.cos(a) * r * .95, y + Math.sin(a) * r * .95); } c.stroke(); }
    else if (kind === 'leaf') { c.moveTo(x - r * .8, y + r * .7); c.quadraticCurveTo(x - r * .7, y - r * .8, x + r * .8, y - r * .8); c.quadraticCurveTo(x + r * .7, y + r * .6, x - r * .8, y + r * .7); c.fill(); }
    else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * .42 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } c.closePath(); c.fill(); }
    else if (kind === 'flower') { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; c.moveTo(x, y); c.arc(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, r * .38, 0, Math.PI * 2); } c.fill(); }
    else if (kind === 'diamond') { c.moveTo(x, y - r); c.lineTo(x + r * .75, y); c.lineTo(x, y + r); c.lineTo(x - r * .75, y); c.closePath(); c.fill(); }
    else if (kind === 'rainbow') { for (const [k, col] of [[1, '#ff6b5e'], [.75, '#ffd23f'], [.5, '#4cd964']]) { c.beginPath(); c.strokeStyle = col; c.lineWidth = r * .22; c.arc(x, y + r * .4, r * k, Math.PI, 0); c.stroke(); } }
    c.restore();
}

/** Ring timer: a glossy track with the remaining fraction lit; it turns coral when short. */
export function timerRing(p, x, y, r, fraction, color = AERO.aqua) {
    const c = p.c; c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.lineWidth = Math.max(3, r * .16); c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
    c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, fraction)));
    c.strokeStyle = fraction < .3 ? AERO.coral : color; c.lineCap = 'round'; c.stroke();
    c.restore();
}

export function loseLife(s, env, recovery = 0) {
    s.lives = Math.max(0, s.lives - 1); s.safeUntil = s.time + recovery; env.sound?.({ kind: 'miss' });
    if (!s.lives) { s.ended = true; env.finish('Game over'); }
}
