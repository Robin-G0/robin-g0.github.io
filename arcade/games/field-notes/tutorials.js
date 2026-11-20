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
// The pendulum: pivot, rod and bob (swinging unless reduced motion), brass pallet arcs on each side.
const pendulum = (swing = true) => `<path class="fn-arc" d="M86 112A120 120 0 0 0 314 112"/>`
    + `<path class="fn-pallet" d="M76 88A132 132 0 0 0 112 128"/><path class="fn-pallet" d="M324 88A132 132 0 0 1 288 128"/>`
    + `<g class="${swing ? 'fn-swing' : 'fn-still'}"><path class="fn-rod" d="M200 14V122"/><circle cx="200" cy="130" r="12" class="fn-bob"/></g><circle cx="200" cy="14" r="5" class="fn-bob"/>`;

export const diagrams = {
    clockwork: [
        frame(pendulum() + tag(52, 72, 'L') + tag(348, 72, 'R') + note('raise L ↑ here', 64, 152, 19) + note('raise R ↑ here', 336, 152, 19)),
        frame(pendulum(false) + jewel(312, 112, 9) + note('jewel at the turn', 318, 60, 19) + `<path class="fn-pencil" d="M318 68l-4 28"/>`
            + note('in the band +10', 96, 40, 20) + note('at the jewel +20', 96, 64, 20) + note('and twice the push', 96, 86, 17, 'fn-muted')),
        frame(note('12 in a row', 70, 30, 21) + note('chime +60, a life back', 70, 50, 15, 'fn-muted') + `<g class="fn-stamp"><rect x="22" y="62" width="96" height="32" class="fn-stamp-box"/>${note('CHIME', 70, 85, 18, 'fn-serif')}</g>`
            + jewel(200, 38, 10, 'fn-jewel fn-gold') + note('gold +50', 200, 72, 20) + note('after 12 ticks', 200, 92, 15, 'fn-muted')
            + `<path class="fn-pallet fn-grit" d="M302 34h56"/>` + note('× × ×', 330, 40, 17) + note('grit: let it pass', 330, 72, 19) + note('after 36 ticks', 330, 92, 15, 'fn-muted')
            + note('a swing too short for the pallets stops the clock: −1 life', 200, 140, 17))
    ],
    contour: [
        frame(dots(120, 26, 6, 3, 30) + ink('M210 116V60', 'fn-pencil-line') + `<path class="fn-pencil-tip" d="M210 50l-6 12h12z"/>` + `<path class="fn-pencil" d="M210 50V26" stroke-dasharray="4 5"/>`
            + note('↶ L', 158, 66, 28) + note('R ↷', 262, 66, 28) + note('raise L or R: the pencil turns at its next step', 200, 152, 17)),
        frame(dots(170, 20, 4, 4, 30) + summit(245, 65) + `<path class="fn-hatch" d="M230 50h30v30h-30z"/>` + ink('M200 140V50H260V80H230V50', 'fn-draw')
            + note('meet your own line:', 92, 50, 18) + note('the loop closes', 92, 72, 18) + note('summits inside', 92, 104, 17, 'fn-muted') + note('are surveyed', 92, 124, 17, 'fn-muted')),
        frame(summit(30, 34) + note('25', 70, 41, 20) + summit(30, 70) + summit(52, 70) + note('100', 86, 77, 20) + summit(24, 106) + summit(44, 106) + summit(64, 106) + note('225', 98, 113, 20)
            + jewel(175, 38, 10, 'fn-jewel fn-gold') + note('trig counts two', 175, 74, 17) + marsh(268, 38) + note('inside: −1', 268, 76, 18)
            + `<path class="fn-pencil" d="M352 18v40"/><path class="fn-pencil-tip" d="M346 58l6 10 6-10z"/>` + note('edge: −1', 352, 86, 18) + note('the line fades after 26 segments: close loops soon', 200, 140, 16))
    ],
    stars: [
        frame(starShape(200, 110, 9) + `<circle cx="200" cy="110" r="15" class="fn-ring"/>` + starShape(110, 120, 7) + starShape(290, 92, 7) + starShape(206, 44, 7)
            + `<path class="fn-pencil" d="M200 110L110 120M200 110L290 92M200 110L206 44" stroke-dasharray="3 6"/>`
            + tag(80, 120, '←') + tag(320, 92, '→') + tag(206, 20, '↑') + note('sweep toward it', 80, 152, 17) + note('either wrist', 320, 124, 16, 'fn-muted') + note('raise: star above', 300, 30, 16) + note('(from figure 3)', 300, 46, 14, 'fn-muted')),
        frame(`<g class="fn-show">${ink('M70 120L130 80L200 100L260 50L330 70', 'fn-draw')}</g>` + [[70, 120], [130, 80], [200, 100], [260, 50], [330, 70]].map(([x, y]) => starShape(x, y, 7)).join('')
            + note('watch it inked, then retrace from memory', 200, 150, 19)),
        frame(note('+10', 60, 40, 26) + note('each star', 60, 62, 16, 'fn-muted') + note('+10 × links', 175, 40, 24) + note('finish, clean ×2', 175, 62, 16, 'fn-muted')
            + `<g class="fn-stamp"><rect x="268" y="18" width="116" height="38" class="fn-stamp-box"/>${note('CHARTED', 326, 44, 18, 'fn-serif')}</g>`
            + `<circle cx="70" cy="110" r="12" class="fn-blot"/><circle cx="80" cy="104" r="6" class="fn-blot"/>` + note('wrong star: −1, shown again', 225, 108, 19) + note('every figure adds one star', 200, 146, 17, 'fn-muted'))
    ]
};

