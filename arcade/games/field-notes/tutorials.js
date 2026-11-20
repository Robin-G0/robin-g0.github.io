// Field Notes teaching material: three SVG cards, their captions and the Controls text per engine.
// Cards are notebook sketches: Caveat notes, fountain-pen strokes drawn in, brass and stamps.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const note = (value, x, y, size = 22, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}"${cls ? ` class="${cls}"` : ''}>${escape(value)}</text>`;
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art field-notes-diagram" aria-hidden="true">${content}</svg>`;
const ink = (d, cls = '') => `<path d="${d}" class="fn-ink ${cls}"/>`;
const tag = (x, y, glyph) => `<circle cx="${x}" cy="${y}" r="13" class="fn-tag"/>${note(glyph, x, y + 6, 17, 'fn-tag-text')}`;
const starShape = (x, y, r = 6, cls = '') => `<path class="fn-star ${cls}" d="M${x} ${y - r}L${x + r * .3} ${y - r * .3}L${x + r} ${y}L${x + r * .3} ${y + r * .3}L${x} ${y + r}L${x - r * .3} ${y + r * .3}L${x - r} ${y}L${x - r * .3} ${y - r * .3}Z"/>`;
const jewel = (x, y, r = 7, cls = 'fn-jewel') => `<path class="${cls}" d="M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z"/>`;
const summit = (x, y, r = 10) => `<path class="fn-summit" d="M${x} ${y - r}L${x + r} ${y + r * .75}L${x - r} ${y + r * .75}Z"/>`;
const marsh = (x, y) => `<g class="fn-marsh"><rect x="${x - 14}" y="${y - 14}" width="28" height="28"/><path d="M${x - 8} ${y + 9}l-3-14M${x - 8} ${y + 9}l3-10M${x} ${y + 9}l-3-14M${x} ${y + 9}l3-10M${x + 8} ${y + 9}l-3-14M${x + 8} ${y + 9}l3-10M${x - 11} ${y + 9}h22"/></g>`;
const dots = (x0, y0, cols, rows, gap) => { let out = ''; for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) out += `<circle cx="${x0 + i * gap}" cy="${y0 + j * gap}" r="1.6" class="fn-dot"/>`; return out; };
// The pendulum: pivot (200,14), rod 116 long swinging +-40 degrees; brass pallets 24-48 degrees out at radius 132.
const pendulum = (swing = true) => `<path class="fn-arc" d="M125 103A116 116 0 0 0 275 103"/>`
    + `<path class="fn-pallet" d="M102 102A132 132 0 0 0 146 135"/><path class="fn-pallet" d="M298 102A132 132 0 0 1 254 135"/>`
    + `<g class="${swing ? 'fn-swing' : 'fn-still'}"><path class="fn-rod" d="M200 14V118"/><circle cx="200" cy="130" r="12" class="fn-bob"/></g><circle cx="200" cy="14" r="5" class="fn-bob"/>`;

