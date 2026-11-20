import { JUGGLER, CONTACT_Y } from './gif-juggler-config.js?v=eras-3';
import { drawJugglerSprite } from './gif-juggler-art.js?v=eras-3';
import { Painter } from '../core/painter.js?v=eras-3';
import { starfield, sparkleBurst, pageColor, hash } from './construction-fx.js?v=eras-3';

const NAVY = '#100d35', INK = '#fff9e8', GOLD = '#fff16b', CYAN = '#65ffff';
const laneX = lane => lane ? 525 : 195;
const layers = new WeakMap();

function geometry(p) {
    const line = p.h - (p.compact ? 105 : 65), top = p.compact ? 148 : 92;
    const size = p.compact ? 106 : 82;
    return { line, top, size, y: value => top + (value - 55) * (line - size / 2 - top) / (CONTACT_Y - 55) };
}

function backdrop(p, g) {
    p.rect(15, 12, 690, p.h - 26, pageColor(p, '#08091e'));
    p.outline(15, 12, 690, p.h - 26, '#6d60a9', 2);
    p.rect(19, 16, 682, 42, '#30235c');
    p.line([[20, 58], [700, 58]], '#8c79c3', 2);
    for (let i = 0; i < 48; i++) {
        const x = 35 + (i * 137 % 650), y = 76 + (i * 71 % Math.max(1, g.line - 95));
        p.rect(x, y, i % 5 ? 2 : 3, 2, i % 3 ? '#272448' : '#49416b');
    }
    p.line([[360, 79], [360, p.h - 30]], '#4d4268', 1, [3, 8]);
    for (const lane of [0, 1]) {
        const x = laneX(lane);
        // A GIF becomes catchable when its visible bottom enters this short band.
        const catchTop = g.y(JUGGLER.catchStart) + g.size / 2;
        p.line([[x - 118, catchTop], [x + 118, catchTop]], '#3d5869', 1, [3, 7]);
        p.line([[x - 118, catchTop], [x - 118, g.line], [x - 106, g.line]], '#3d5869');
        p.line([[x + 118, catchTop], [x + 118, g.line], [x + 106, g.line]], '#3d5869');
        p.rect(x - 118, g.line - 1, 236, 10, GOLD);
        for (let j = 0; j < 12; j++) p.rect(x - 118 + j * 20, g.line + 1, 10, 6, NAVY);
        p.text(lane ? 'R' : 'L', x, p.h - (p.compact ? 42 : 29), p.compact ? 54 : 35, INK, 'center');
    }
}

function staticLayer(p, g) {
    if (typeof document === 'undefined') { backdrop(p, g); return; }
    let layer = layers.get(p);
    if (!layer || layer.height !== p.h || layer.compact !== p.compact || layer.colors !== p.colors) {
        const scale = p.c.getTransform().a || 1, canvas = document.createElement('canvas');
        canvas.width = p.w * scale; canvas.height = p.h * scale;
        const c = canvas.getContext('2d'); c.setTransform(scale, 0, 0, scale, 0, 0);
        const cached = new Painter(c, p.colors); cached.h = p.h; cached.compact = p.compact;
        backdrop(cached, g);
        layer = { canvas, height: p.h, compact: p.compact, colors: p.colors }; layers.set(p, layer);
    }
    p.c.drawImage(layer.canvas, 0, 0, p.w, p.h);
}

const MARQUEE = '~*~ Welcome to my GIF collection ~*~ Thanks for stopping by ~*~ Sign my guestbook ~*~ ';
/** Homepage header: a <marquee> greeting and a visitor-style counter of catches (the room shows the title). */
function header(s, p, reducedMotion) {
    const compact = p.compact, size = compact ? 30 : 23, digits = String(Math.min(999999, s.catches)).padStart(6, '0');
    const cell = compact ? 28 : 20, counterX = 701 - 10 - digits.length * cell;
    const c = p.c, clip = typeof c?.save === 'function' && typeof c.clip === 'function';
    if (clip) { c.save(); c.beginPath(); c.rect(22, 16, counterX - 34, 42); c.clip(); }
    const span = MARQUEE.length * size * .5, offset = reducedMotion ? 0 : (s.time * 70) % span;
    for (let k = 0; k < 2; k++) p.text(MARQUEE, 30 - offset + k * span, 37, size, '#d1c5ff');
    if (clip) c.restore();
    // LED odometer: the classic hit counter, here counting catches.
    p.rect(counterX - 4, 21, digits.length * cell + 8, 32, '#000000');
    [...digits].forEach((digit, i) => {
        p.rect(counterX + i * cell, 24, cell - 3, 26, '#141414');
        p.text(digit, counterX + i * cell + (cell - 3) / 2, 37, compact ? 28 : 21, '#7dff6b', 'center');
    });
}

