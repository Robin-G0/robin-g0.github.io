const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (value, x, y, size = 25, weight = 300, fill = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}"${fill ? ` style="fill:${fill}"` : ''}>${escape(value)}</text>`;
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art metro-diagram" aria-hidden="true">${content}</svg>`;
const BLUE = '#087aa5', PURPLE = '#7434a6', GREEN = '#347c62', ORANGE = '#d86924';
const tile = (x, y, w, h, color, glyph = '', size = 28, css = '', delay = 0, style = '') =>
    `<g class="${css}" style="--delay:${delay}s;${style}"><rect x="${x}" y="${y}" width="${w}" height="${h}" style="fill:${color};stroke:none"/>${glyph === '' ? '' : text(glyph, x + w / 2, y + h / 2 + size * .36, size, 300, '#fff')}</g>`;
const station = (x, y, letter, color, r = 22) => `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${color};stroke:none"/>${text(letter, x, y + 9, 26, 400, '#fff')}`;
const cells = () => { let out = ''; for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) out += `<rect x="${118 + c * 34}" y="${104 - r * 34}" width="30" height="30" style="fill:none;stroke:currentColor;opacity:.35"/>`; return out; };
const network = () => `<path d="M200 130V96" style="stroke-width:6"/><path d="M200 96L110 66" style="stroke-width:6;opacity:.35"/><path d="M200 96L290 66" style="stroke-width:6;stroke:${PURPLE}"/><path d="M110 66L80 34" style="stroke-width:6;opacity:.35"/><path d="M290 66L250 34" style="stroke-width:6;stroke:${PURPLE}"/><path d="M290 66L330 34" style="stroke-width:6;opacity:.35"/><circle cx="200" cy="96" r="7" style="fill:currentColor;stroke:none"/><circle cx="290" cy="66" r="6" style="fill:currentColor;stroke:none"/>` + text('1', 218, 101, 14, 400) + text('2', 308, 71, 14, 400) + station(80, 30, 'A', BLUE) + station(250, 30, 'B', PURPLE) + station(330, 30, 'C', GREEN) + tile(187, 108, 26, 30, PURPLE, 'B', 14, 'metro-train');
const board = () => `<path d="M60 148H340" style="stroke-width:2;opacity:.5"/><path d="M78 128V150" style="stroke-width:3"/>` + tile(96, 124, 22, 22, GREEN, 'C', 12) + tile(166, 124, 22, 22, BLUE, 'A', 12) + tile(256, 124, 22, 22, PURPLE, 'B', 12) + text('now', 78, 160, 11) + text('departures', 335, 136, 12);
const junction = (active, trunk = 165) => `<path d="M200 ${trunk}V95" style="stroke-width:7"/><path d="M200 95L110 45" style="stroke-width:7;stroke:${active === 0 ? BLUE : 'currentColor'};opacity:${active === 0 ? 1 : .35}"/><path d="M200 95L290 45" style="stroke-width:7;stroke:${active === 1 ? PURPLE : 'currentColor'};opacity:${active === 1 ? 1 : .35}"/>`;