export const diagrams = {
    clockwork: [
        frame(pendulum() + tag(78, 100, 'L') + tag(322, 100, 'R') + note('raise L ↑', 56, 150, 26) + note('raise R ↑', 344, 150, 26)),
        frame(pendulum(false) + jewel(285, 115, 10) + `<path class="fn-pencil" d="M318 62l-24 42"/>` + note('the turn', 340, 52, 26)
            + note('band +10', 66, 40, 26) + note('jewel +20', 66, 72, 26) + note('×2 push', 66, 102, 22, 'fn-muted')),
        frame(`<g class="fn-stamp"><rect x="14" y="18" width="112" height="40" class="fn-stamp-box"/>${note('CHIME', 70, 46, 22, 'fn-serif')}</g>` + note('12 in a row', 70, 86, 24) + note('+60, +1 life', 70, 110, 20, 'fn-muted')
            + jewel(200, 36, 12, 'fn-jewel fn-gold') + note('gold +50', 200, 86, 24) + note('from 12 ticks', 200, 110, 20, 'fn-muted')
            + `<path class="fn-pallet fn-grit" d="M300 36h60"/>` + note('×  ×  ×', 330, 43, 20) + note('grit: let it pass', 330, 86, 24) + note('from 36 ticks', 330, 110, 20, 'fn-muted')
            + note('swing too short: the clock stops, −1', 200, 148, 21))
    ],
    contour: [
        frame(dots(120, 26, 6, 3, 30) + ink('M210 116V60', 'fn-pencil-line') + `<path class="fn-pencil-tip" d="M210 50l-6 12h12z"/>` + `<path class="fn-pencil" d="M210 50V26" stroke-dasharray="4 5"/>`
            + note('↶ L', 156, 70, 34) + note('R ↷', 264, 70, 34) + note('turns at the next step', 200, 152, 24)),
        frame(dots(170, 20, 4, 4, 30) + summit(245, 65) + `<path class="fn-hatch" d="M230 50h30v30h-30z"/>` + ink('M200 140V50H260V80H230V50', 'fn-draw')
            + note('meet your', 86, 54, 26) + note('own line:', 86, 82, 26) + note('loop closed', 86, 116, 24, 'fn-muted')),
        frame(summit(28, 34) + note('25', 66, 42, 26) + summit(24, 76) + summit(46, 76) + note('100', 86, 84, 26) + summit(20, 118) + summit(40, 118) + summit(60, 118) + note('225', 98, 126, 26)
            + jewel(180, 36, 12, 'fn-jewel fn-gold') + note('trig = 2', 180, 80, 24) + marsh(272, 36) + note('marsh', 272, 80, 24) + note('inside: −1', 272, 104, 20, 'fn-muted')
            + `<path class="fn-pencil" d="M356 18v34"/><path class="fn-pencil-tip" d="M350 52l6 10 6-10z"/>` + note('edge −1', 356, 86, 22) + note('close loops soon: the line fades', 230, 148, 21))
    ],
    stars: [
        frame(starShape(200, 104, 10) + `<circle cx="200" cy="104" r="17" class="fn-ring"/>` + starShape(104, 118, 8) + starShape(296, 92, 8) + starShape(204, 34, 8)
            + `<path class="fn-pencil" d="M200 104L104 118M200 104L296 92M200 104L204 34" stroke-dasharray="3 6"/>`
            + tag(72, 118, '←') + tag(328, 92, '→') + tag(236, 30, '↑') + note('sweep ←', 72, 152, 26) + note('sweep →', 328, 132, 26) + note('raise ↑', 300, 30, 24) + note('either wrist', 66, 30, 22, 'fn-muted')),
        frame(`<g class="fn-show">${ink('M70 120L130 80L200 100L260 50L330 70', 'fn-draw')}</g>` + [[70, 120], [130, 80], [200, 100], [260, 50], [330, 70]].map(([x, y]) => starShape(x, y, 8)).join('')
            + note('watch, then retrace', 200, 152, 26)),
        frame(note('+10', 56, 42, 32) + note('per star', 56, 70, 22, 'fn-muted') + note('clean ×2', 180, 42, 30) + note('finish bonus', 180, 70, 22, 'fn-muted')
            + `<g class="fn-stamp"><rect x="262" y="18" width="126" height="42" class="fn-stamp-box"/>${note('CHARTED', 325, 46, 20, 'fn-serif')}</g>`
            + `<circle cx="56" cy="114" r="13" class="fn-blot"/><circle cx="68" cy="106" r="6" class="fn-blot"/><circle cx="46" cy="124" r="5" class="fn-blot"/>` + note('wrong: −1, shown again', 228, 120, 26))
    ]
};

export const captions = {
    clockwork: ['Raise L as the bob reaches the left pallet, R at the right one.', 'Any strike keeps it swinging. At the jewel: double points, twice the push.', '12 in a row chime: +60, a life back. A dying swing stops the clock.'],
    contour: ['Raise L or R: the pencil turns a quarter at its next step.', 'Meet your own line to close a loop around the summits.', 'More summits per loop score far more. Marsh inside or the edge: −1.'],
    stars: ['Sweep toward the next star. From figure 3, raise for a star above.', 'Watch the figure being inked, then retrace it from memory.', 'Clean figures score double. A wrong star costs −1 and replays it.']
};

export const lessons = {
    clockwork: ['Strike the left pallet while the bob is in its brass band.', 'Strike the right pallet while the bob is in its brass band.', 'The pendulum swings by itself and loses swing over time. A strike anywhere in the band scores 10 and pushes it; at the jewel (the turning point) it scores 20 and pushes twice as hard. Twelve strikes in a row chime for +60 and a life back. After 12 ticks some pallets carry a gold jewel worth +50 at the turn; after 36, grit pallets (crosses) must be let pass. Early raises are harmless. When the swing no longer reaches a pallet, the clock stops and costs a life.'],
    contour: ['Turn the pencil a quarter to its left at the next step.', 'Turn the pencil a quarter to its right at the next step.', 'The pencil walks one grid segment at a time by itself; the dashed segment shows its next step and your latest raise replaces a queued turn. Meeting your own line closes a loop: n summits inside score 25 × n × n, and a brass trig pillar counts as two. From the second survey, marshes appear: a loop around one costs an attempt. Walking off the sheet costs one too. Only the last 26 segments of line remain, so close loops soon.'],
    stars: ['Left wrist: sweep ← or → toward the next star; raise ↑ for the star above.', 'Right wrist: the same three moves. Use whichever wrist is comfortable.', 'Watch the figure being inked, then retrace it from memory. The circled stars are the candidates, tagged with the move that picks them. Each correct star scores 10; a finished figure adds 10 per link, doubled without mistakes, and the next figure has one more star. From the third figure a star above joins the choice. A wrong star costs an attempt and the figure is shown again.']
};
