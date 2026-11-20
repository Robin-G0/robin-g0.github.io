// Aqua teaching material: three SVG cards, their captions and the Controls text per engine.
// Cards use the same gel, brushed-metal and pinstripe materials as the canvas; CSS in themes/aqua.css
// animates them with era motions (default-button throb, Dock bounce and magnification, gel growth)
// and freezes them for reduced motion.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (value, x, y, size = 16, weight = 400, cls = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}"${cls ? ` class="${cls}"` : ''}>${escape(value)}</text>`;
const TONES = { blue: ['#1d5ea8', '#a9d8ff', '#2f87dc', '#7fd0ff'], clear: ['#8ea4b8', '#ffffff', '#e4edf5', '#ffffff'],
    red: ['#a2342a', '#ffc2b4', '#e0503c', '#ff9c86'], yellow: ['#a07d1c', '#fff4b8', '#e8b52e', '#ffe48a'],
    green: ['#3d7f2e', '#d4f8bf', '#5cae46', '#b3ec92'], graphite: ['#59636e', '#e6ebf0', '#8d98a4', '#d0d8e0'],
    purple: ['#5b3a8c', '#e4d2ff', '#8d62c8', '#c9a9f5'], orange: ['#a4521a', '#ffd9b0', '#e8822e', '#ffc07e'] };
const defs = () => `<defs>${Object.entries(TONES).map(([tone, [, top, mid, bottom]]) =>
    `<linearGradient id="aqg-${tone}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".5" stop-color="${mid}"/><stop offset=".52" stop-color="${mid}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`).join('')}`
    + '<linearGradient id="aqg-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f6"/><stop offset=".45" stop-color="#d4d8dc"/><stop offset="1" stop-color="#b7bec5"/></linearGradient>'
    + '<linearGradient id="aqg-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient>'
    + '<radialGradient id="aqg-marble" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#a9d8ff"/><stop offset=".45" stop-color="#2f87dc"/><stop offset=".85" stop-color="#1d5ea8"/><stop offset="1" stop-color="#7fd0ff"/></radialGradient></defs>';
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art aqua-diagram" aria-hidden="true">${defs()}${content}</svg>`;
/** A lickable gel capsule (or rounded tile) with its specular cap. */
const gel = (x, y, w, h, tone = 'blue', cls = '', label = '', size = h * .5, ink = '', rx = Math.min(w, h) / 2) =>
    `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#aqg-${tone})" stroke="${TONES[tone][0]}" stroke-width="1.2"/>`
    + `<rect x="${x + h * .14}" y="${y + h * .07}" width="${Math.max(0, w - h * .28)}" height="${h * .42}" rx="${Math.min(rx, h * .2)}" fill="url(#aqg-gloss)" stroke="none"/>`
    + (label ? `<text x="${x + w / 2}" y="${y + h / 2 + size * .36}" text-anchor="middle" font-size="${size}" font-weight="700" style="fill:${ink || '#fff'};stroke:none">${escape(label)}</text>` : '') + '</g>';
const metal = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#aqg-metal)" stroke="#8b949c" stroke-width="1"/>`;
const marble = (x, y, r, cls = '') => `<g class="${cls}"><circle cx="${x}" cy="${y}" r="${r}" fill="url(#aqg-marble)" stroke="none"/><ellipse cx="${x - r * .25}" cy="${y - r * .45}" rx="${r * .45}" ry="${r * .28}" fill="#fff" fill-opacity=".8" stroke="none"/></g>`;
const GLYPH = {
    close: (x, y, k) => `M${x - k} ${y - k}L${x + k} ${y + k}M${x + k} ${y - k}L${x - k} ${y + k}`,
    minimise: (x, y, k) => `M${x - k} ${y}H${x + k}`,
    zoom: (x, y, k) => `M${x - k} ${y}H${x + k}M${x} ${y - k}V${y + k}`,
    plain: (x, y, k) => `M${x} ${y - k}V${y + k * .7}M${x - k * .6} ${y + k * .1}L${x} ${y + k * .7}L${x + k * .6} ${y + k * .1}`
};
/** A gate is a traffic-light button: blue ↓ plain, green + zoom, yellow − minimise, red × close. */
const gate = (x, y, r, kind) => {
    const tone = { close: 'red', minimise: 'yellow', zoom: 'green', plain: 'blue' }[kind];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#aqg-${tone})" stroke="${TONES[tone][0]}" stroke-width="1"/>`
        + `<path d="${GLYPH[kind](x, y, r * .42)}" style="stroke:${TONES[tone][0]};fill:none" stroke-width="${r * .25}" stroke-linecap="round"/>`;
};
/** A raised-wrist arrow with its L / R letter. */
const raise = (x, y, letter) => `<path d="M${x} ${y + 26}V${y + 4}M${x - 9} ${y + 12}L${x} ${y}L${x + 9} ${y + 12}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + text(letter, x, y + 46, 18, 700);
const sweep = (x, y, letter, direction) => `<path d="M${x} ${y}h${direction * 34}m${-direction * 10} -9l${direction * 10} 9l${-direction * 10} 9" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + text(letter, x - direction * 12, y + 6, 16, 700);
const icon = (x, y, s, tone, cls = '') => gel(x, y, s, s, tone, cls, '', 0, '', s * .22);
const progressBar = (x, y, w, h, f, tone = 'blue') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" class="aqua-track"/>` + gel(x, y, w * f, h, tone);

