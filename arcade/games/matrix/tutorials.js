// Matrix / Construct teaching material: three SVG cards, their captions and the Controls text per engine.
// Cards are drawn in palette colours through CSS (accent strokes, ink text, gold for danger) and animate
// with a few steps-based, terminal-like keyframes in arcade/themes/matrix.css; reduced motion stills them.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (value, x, y, size = 22, css = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}"${css ? ` class="${css}"` : ''}>${escape(value)}</text>`;
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art matrix-diagram" aria-hidden="true">${content}</svg>`;
const chevron = (x, y, move, size = 14, css = '') => {
    if (move === 'up') return `<path class="${css}" d="M${x - size} ${y + size * .45}L${x} ${y - size * .55}L${x + size} ${y + size * .45}"/>`;
    const d = move === 'left' ? -1 : 1;
    return `<path class="${css}" d="M${x - d * size * .5 - 5} ${y - size}L${x + d * size * .5 - 5} ${y}L${x - d * size * .5 - 5} ${y + size}M${x - d * size * .5 + 5} ${y - size}L${x + d * size * .5 + 5} ${y}L${x - d * size * .5 + 5} ${y + size}"/>`;
};
const block = (x, y, move, css = '', size = 30) => `<g class="${css}"><rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"/>${chevron(x, y, move, size * .3)}</g>`;
const agent = (x, y) => `<path class="mx-soft" d="M${x - 24} ${y + 44}L${x - 17} ${y + 14}H${x + 17}L${x + 24} ${y + 44}Z"/><circle cx="${x}" cy="${y}" r="11" class="mx-soft"/><rect x="${x - 9}" y="${y - 4}" width="8" height="4" class="mx-fill"/><rect x="${x + 1}" y="${y - 4}" width="8" height="4" class="mx-fill"/>`;
const coat = (x, y) => `<path class="mx-soft" d="M${x - 26} ${y + 40}L${x - 18} ${y}H${x + 18}L${x + 26} ${y + 40}Z"/><circle cx="${x}" cy="${y - 10}" r="9" class="mx-fill"/>`;
const bit = (x, y, value, css = '', w = 30, h = 38) => `<g class="${css}"><rect x="${x}" y="${y}" width="${w}" height="${h}" class="${value ? 'mx-fill' : ''}"/>${text(value, x + w / 2, y + h / 2 + 8, 22, value ? 'mx-on' : '')}</g>`;
const row = (x, y, bits, css = '') => bits.map((value, i) => bit(x + i * 38, y, value, css)).join('');
const runner = (x, y, css = '') => `<g class="${css}"><circle cx="${x}" cy="${y - 10}" r="7" class="mx-fill"/><path class="mx-soft" d="M${x - 7} ${y - 2}H${x + 7}L${x + 11} ${y + 16}H${x - 11}Z"/></g>`;
const shaft = (left = 120, right = 280) => `<path d="M${left} 10V150M${right} 10V150" style="stroke-width:3"/>` + [0, 1, 2, 3].map(i => `<path class="mx-dim" d="M${left} ${20 + i * 38}h8M${right - 8} ${20 + i * 38}h8"/>`).join('');

