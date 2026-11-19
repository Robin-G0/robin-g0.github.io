const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (value, x, y, size = 25, weight = 300, fill = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}"${fill ? ` style="fill:${fill}"` : ''}>${escape(value)}</text>`;
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art metro-diagram" aria-hidden="true">${content}</svg>`;
const BLUE = '#087aa5', PURPLE = '#7434a6', GREEN = '#347c62', ORANGE = '#d86924';
const tile = (x, y, w, h, color, glyph = '', size = 28, css = '', delay = 0) =>
    `<g class="${css}" style="--delay:${delay}s"><rect x="${x}" y="${y}" width="${w}" height="${h}" style="fill:${color};stroke:none"/>${glyph === '' ? '' : text(glyph, x + w / 2, y + h / 2 + size * .36, size, 300, '#fff')}</g>`;
const station = (x, y, letter, color) => `<circle cx="${x}" cy="${y}" r="22" style="fill:${color};stroke:none"/>${text(letter, x, y + 9, 26, 400, '#fff')}`;
const junction = active => `<path d="M200 165V95" style="stroke-width:7"/><path d="M200 95L110 45" style="stroke-width:7;stroke:${active === 0 ? BLUE : 'currentColor'};opacity:${active === 0 ? 1 : .35}"/><path d="M200 95L290 45" style="stroke-width:7;stroke:${active === 1 ? PURPLE : 'currentColor'};opacity:${active === 1 ? 1 : .35}"/>`;

export const metroDiagrams = {
    memory: [
        frame(tile(45, 22, 120, 120, BLUE, 'L', 52) + tile(235, 22, 120, 120, PURPLE, 'R', 52) + text('blue tile ↑', 105, 156, 21) + text('purple tile ↑', 295, 156, 21)),
        frame(tile(40, 30, 58, 58, BLUE, 'L', 24, 'metro-flash', 0) + tile(116, 30, 58, 58, PURPLE, 'R', 24, 'metro-flash', .5) + tile(192, 30, 58, 58, PURPLE, 'R', 24, 'metro-flash', 1)
            + text('watch', 145, 114, 21) + '<path d="M275 59h55m-12-10 12 10-12 10"/>' + text('LIVE ×2', 345, 114, 24, 400) + text('repeat after, or follow along', 200, 150, 22)),
        frame(text('+10', 70, 60, 42) + text('per tile', 70, 92, 19) + text('+20', 200, 60, 42) + text('live', 200, 92, 19) + text('+10 × tiles', 330, 60, 30) + text('finish', 330, 92, 19)
            + `<rect x="150" y="114" width="100" height="36" style="fill:${ORANGE};stroke:none"/>` + text('3 wrong = over', 200, 138, 17, 400, '#fff'))
    ],
    merge: [
        frame([2, 0, 2, 0, 0, 0, 0].map((value, i) => value ? tile(50 + i * 44, 48, 38, 48, BLUE, value, 22) : `<rect x="${50 + i * 44}" y="48" width="38" height="48" style="fill:none;stroke:currentColor;stroke-dasharray:3 4"/>`).join('')
            + '<rect x="8" y="57" width="30" height="30" style="fill:none;stroke:currentColor"/>' + text('2', 23, 79, 20) + '<rect x="362" y="57" width="30" height="30" style="fill:none;stroke:currentColor"/>' + text('2', 377, 79, 20)
            + text('L ←', 100, 122, 30) + text('→ R', 300, 122, 30) + text('next tile enters the other end', 200, 152, 19)),
        frame(tile(60, 20, 46, 46, BLUE, '2', 22) + tile(112, 20, 46, 46, BLUE, '2', 22) + tile(164, 20, 46, 46, PURPLE, '4', 22) + '<path d="M235 43h55m-12-10 12 10-12 10"/>' + text('L', 262, 28, 18, 400)
            + tile(300, 20, 46, 46, PURPLE, '4', 22) + tile(352, 20, 46, 46, PURPLE, '4', 22)
            + text('equal neighbours merge once', 200, 100, 21) + text('2 2 4 → 4 4, not 8', 200, 128, 21) + text('plan around the preview', 200, 153, 19)),
        frame(text('+ value', 80, 55, 30) + text('merged', 80, 85, 18) + text('×2', 200, 55, 42) + text('two merges', 200, 85, 18) + text('refills time', 320, 55, 26) + text('every merge', 320, 85, 18)
            + `<rect x="120" y="112" width="160" height="40" style="fill:${ORANGE};stroke:none"/>` + text('blocked row = −1 ■', 200, 138, 18, 400, '#fff'))
    ],
    rail: [
        frame(junction(0) + station(110, 45, 'A', BLUE) + station(290, 45, 'B', PURPLE) + text('L  switch', 70, 125, 24) + tile(180, 106, 40, 50, BLUE, 'A', 22, 'metro-train') + text('R  dispatch', 320, 125, 24)),
        frame(junction(1) + station(110, 45, 'A', BLUE) + station(290, 45, 'B', PURPLE) + tile(180, 100, 40, 50, PURPLE, 'B', 22, 'metro-train') + text('set the junction before the fork', 200, 152, 20)
            + text('letter = station', 300, 110, 18)),
        frame(text('+20', 75, 58, 42) + text('arrival', 75, 90, 19) + text('+10', 200, 58, 42) + text('convoy: same line, back to back', 200, 90, 15) + `<rect x="265" y="30" width="110" height="40" style="fill:${GREEN};stroke:none"/>` + text('4 slots', 320, 56, 22, 400, '#fff')
            + `<rect x="90" y="114" width="220" height="38" style="fill:${ORANGE};stroke:none"/>` + text('full platform or wrong station = −1 ■', 200, 138, 15, 400, '#fff'))
    ]
};
export const metroCaptions = {
    memory: ['Raise L for the blue tile, R for the purple tile.', 'Watch the order. Repeat it, or follow along live for ×2.', 'Each tile 10, live 20. Finishing adds 10 per tile. Three wrongs end the run.'],
    merge: ['Raise L to slide left, R to slide right. The preview enters the other end.', 'Equal neighbours merge once per slide. Plan around the next tile.', 'Merges score and refill time. Two merges double. A blocked row costs a heart.'],
    rail: ['Raise L to switch the junction. Raise R to dispatch the front train.', 'Set the junction before the train reaches the fork. Its letter is its station.', 'Arrivals score. Back-to-back same-line arrivals add a convoy bonus. Four waiting or a wrong station costs a heart.']
};