export const diagrams = {
    marble: [
        // Card 1: two raises tilt the tray; the marble rolls that way.
        frame(raise(48, 26, 'L') + raise(352, 26, 'R')
            + `<g class="aqua-tilt">${metal(100, 98, 200, 12)}${marble(200, 86, 12, 'aqua-roll')}</g>`
            + text('tilt ←', 48, 112, 15) + text('tilt →', 352, 112, 15) + text('the marble rolls the way you tilt', 200, 148, 14)),
        // Card 2: it drops through the FIRST gate on that side; shelves rise toward the striped ceiling.
        frame('<rect x="20" y="6" width="360" height="10" rx="5" class="aqua-ceiling"/>' + text('shelves rise toward the striped ceiling', 200, 34, 12, 400, 'aqua-muted')
            + metal(30, 64, 70, 10) + metal(130, 64, 130, 10) + metal(300, 64, 70, 10) + gate(115, 69, 10, 'plain') + gate(280, 69, 10, 'close')
            + metal(30, 116, 160, 10) + metal(220, 116, 150, 10) + gate(205, 121, 10, 'zoom')
            + marble(170, 52, 11, 'aqua-run')
            + text('it drops through the first gate it meets', 200, 150, 14)),
        // Card 3: what each gate does, and the streak.
        frame(gate(40, 34, 15, 'plain') + text('+10', 40, 72, 17, 700) + gate(135, 34, 15, 'zoom') + text('+30', 135, 72, 17, 700) + text('from 15 s', 135, 89, 11, 400, 'aqua-muted')
            + gate(230, 34, 15, 'minimise') + text('2 shelves', 230, 72, 14, 700) + text('from 60 s', 230, 89, 11, 400, 'aqua-muted')
            + gate(330, 34, 15, 'close') + text('−1 life', 330, 72, 15, 700) + text('from 35 s', 330, 89, 11, 400, 'aqua-muted')
            + gel(60, 108, 280, 32, 'blue', 'aqua-pulse', '5 drops in a row: ×2 … up to ×4', 14))
    ],
    gel: [
        // Card 1: L fills the leftmost empty slot, R the rightmost.
        frame('<rect x="70" y="8" width="260" height="62" rx="6" class="aqua-sheet"/><rect x="92" y="25" width="86" height="28" rx="14" class="aqua-slot"/><rect x="220" y="25" width="90" height="28" rx="14" class="aqua-slot"/>'
            + text('S', 135, 44, 14, 700, 'aqua-muted') + text('L', 265, 44, 14, 700, 'aqua-muted')
            + raise(40, 84, 'L') + raise(360, 84, 'R') + '<path d="M58 100Q110 96 132 60M342 100Q290 96 266 60" stroke-dasharray="4 4" fill="none" class="aqua-accent-line"/>'
            + text('L stamps the left slot, R the right one', 200, 148, 14)),
        // Card 2: the button grows; stamp as its edges cross the marks. Every stamp starts a new button.
        frame(metal(70, 18, 260, 10) + '<path d="M118 40V112M282 40V112" stroke-width="3" class="aqua-accent-line"/>' + text('L · M', 118, 126, 13, 700, 'aqua-accent') + text('L · M', 282, 126, 13, 700, 'aqua-accent')
            + `<g class="aqua-grow">${gel(80, 56, 240, 40, 'blue')}</g>`
            + text('stamp when the edges reach the marks', 200, 152, 14)),
        // Card 3: points and the clock.
        frame(gel(22, 14, 104, 34, 'clear', '', 'fits +20', 15, '#25455f') + gel(148, 14, 104, 34, 'blue', 'aqua-pulse', 'exact +40', 15)
            + '<rect x="274" y="14" width="104" height="34" rx="17" class="aqua-slot"/>' + text('miss: 0', 326, 36, 15, 700, 'aqua-muted')
            + text('clean sheet +20, then +30, +40 …', 200, 76, 15, 700) + text('1, then 2, then 3 slots per sheet', 200, 98, 13)
            + progressBar(70, 114, 260, 14, .6) + text('ship a sheet to refill the clock', 200, 150, 13))
    ],
    dock: [
        // Card 1: six moves. Sweeps glide the pointer; the two raises are the two verbs.
        frame(sweep(80, 34, 'L', -1) + sweep(80, 70, 'R', -1) + text('glide ←', 64, 104, 14) + sweep(320, 34, 'L', 1) + sweep(320, 70, 'R', 1) + text('glide →', 336, 104, 14)
            + raise(172, 14, 'L') + raise(228, 14, 'R') + text('open', 172, 94, 13, 700, 'aqua-accent') + text('quit', 228, 94, 13, 700, 'aqua-accent')
            + text('either wrist sweeps · L opens · R force-quits', 200, 146, 14)),
        // Card 2: icons near the pointer magnify; a bouncing app wants opening; a spinning disc means hung.
        frame('<rect x="40" y="108" width="320" height="30" rx="10" class="aqua-dock"/>'
            + icon(56, 96, 30, 'blue') + icon(92, 86, 40, 'purple', 'aqua-magnify') + icon(138, 74, 52, 'orange', 'aqua-magnify')
            + icon(196, 86, 40, 'green', 'aqua-magnify') + icon(244, 96, 30, 'red', 'aqua-bounce') + icon(282, 96, 30, 'graphite') + icon(320, 96, 30, 'blue')
            + '<g class="aqua-spin" style="transform-origin:306px 116px"><path d="M306 116L315 116A9 9 0 0 1 310.5 123.8Z" fill="#e8463a"/><path d="M306 116L310.5 123.8A9 9 0 0 1 301.5 123.8Z" fill="#f39a2b"/><path d="M306 116L301.5 123.8A9 9 0 0 1 297 116Z" fill="#f5d63a"/><path d="M306 116L297 116A9 9 0 0 1 301.5 108.2Z" fill="#5cb84a"/><path d="M306 116L301.5 108.2A9 9 0 0 1 310.5 108.2Z" fill="#3b8ee0"/><path d="M306 116L310.5 108.2A9 9 0 0 1 315 116Z" fill="#8e5cd0"/></g>'
            + '<path d="M158 154l6 -8l6 8z" class="aqua-ink"/>' + text('bouncing: L ↑', 262, 40, 13, 700) + text('spinning: R ↑', 340, 62, 12, 700)
            + '<rect x="126" y="40" width="76" height="22" rx="11" class="aqua-tag"/>' + text('Photos', 164, 56, 13, 700, 'aqua-tag-text')),
        // Card 3: the fuse, the points, lives and the stages.
        frame(icon(30, 18, 40, 'blue', 'aqua-bounce') + progressBar(26, 66, 48, 9, .45, 'red') + text('bar = time left', 50, 94, 12)
            + text('open 20 · quit 30', 230, 30, 16, 700) + text('+ up to 20 for speed', 230, 52, 13) + text('urgent ! ×2', 230, 74, 15, 700, 'aqua-accent')
            + text('miss = −1 life · ♥ back every 8', 230, 102, 14) + text('two apps 20 s · hung apps 40 s · urgent 70 s', 200, 142, 13, 400, 'aqua-muted'))
    ]
};

