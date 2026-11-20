/** Under Construction decoration shared by Pop-up Panic, Link Maze and GIF Juggler: a GeoCities-era
 * starfield, four-point GIF sparkles, slow blink and hazard tape. Original drawings; every effect is
 * chosen from simulation time and hashed positions (never env.random), and reduced motion keeps a still frame. */

export function hash(i) { const x = Math.sin(i * 91.7 + 47.3) * 24634.6345; return x - Math.floor(x); }

/** The page background colour from the theme chart (light #10103b, dark #080823), else a fallback. */
export function pageColor(p, fallback = '#110b32') {
    const colors = p?.colors;
    return colors && typeof colors === 'object' && colors.theme === 'construction' && /^#[0-9a-f]{6}$/i.test(colors.bg || '') ? colors.bg : fallback;
}

/** Four-point sparkle, the signature animated-GIF glint. phase 0..1 grows then shrinks it. */
export function sparkle(p, x, y, size, color = '#ffffff', phase = .5) {
    const r = size * Math.sin(Math.max(0, Math.min(1, phase)) * Math.PI);
    if (r < .8) return;
    p.line([[x - r, y], [x + r, y]], color, Math.max(1.5, r * .18));
    p.line([[x, y - r], [x, y + r]], color, Math.max(1.5, r * .18));
    const d = r * .35;
    p.line([[x - d, y - d], [x + d, y + d]], color, 1.5);
    p.line([[x + d, y - d], [x - d, y + d]], color, 1.5);
    p.rect(x - 1.5, y - 1.5, 3, 3, '#ffffff');
}

/** Fixed starfield inside a rectangle; a few stars glint in turn on simulation time. */
export function starfield(p, left, top, width, height, time = 0, reduced = false, count = 40, glints = 5) {
    for (let i = 0; i < count; i++) {
        const x = left + hash(i) * width, y = top + hash(i + 300) * height;
        p.rect(x, y, i % 7 ? 2 : 3, i % 7 ? 2 : 3, i % 3 ? '#3a3470' : '#6d64a8');
    }
    for (let i = 0; i < glints; i++) {
        const x = left + hash(i * 13 + 5) * width, y = top + hash(i * 13 + 900) * height;
        // Each glint has its own 2.4 s cycle and lights for 0.6 s of it; reduced motion shows a small still star.
        const cycle = (time / 2.4 + hash(i + 77)) % 1;
        if (reduced) sparkle(p, x, y, 6, '#d1c5ff', .5);
        else if (cycle < .25) sparkle(p, x, y, 11, i % 2 ? '#62ffff' : '#fff15a', cycle / .25);
    }
}

/** A ring of sparkles thrown from a cleared object (seeded by its id, not by RNG). */
export function sparkleBurst(p, x, y, age, seed, colors = ['#fff15a', '#62ffff', '#ffffff'], reduced = false, reach = 60, duration = .65) {
    if (reduced || age < 0 || age > duration) return;
    const t = age / duration, ease = 1 - Math.pow(1 - t, 3);
    for (let i = 0; i < 6; i++) {
        const angle = i / 6 * Math.PI * 2 + hash(seed + i) * .7, distance = reach * ease * (.55 + hash(seed - i) * .45);
        sparkle(p, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 9 + 5 * hash(seed + i * 3), colors[i % colors.length], Math.min(1, t * 1.6));
    }
}

/** A slow blink (about 1.25 Hz, half on): the era's <blink>, but gentle. Reduced motion keeps it on. */
export function blinkOn(time, reduced = false) { return reduced || Math.floor(time * 2.5) % 2 === 0; }

/** Diagonal yellow and black construction tape; it crawls slowly on simulation time unless reduced. */
export function hazardTape(p, left, top, width, height, time = 0, reduced = false) {
    const c = p.c, stripe = height * 1.4, shift = reduced ? 0 : (time * 24) % (stripe * 2);
    p.rect(left, top, width, height, '#17102c');
    if (typeof c?.save !== 'function') return;
    c.save(); c.beginPath(); c.rect(left, top, width, height); c.clip?.();
    for (let x = left - stripe * 2 + shift; x < left + width + stripe; x += stripe * 2) {
        c.beginPath(); c.moveTo(x, top + height); c.lineTo(x + height, top); c.lineTo(x + height + stripe, top);
        c.lineTo(x + stripe, top + height); c.closePath(); c.fillStyle = '#fff15a'; c.fill();
    }
    c.restore();
}