export const captions = {
    clockwork: ['The pendulum swings by itself. Raise L as the bob reaches the left pallet, R at the right one.', 'Any strike in the band keeps it swinging. Wait for the jewel at the turn: double points and twice the push.', 'Twelve strikes in a row chime: +60 and a life back. Later come gold jewels (+50) and grit to let pass. If the swing dies, the clock stops.'],
    contour: ['The pencil walks by itself. Raise L or R to turn it a quarter at its next step; the dashed line shows where it goes.', 'Meet your own line to close a loop. Every summit inside is surveyed.', 'More summits in one loop score far more. Keep marshes out of the loop and the pencil on the sheet; each costs an attempt.'],
    stars: ['Sweep a wrist left or right toward the next star. From the third figure, raise a wrist for the star above.', 'Each figure is inked stroke by stroke, then fades. Retrace it from memory, star by star.', 'Each star scores; a finished figure adds a bonus, doubled without mistakes. A wrong star costs an attempt and the figure is shown again.']
};

export const lessons = {
    clockwork: ['Strike the left pallet while the bob is in its brass band.', 'Strike the right pallet while the bob is in its brass band.', 'The pendulum swings by itself and loses swing over time. A strike anywhere in the band scores 10 and pushes it; at the jewel (the turning point) it scores 20 and pushes twice as hard. Twelve strikes in a row chime for +60 and a life back. After 12 ticks some pallets carry a gold jewel worth +50 at the turn; after 36, grit pallets (crosses) must be let pass. Early raises are harmless. When the swing no longer reaches a pallet, the clock stops and costs a life.'],
    contour: ['Turn the pencil a quarter to its left at the next step.', 'Turn the pencil a quarter to its right at the next step.', 'The pencil walks one grid segment at a time by itself; the dashed segment shows its next step and your latest raise replaces a queued turn. Meeting your own line closes a loop: n summits inside score 25 × n × n, and a brass trig pillar counts as two. From the second survey, marshes appear: a loop around one costs an attempt. Walking off the sheet costs one too. Only the last 26 segments of line remain, so close loops soon.'],
    stars: ['Left wrist: sweep ← or → toward the next star; raise ↑ for the star above.', 'Right wrist: the same three moves. Use whichever wrist is comfortable.', 'Watch the figure being inked, then retrace it from memory. The circled stars are the candidates, tagged with the move that picks them. Each correct star scores 10; a finished figure adds 10 per link, doubled without mistakes, and the next figure has one more star. From the third figure a star above joins the choice. A wrong star costs an attempt and the figure is shown again.']
};