export const metroDiagrams = {
    memory: [
        frame(tile(45, 22, 120, 120, BLUE, 'L', 52) + tile(235, 22, 120, 120, PURPLE, 'R', 52) + text('raise ↑', 105, 156, 21) + text('raise ↑', 295, 156, 21)),
        frame(tile(40, 30, 58, 58, BLUE, 'L', 24, 'metro-flash', 0) + tile(116, 30, 58, 58, PURPLE, 'R', 24, 'metro-flash', .5) + tile(192, 30, 58, 58, PURPLE, 'R', 24, 'metro-flash', 1)
            + text('watch', 145, 114, 21) + '<path d="M275 59h55m-12-10 12 10-12 10"/>' + text('LIVE ×2', 345, 114, 24, 400) + text('repeat after, or follow along', 200, 150, 22)),
        frame(text('+10', 70, 60, 42) + text('per tile', 70, 92, 19) + text('+20', 200, 60, 42) + text('live', 200, 92, 19) + text('+10 × tiles', 330, 60, 30) + text('finish', 330, 92, 19)
            + `<rect x="125" y="114" width="150" height="36" style="fill:${ORANGE};stroke:none"/>` + text('3 wrong = over', 200, 138, 17, 400, '#fff'))
    ],
    merge: [
        // Card 1: the waiting tile slides across the columns; nothing drops yet.
        frame(cells() + tile(152, 104, 30, 30, BLUE, '2', 16) + tile(220, 104, 30, 30, PURPLE, '4', 16) + tile(186, 2, 30, 30, PURPLE, '4', 16, 'metro-slide') + text('L ←', 60, 70, 30) + text('→ R', 340, 70, 30) + text('both ↑ = drop now', 200, 152, 20)),
        // Card 2: a 2 lands on a 2 (→ 4), which then touches the 4 beside it (→ 8): a two-step chain. Results stay hidden until their keyframe.
        frame(cells() + tile(118, 104, 30, 30, GREEN, '8', 16) + tile(186, 104, 30, 30, BLUE, '2', 16, 'metro-base') + tile(220, 104, 30, 30, PURPLE, '4', 16, 'metro-side')
            + tile(186, 2, 30, 30, BLUE, '2', 16, 'metro-fall') + tile(186, 104, 30, 30, PURPLE, '4', 16, 'metro-result-a', 0, 'opacity:0') + tile(186, 104, 30, 30, GREEN, '8', 16, 'metro-result-b', 0, 'opacity:0')
            + text('2 on 2 → 4 · touches 4 → 8 · chain ×2', 200, 152, 16)),
        frame(text('10 × power', 65, 52, 24) + text('4 → 20 · 8 → 30', 65, 76, 13) + text('× chain step', 65, 96, 15) + text('128 × min', 200, 52, 26) + text('small tiles clear', 200, 82, 16) + `<rect x="292" y="28" width="96" height="64" style="fill:${ORANGE};stroke:none"/>` + text('full column', 340, 54, 15, 400, '#fff') + text('= over', 340, 80, 18, 400, '#fff')
            + text('2 tiles ×2 · 3 tiles ×4 · 4 tiles ×8', 200, 118, 15) + text('the bar is the deadline · each move adds .2 s', 200, 143, 16))
    ],
    rail: [
        frame(network() + text('L  junction 1', 70, 150, 19) + text('R  junction 2', 330, 150, 19) + text('(open branch)', 330, 165, 12)),
        frame(text('trains leave when they reach now', 200, 30, 20) + `<path d="M40 92H360" style="stroke-width:2;opacity:.5"/><path d="M70 60V108" style="stroke-width:4"/>` + tile(90, 66, 40, 40, GREEN, 'C', 20) + tile(180, 66, 40, 40, BLUE, 'A', 20) + tile(300, 66, 40, 40, PURPLE, 'B', 20) + text('now', 70, 124, 14) + text('1s', 110, 124, 13) + text('4s', 200, 124, 13) + text('7s', 320, 124, 13) + text('set junctions 1 then 2 before each train reaches them', 200, 154, 15)),
        frame(text('+20', 65, 52, 40) + text('arrival', 65, 84, 17) + text('+10', 180, 52, 40) + text('convoy', 180, 84, 17) + text('same station, back to back', 180, 102, 12) + `<rect x="275" y="30" width="105" height="40" style="fill:${GREEN};stroke:none"/>` + text('40 s · 90 s', 327, 56, 18, 400, '#fff') + text('new stations', 327, 88, 13)
            + `<rect x="90" y="114" width="220" height="38" style="fill:${ORANGE};stroke:none"/>` + text('wrong station = −1 ■', 200, 139, 16, 400, '#fff'))
    ]
};
export const metroCaptions = {
    memory: ['Raise L for the blue tile, R for the purple tile.', 'Slots fill as tiles flash. Repeat them in order, or follow along live for ×2.', 'Each tile 10, live 20. Finishing adds 10 per tile. Three wrongs end the run.'],
    merge: ['Raise L or R to move the waiting tile; each move buys .2 s. Both together drop it now.', 'It falls when its bar runs out and joins every equal tile it touches, ×2 per tile. Anything that then touches keeps merging as a chain.', 'A merge scores 10 per power of two, times its chain step. At 128 × the smallest tile, the small ones clear. One life: a full column ends the run.'],
    rail: ['Raise L to switch junction 1. Raise R to switch junction 2 on the open branch.', 'Trains leave on time from the board. Set the junctions before each train reaches them.', 'Arrivals score; convoys add more. New stations open at 40 s and 90 s. A wrong station costs a heart.']
};
