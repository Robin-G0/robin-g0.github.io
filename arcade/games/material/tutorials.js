// Material teaching material: three SVG cards per engine, their captions and the Controls text.
// Cards are paper sheets on the theme palette (CSS variables), so light and dark appearance follow the room.
import { SHAPES, transform } from './tangram.js?v=eras-3';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (value, x, y, size = 18, weight = 400, cls = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}"${cls ? ` class="${cls}"` : ''}>${escape(value)}</text>`;
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art material-diagram" aria-hidden="true">${content}</svg>`;
const sheet = (x, y, w, h, cls = 'md-sheet') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="${cls}"/>`;
const SW = { teal: '#00897b', purple: '#673ab7', pink: '#d81b60', amber: '#ffa000', indigo: '#3f51b5', blue: '#0288d1', green: '#43a047', red: '#d32f2f', orange: '#f4511e' };
const fab = (x, y, r, label, delay = 0, size = 22) => `<g class="md-fab-group" style="--delay:${delay}s"><circle cx="${x}" cy="${y}" r="${r}" class="md-fab"/>${label ? text(label, x, y + size * .36, size, 500, 'md-on') : ''}</g>`;
const chip = (x, y, label, fill = 'var(--accent)', w = 40) => `<rect x="${x - w / 2}" y="${y - 12}" width="${w}" height="24" rx="12" class="md-chip" style="fill:${fill}"/>${text(label, x, y + 5, 13, 500, 'md-on')}`;
/** A circular arrow (turn icon) drawn as a path, so it never depends on a font's arrow glyphs. */
function curl(x, y, r, clockwise, cls) {
    const a0 = clockwise ? -2.7 : -.44, a1 = clockwise ? 1.1 : -4.24, sweep = clockwise ? 1 : 0;
    const p = a => [x + Math.cos(a) * r, y + Math.sin(a) * r].map(v => v.toFixed(1)).join(' ');
    const end = [x + Math.cos(a1) * r, y + Math.sin(a1) * r], t = a1 + (clockwise ? Math.PI / 2 : -Math.PI / 2), h = r * .55;
    const head = [[end[0] + Math.cos(t) * h, end[1] + Math.sin(t) * h], [end[0] + Math.cos(t + 2.3) * h, end[1] + Math.sin(t + 2.3) * h], [end[0] + Math.cos(t - 2.3) * h, end[1] + Math.sin(t - 2.3) * h]];
    return `<path d="M${p(a0)} A${r} ${r} 0 1 ${sweep} ${p(a1)}" class="${cls}"/><path d="M${head.map(v => v.map(n => n.toFixed(1)).join(' ')).join(' L')}Z" class="${cls}-head"/>`;
}
const flip = (x, y, r, cls) => `<path d="M${x - 3} ${y - r}V${y + r}H${x - r}Z" class="${cls}-head"/><path d="M${x + 3} ${y - r}V${y + r}H${x + r}Z" class="${cls}"/>`;
function piece(shape, turn, mirror, cx, cy, unit, cls = 'md-piece', dashed = false) {
    const pts = transform(SHAPES[shape].points, turn, mirror), xs = pts.map(v => v[0]), ys = pts.map(v => v[1]);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const d = 'M' + pts.map(([x, y]) => `${(cx + (x - ox) * unit).toFixed(1)} ${(cy + (y - oy) * unit).toFixed(1)}`).join(' L') + 'Z';
    return `<path d="${d}" class="${cls}"${dashed ? '' : ` style="fill:${SW[SHAPES[shape].color]}"`}/>`;
}
const cells = (x0, y, n, size, kinds = {}) => Array.from({ length: n }, (_, i) =>
    `<rect x="${x0 + i * size + 1}" y="${y}" width="${size - 2}" height="${size - 2}" rx="2" class="md-cell${kinds[i] ? ` md-${kinds[i]}` : ''}"/>`).join('');
const flag = (x, y) => `<circle cx="${x}" cy="${y}" r="5" class="md-hole"/><path d="M${x + 5} ${y}V${y - 30}" class="md-pole"/><path d="M${x + 5} ${y - 30}l16 6-16 6Z" style="fill:${SW.pink};stroke:none"/>`;
const card = (x, y, w, value, gold = false) => `<g><rect x="${x - w / 2}" y="${y - 10}" width="${w}" height="20" rx="2" class="md-card" style="fill:${gold ? SW.amber : [SW.teal, SW.teal, SW.indigo, SW.pink, SW.orange][value]}"/>${text(value, x - w / 2 + 10, y + 5, 13, 500, 'md-on')}${Array.from({ length: value }, (_, i) => `<circle cx="${x - w / 2 + 22 + i * 7}" cy="${y}" r="2" class="md-pip"/>`).join('')}${gold ? text('×2', x + w / 2 - 12, y + 4, 11, 500, 'md-on') : ''}</g>`;
const mobile = (tilt = 0, cls = '') => `<path d="M200 4V26" class="md-string"/><g transform="rotate(${tilt} 200 28)"><rect x="60" y="25" width="280" height="6" rx="3" class="md-beam ${cls}"/></g>`;
const trays = (y) => `<path d="M64 28 L50 ${y} M64 28 L118 ${y} M336 28 L282 ${y} M336 28 L350 ${y}" class="md-string"/>` + sheet(44, y, 80, 6) + sheet(276, y, 80, 6);

export const diagrams = {
    tangram: [
        frame(fab(80, 54, 30, '', 0) + curl(80, 54, 13, false, 'md-on-icon') + fab(200, 54, 30, '', .08) + flip(200, 54, 12, 'md-on-icon') + fab(320, 54, 30, '', .16) + curl(320, 54, 13, true, 'md-on-icon')
            + text('sweep ←', 80, 108, 18, 500) + text('turn left', 80, 127, 14) + text('raise ↑', 200, 108, 18, 500) + text('flip over', 200, 127, 14) + text('sweep →', 320, 108, 18, 500) + text('turn right', 320, 127, 14)
            + text('either wrist moves the piece', 200, 150, 13, 400, 'md-muted')),
        frame(sheet(28, 12, 150, 122) + piece('ell', 1, false, 103, 66, 22, 'md-outline', true)
            + `<rect x="44" y="122" width="118" height="4" rx="2" class="md-track"/><rect x="44" y="122" width="70" height="4" rx="2" class="md-bar"/>`
            + `<g class="md-tangram-turn">${piece('ell', 0, false, 300, 66, 22)}</g>`
            + text('it drops in when it matches', 200, 154, 15)),
        frame(text('+10', 50, 38, 30, 300) + text('fit', 50, 58, 14) + text('+10', 140, 38, 30, 300) + text('clean', 140, 58, 14) + text('fewest moves', 140, 74, 13, 400, 'md-muted')
            + text('×4', 228, 38, 30, 300) + text('combo', 228, 58, 14) + text('+1 every 4 fits', 228, 74, 13, 400, 'md-muted')
            + chip(318, 30, 'L', 'var(--accent)', 30) + chip(356, 30, 'R', 'var(--accent)', 30) + text('from 12 fits:', 337, 60, 13) + text('a piece per wrist', 337, 75, 13)
            + `<rect x="40" y="104" width="190" height="5" rx="2.5" class="md-track"/><rect x="40" y="104" width="40" height="5" rx="2.5" style="fill:${SW.red}"/>`
            + text('clock runs out = −1 ♥', 135, 132, 16, 500) + text('wrong turns are free', 318, 117, 14, 400, 'md-muted'))
    ],
    golf: [
        frame(sheet(20, 56, 360, 58) + cells(36, 64, 8, 41)
            + `<circle cx="56" cy="84" r="8" class="md-ball"/>`
            + `<path d="M58 74 Q78 40 97 66" class="md-arc"/><path d="M58 74 Q120 0 179 66" class="md-arc md-arc-r"/>`
            + chip(97, 36, 'L', 'var(--accent)', 30) + chip(179, 18, 'R', '#d81b60', 30)
            + text('L  chip: 1 cell', 110, 142, 17, 500) + text('R  drive: 3 cells', 290, 142, 17, 500)),
        frame(sheet(18, 36, 364, 76) + cells(40, 52, 7, 46, { 3: 'water', 6: 'cup' }) + flag(339, 75)
            + `<g class="md-golf-ball"><circle cx="63" cy="75" r="8" class="md-ball"/></g>`
            + chip(109, 20, 'L', 'var(--accent)', 30) + chip(201, 20, 'R ✕', SW.red, 42)
            + text('chips show where L and R land', 200, 134, 15) + text('stop exactly in the cup', 200, 154, 15, 500)),
        frame(text('+50', 54, 36, 30, 300) + text('par', 54, 56, 14) + text('+10 per par streak', 54, 72, 13, 400, 'md-muted') + text('+30', 150, 36, 30, 300) + text('one over', 150, 56, 14)
            + text('+10', 236, 36, 30, 300) + text('more', 236, 56, 14)
            + `<rect x="306" y="14" width="44" height="44" rx="2" class="md-cell"/><circle cx="328" cy="36" r="8" class="md-ring"/><circle cx="328" cy="36" r="15" class="md-ring"/>` + text('pad: +1 cell', 328, 74, 13)
            + `<rect x="34" y="92" width="40" height="40" rx="2" class="md-cell md-water"/>` + text('water or off the end:', 228, 106, 15) + text('+1 stroke, back to the tee', 228, 126, 15, 500)
            + text('holing out refills the clock', 200, 154, 13, 400, 'md-muted'))
    ],
    balance: [
        frame(mobile() + trays(100) + `<g class="md-fall">${card(200, 66, 64, 2)}</g>`
            + `<path d="M160 80 L118 92 M240 80 L282 92" class="md-arc"/>` + fab(84, 136, 17, 'L', 0, 15) + fab(316, 136, 17, 'R', .08, 15)
            + text('raise L or R to lay the card', 200, 140, 14)),
        frame(mobile() + trays(112) + `<g class="md-level">` + card(84, 100, 64, 2) + card(84, 78, 64, 1) + card(316, 100, 64, 3) + `</g>`
            + text('3 = 3: level', 200, 66, 20, 500) + text('clears for 5 × cards²', 200, 90, 15) + text('3 cards = 45 · 6 cards = 180', 200, 148, 14, 400, 'md-muted')),
        frame(mobile(12, 'md-danger')
            + `<rect x="80" y="84" width="240" height="4" rx="2" class="md-track"/><rect x="80" y="84" width="24" height="4" rx="2" style="fill:${SW.red}"/><rect x="296" y="84" width="24" height="4" rx="2" style="fill:${SW.red}"/><circle cx="300" cy="86" r="7" style="fill:${SW.red}"/>`
            + text('more than 4 apart, or a 6th card', 200, 112, 15, 500) + text('in one tray: it tips, −1 ♥', 200, 130, 15, 500)
            + card(76, 152, 60, 2, true) + text('gold doubles a level', 170, 156, 13) + text('idle cards drop low', 318, 156, 13, 400, 'md-muted'))
    ]
};
export const captions = {
    tangram: ['Sweep a wrist left or right to turn the piece a quarter turn. Raise it to flip the piece over.', 'Turn the loose piece until it matches the dashed outline; it drops in by itself. Mirrored outlines need a flip.', 'Each fit scores 10, plus 10 in the fewest moves, times your combo. From 12 fits each wrist owns a piece. A piece whose clock runs out costs a heart.'],
    golf: ['Raise L to chip the ball one cell. Raise R to drive it three.', 'The L and R chips show where each shot stops. Land exactly in the cup; a cross marks a shot into water or off the sheet.', 'Par scores 50 (more for a par streak), one over 30, otherwise 10. A lost shot costs a penalty stroke and goes back to the tee: look one shot ahead. Holing out refills the clock.'],
    balance: ['Each card falls down the middle. Raise L to lay it in the left tray, R for the right tray.', 'When both trays weigh the same, the mobile levels and clears: 5 × cards². Wait for a bigger level to score more.', 'More than 4 apart, or a sixth card in one tray, tips the mobile and costs a heart. Unplaced cards fall into the lower tray. Gold cards double a level.']
};
export const lessons = {
    tangram: ['Left wrist: sweep ← turns the piece counter-clockwise, sweep → clockwise, raise ↑ flips it over. From 12 fits it moves the left piece.',
        'Right wrist: the same three moves. Before 12 fits either wrist moves the single piece; from 12 fits the right wrist moves the right piece.',
        'Turn the piece until it matches the dashed outline; it drops in by itself. Mirrored outlines (from 5 fits) need a flip. A fit scores 10, plus 10 when you used the fewest moves, times a combo that grows every four fits. Wrong turns are harmless; a piece whose clock (the bar on its sheet) runs out costs a heart and the combo. Five-square shapes join at 24 fits.'],
    golf: ['Chip: the ball moves one cell.', 'Drive: the ball moves three cells.',
        'The L and R chips on the fairway show where each shot stops. The ball must stop exactly in the cup. A shot into water or past the end of the sheet costs a penalty stroke and sends the ball back to the tee, so look one shot ahead: some cells leave both shots lost. Ripple pads push it one cell on. Par (the fewest strokes) scores 50 plus 10 per par in a row, one over 30, otherwise 10. Holing out refills the clock; a timeout spends an attempt.'],
    balance: ['Lay the falling card in the left tray.', 'Lay the falling card in the right tray.',
        'When both trays weigh the same the mobile levels and clears for 5 × cards², so bigger levels pay far more. It tips, costing a heart and both trays, when the sides differ by more than 4 or a tray takes a sixth card. Unplaced cards fall into the lower tray. Heavier cards join at 3 and 8 levels; gold cards (from 14) double a level.']
};