export function renderJuggler(s, p, reducedMotion = false) {
    const g = geometry(p), size = g.size;
    staticLayer(p, g);
    header(s, p, reducedMotion);
    // A few stars glint over the cached backdrop (never RNG; still frame for reduced motion).
    starfield(p, 35, 76, 650, Math.max(1, g.line - 120), s.time, reducedMotion, 0, 4);
    // Four little slots teach when the next gift is earned without a paragraph.
    for (let i = 0; i < JUGGLER.giftEvery; i++) {
        p.rect(304 + i * 30, 73, 22, 9, i < s.giftProgress ? GOLD : '#42365f');
    }
    if (s.time < s.slowUntil) {
        drawJugglerSprite(p, 'slow', 47, 104, 46, s.time, reducedMotion);
        p.text(Math.ceil(s.slowUntil - s.time), 78, 107, 28, CYAN);
    }
    if (s.net) drawJugglerSprite(p, 'net', 669, 104, 48, s.time, reducedMotion);

    const upcoming = JUGGLER.arrivals[s.arrival];
    if (upcoming && upcoming.at - s.time < 3) {
        const x = laneX(upcoming.lane);
        p.text('+ GIF', x, g.top + 10, p.compact ? 34 : 25, GOLD, 'center');
    }
    for (const lane of [0, 1]) {
        const pulse = s.pulses[lane], age = pulse ? s.time - pulse.at : 10;
        const touching = s.balls.some(ball => ball.lane === lane && ball.contactAt !== null);
        if (age < .3 || touching) {
            p.rect(laneX(lane) - 119, g.line - 5, 238, 7, touching ? GOLD : pulse.hit ? CYAN : '#8a7db3');
            p.outline(laneX(lane) - 123, g.line - 12, 246, 26, touching ? GOLD : CYAN, 2);
        }
        if (touching) p.text('x2', laneX(lane) + 85, g.line + (p.compact ? 40 : 29), p.compact ? 36 : 27, GOLD, 'center');
    }
    for (const ball of s.balls) {
        const awake = s.time >= ball.wakeAt;
        const companions = s.balls.filter(other => other.lane === ball.lane);
        const offset = companions.length > 1 ? (companions.indexOf(ball) ? 58 : -58) : 0;
        const x = laneX(ball.lane) + offset;
        // Position from the bottom edge: the rendered sprite touches the real line.
        const y = g.y(ball.y);
        if (!awake) {
            p.text('...', x, g.top + 30, 40, '#b7a2ef', 'center');
            continue;
        }
        drawJugglerSprite(p, ball.art, x, y, size, s.time + ball.id * .17, reducedMotion);
        if (ball.power) {
            p.rect(x + size * .2, y - size * .55, 50, 50, '#30235c', 3);
            p.outline(x + size * .2, y - size * .55, 50, 50, CYAN);
            drawJugglerSprite(p, ball.power, x + size * .2 + 25, y - size * .55 + 25, 48, s.time, reducedMotion);
        }
    }
    for (const burst of s.bursts) {
        const age = s.time - burst.at;
        const x = laneX(burst.lane), y = Math.max(g.top + 30, g.y(Math.min(burst.y, CONTACT_Y)) - 55) - (reducedMotion ? 0 : age * 23);
        const color = burst.kind === 'miss' ? '#ff9bb4' : burst.kind === 'gift' ? CYAN : GOLD;
        const label = burst.text;
        // Successful catches throw GIF-era sparkles from the line; misses stay plain.
        if (burst.kind !== 'miss') sparkleBurst(p, laneX(burst.lane), g.y(Math.min(burst.y, CONTACT_Y)), age, Math.round(burst.at * 100) + burst.lane,
            burst.kind === 'gift' ? [CYAN, '#ffffff'] : [GOLD, '#ffffff', CYAN], reducedMotion, 80);
        p.c.save(); p.c.globalAlpha = Math.min(1, (1 - age) * 3);
        const width = Math.max(115, label.length * (p.compact ? 21 : 17));
        p.rect(x - width / 2, y - 24, width, burst.detail ? 78 : 48, NAVY, 3);
        p.text(label, x, y, p.compact ? 38 : 30, color, 'center');
        if (burst.detail) p.text(burst.detail, x, y + 34, p.compact ? 29 : 22, color, 'center');
        p.c.restore();
    }
}