export const captions = {
    marble: ['Raise L to tilt the tray left, R to tilt it right. The marble rolls that way.', 'It drops through the first gate it meets on that side. Shelves rise; don’t let yours reach the striped ceiling.', 'Blue gates +10, green + gates +30, yellow − gates drop two shelves. Red × gates cost a life. Five drops in a row raise the multiplier, up to ×4.'],
    gel: ['Raise L to stamp the growing gel button into the leftmost empty slot, R into the rightmost.', 'The button grows wider. Stamp when its edges reach the slot’s marks. Every stamp, good or not, starts a new button, so plan the order.', 'Close fits 20, exact fits 40, a clean sheet adds a growing bonus. A miss scores nothing. Ship sheets to refill the clock; sheets grow from one to three slots.'],
    dock: ['Sweep either wrist sideways to glide one icon along the Dock. Raise L to open, raise R to force quit.', 'Glide to a bouncing app and raise L to open it. An app with the spinning disc is hung: raise R to quit it.', 'Faster answers score more, urgent ! apps double. A request that runs out costs a life; every eighth answer gives one back. More apps, hangs and urgency arrive at 20, 40 and 70 s.']
};

export const lessons = {
    marble: ['Raise L to tilt left: the marble rolls left into the first gate on that side.', 'Raise R to tilt right: it rolls right into the first gate on that side.',
        'Blue gates score 10, green + gates 30 (from 15 s), yellow − gates drop two shelves (from 60 s); red × gates cost a life (from 35 s). Five drops in a row raise the multiplier up to ×4. A shelf that reaches the striped ceiling crushes the marble. With nothing below, the marble rests on the floor until a shelf lifts it.'],
    gel: ['Raise L to stamp the growing button into the leftmost empty slot.', 'Raise R to stamp it into the rightmost empty slot.',
        'Stamp as the button’s edges cross the marks for that slot: close fits 20, exact fits 40. A clean sheet adds 20, then 30, 40… for clean sheets in a row. A miss scores nothing and loses the clean bonus. Every stamp starts a new button; an over-grown one pops. Sheets have one slot, then two from the third sheet, sometimes three from the eighth.'],
    dock: ['Sweep left or right with either wrist to glide one icon. Raise L to open the bouncing app under the pointer.', 'Raise R to force-quit a hung app (spinning disc) under the pointer.',
        'Answer before the bar under the icon empties: open 20, quit 30, plus up to 20 for speed; urgent ! apps score ×2. A wrong verb only breaks your streak; a request that runs out costs a life, and every eighth answer restores one. Two apps at once from 20 s, hung apps from 40 s, urgent apps and three at once from 70 s.']
};