export const diagrams = {
    parry: [
        frame(coat(200, 104) + `<path d="M182 108L130 92M218 108L270 92" style="stroke-width:5"/>`
            + `<g class="matrix-sweep-l">${chevron(98, 92, 'left', 13)}</g>${chevron(130, 64, 'up', 13)}<g class="matrix-sweep-r">${chevron(162, 92, 'right', 13)}</g>`
            + `<g class="matrix-sweep-l">${chevron(238, 92, 'left', 13)}</g>${chevron(270, 64, 'up', 13)}<g class="matrix-sweep-r">${chevron(302, 92, 'right', 13)}</g>`
            + text('L', 130, 150, 26) + text('R', 270, 150, 26)),
        frame(agent(200, 22) + `<path class="mx-dim" d="M188 60L120 110" style="stroke-dasharray:3 6"/><path d="M120 110L92 130" style="stroke-width:9"/>`
            + `<circle cx="88" cy="134" r="12"/>` + block(150, 88, 'up', 'matrix-strike')
            + `<path class="mx-dim" d="M212 60L290 120" style="stroke-dasharray:3 6"/>` + block(254, 92, 'right', 'matrix-blink') + text('guard zone', 52, 104, 17) + text('blink: next strike', 300, 146, 17)),
        frame(text('+10 → +30', 70, 40, 22) + text('in the zone', 70, 62, 17) + text('PARRY +50', 200, 40, 24, 'mx-gold-text') + text('at contact', 200, 62, 17)
            + `<g class="mx-gold">${block(330, 34, 'up', '', 34)}</g>` + text('both ↑ ×2', 330, 72, 17)
            + [0, 1, 2, 3, 4, 5].map(i => `<rect x="${34 + i * 18}" y="96" width="14" height="14" class="mx-fill${i === 5 ? ' matrix-blink' : ''}"/>`).join('')
            + text('6 in a row:', 86, 130, 17) + text('bullet time', 86, 148, 17) + text('sweeps 20s · heavy 60s', 290, 104, 17) + text('landed strike: −1 life', 290, 136, 17, 'mx-gold-text'))
    ],
    binary: [
        frame(text('L', 36, 48, 26) + row(66, 22, [1, 0, 1, 1]) + `<path d="M81 64q0 12 14 12h108q14 0 14-12" class="matrix-wrap" style="fill:none"/><path d="M211 68l6-6 6 6"/>` + text('rotate', 300, 48, 20)
            + text('R', 36, 132, 26) + bit(66, 104, 0, 'matrix-flip') + `<rect x="66" y="146" width="30" height="6" class="mx-fill matrix-blink"/>` + row(104, 104, [1, 1, 0]) + text('flip the head', 300, 132, 20)),
        frame(text('KEY', 40, 38, 17) + row(66, 14, [0, 1, 1, 0]) + text('x', 81, 70, 18, 'mx-gold-text') + text('|', 119, 70, 18) + text('x', 157, 70, 18, 'mx-gold-text') + text('|', 195, 70, 18)
            + `<g class="mx-gold">${bit(66, 80, 1)}</g>` + bit(104, 80, 1) + `<g class="mx-gold">${bit(142, 80, 0)}</g>` + bit(180, 80, 0)
            + `<rect x="66" y="124" width="30" height="6" class="mx-fill matrix-blink"/>` + text('par 3', 300, 60, 26) + text('shortest solution', 300, 86, 17) + text('x = still different', 300, 130, 17)),
        frame(text('20 × par', 70, 44, 24) + text('per lock', 70, 66, 17) + text('in par ×2', 200, 44, 24, 'mx-gold-text') + text('3 in a row: +1 try', 200, 66, 17)
            + `<rect x="316" y="20" width="30" height="38"/><path class="mx-dim" d="M316 34l14-14M316 50l30-30M330 58l16-16"/>` + text('sealed:', 331, 76, 17) + text('no flip', 331, 94, 17)
            + text('the clock refills on each unlock', 200, 116, 17) + text('a lock left open costs an attempt', 200, 140, 17, 'mx-gold-text'))
    ],
    gravity: [
        frame(shaft() + runner(136, 112, 'matrix-cross') + text('L', 56, 70, 30) + text('left wall', 56, 98, 17) + text('R', 344, 70, 30) + text('right wall', 344, 98, 17)
            + `<path class="mx-dim" d="M190 80l-8 8 8 8M210 80l8 8-8 8"/>`),
        frame(shaft(40, 200) + `<rect x="40" y="34" width="96" height="16" class="mx-soft"/><path class="mx-dim" d="M50 50l14-16M70 50l14-16M90 50l14-16M110 50l14-16"/>`
            + `<path class="mx-gold" d="M70 86H170" style="stroke-dasharray:8 5;stroke-width:4"/>` + runner(182, 128)
            + text('ledge:', 300, 38, 17) + text('be on the other wall', 300, 56, 17) + text('beam:', 300, 92, 17, 'mx-gold-text') + text('never switch through', 300, 110, 17)),
        frame(`<rect x="34" y="26" width="26" height="26"/>` + text('1', 47, 46, 20) + text('+10 ×chain', 130, 44, 20) + text('up to ×5', 130, 64, 17)
            + [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${236 + i * 18}" y="30" width="14" height="14" class="mx-fill${i === 7 ? ' matrix-blink' : ''}"/>`).join('')
            + text('8 pickups: hardline', 300, 66, 17) + text('+100 and a life', 300, 84, 17)
            + text('a missed pickup resets the chain', 200, 118, 17) + text('a ledge or beam hit: −1 life', 200, 142, 17, 'mx-gold-text'))
    ]
};

export const captions = {
    parry: ['Each wrist guards its own side. ↑ blocks; ← or → sweeps a strike aside.',
        'Answer the arrow inside the solid guard zone. The later, the more points.',
        'A parry at contact scores 50. Sweeps, heavy strikes (both ↑) and flurries join over time.'],
    binary: ['Raise L to rotate the register left. Raise R to flip the bit at the cursor.',
        'Make every cell match the KEY. Par is the fewest moves that open the lock.',
        '20 points per par move, ×2 in par. Sealed cells never flip. Unlocks refill time.'],
    gravity: ['Raise L to fall to the left wall, R to fall to the right wall.',
        'Ledges: be on the other wall. Beams: never be mid-switch as one passes.',
        'Pickups chain up to ×5. Every eighth opens a hardline: +100 and a life.']
};

export const lessons = {
    parry: ['Left wrist guards the left side: ↑ blocks, ← sweeps out, → sweeps in.',
        'Right wrist guards the right side: ↑ blocks, → sweeps out, ← sweeps in.',
        'Answer the arrow while the strike is in the solid guard zone: 10 at its edge up to 30, a parry at contact 50. One move answers every matching strike on that side. Heavy double-chevron strikes need both wrists up within 1.2 s and score double. Outward sweeps arrive at 20 s, inward at 40 s, heavy strikes at 60 s, flurries at 85 s. Six answers in a row start four seconds of bullet time. Wrong moves are harmless; a strike that lands costs a life.'],
    binary: ['Rotate the register one cell left; the first bit wraps to the end.',
        'Flip the bit under the cursor at the head. A sealed (hatched) cell cannot be flipped.',
        'Make the register equal the KEY. Each lock is built with an exact par: 20 points per par move, doubled when solved in par, and three clean locks in a row restore an attempt. The clock refills on every unlock; a lock left open costs an attempt and loads a new one. Five bits from lock 4, a sealed cell from lock 7, six bits from lock 11.'],
    gravity: ['Fall to the left wall.', 'Fall to the right wall.',
        'Ledges jut from one wall, so be on the other as they pass. Beams cross the middle from 30 s: switch before or after, never through one. Code on a wall scores 10 times your chain (up to ×5); a missed pickup resets the chain. Far-wall code appears from 15 s. Every eighth pickup opens a hardline for 100 points and a life. Raising the wall you are on is harmless.']
};
