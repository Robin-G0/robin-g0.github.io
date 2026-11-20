// Y2K Chrome teaching material: three SVG cards, their captions and the Controls text per engine.
// Colours come from the theme palette through CSS variables, so the cards follow light and dark mode.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// Headings (18 and up) use Orbitron; smaller labels use the narrower room font, enlarged for phones.
const text = (value, x, y, size = 18, weight = 700, fill = 'var(--ink)', anchor = 'middle') => size >= 18
    ? `<text class="y2k-display" x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" style="fill:${fill};stroke:none">${escape(value)}</text>`
    : `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${Math.max(16, Math.round(size * 1.35))}" font-weight="${Math.min(weight, 700)}" style="fill:${fill};stroke:none">${escape(value)}</text>`;
const DEFS = '<defs><linearGradient id="y2k-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#c9d3ea"/><stop offset=".48" stop-color="#8394b6"/><stop offset=".5" stop-color="#fff"/><stop offset=".53" stop-color="#657596"/><stop offset="1" stop-color="#dce3f1"/></linearGradient>'
    + '<radialGradient id="y2k-candy" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent)"/></radialGradient>'
    + '<radialGradient id="y2k-candy-gold" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--gold)"/></radialGradient></defs>';
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art y2k-diagram" aria-hidden="true">${DEFS}${content}</svg>`;
const plain = 'style="fill:none;stroke:var(--border);stroke-width:2"';
const star = (x, y, r, fill, points = 8, inner = .45, css = '') => {
    let d = '';
    for (let i = 0; i < points * 2; i++) { const a = i * Math.PI / points - Math.PI / 2, rr = i % 2 ? r * inner : r; d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`; }
    return `<path class="${css}" d="${d}Z" style="fill:${fill};stroke:none"/>`;
};
const arcPath = (cx, cy, r, from, to) => {
    const p = a => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    return `M${p(from)}A${r} ${r} 0 0 1 ${p(to)}`;
};
const candy = (x, y, r, gold = false) => `<circle cx="${x}" cy="${y}" r="${r}" style="fill:url(#${gold ? 'y2k-candy-gold' : 'y2k-candy'});stroke:none"/>`;
const chip = (x, y, letter) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" style="fill:var(--bg);stroke:var(--border);stroke-width:2"/>` + text(letter, x.toFixed(1), (y + 5).toFixed(1), 13, 900);
const comet = (x, y) => `<path d="M${x} ${y - 9}l8 4 1 9-7 6-9-2-3-9z" style="fill:url(#y2k-chrome);stroke:var(--ink);stroke-width:1.5"/>`;
/** The orbit scene: planet, ring and a shield centred on `angle` (radians) whose end chips read L and R. */
const orbit = (cx, cy, r, angle, css = '') => {
    const span = .46, a0 = angle - span, a1 = angle + span, end = a => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const [lx, ly] = end(a0 - .25), [rx, ry] = end(a1 + .25);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" ${plain}/>` + candy(cx, cy, r * .42)
        + `<ellipse cx="${cx}" cy="${cy}" rx="${r * .74}" ry="${r * .18}" transform="rotate(-14 ${cx} ${cy})" style="fill:none;stroke:url(#y2k-chrome);stroke-width:4"/>`
        + `<g class="${css}" style="transform-origin:${cx}px ${cy}px"><path d="${arcPath(cx, cy, r, a0, a1)}" style="fill:none;stroke:var(--ink);stroke-width:15;stroke-linecap:round"/><path d="${arcPath(cx, cy, r, a0, a1)}" style="fill:none;stroke:url(#y2k-chrome);stroke-width:10;stroke-linecap:round"/>${chip(lx, ly, 'L')}${chip(rx, ry, 'R')}</g>`;
};
const pill = (x, y, w, h, fill) => `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="${(h + 4) / 2}" style="fill:url(#y2k-chrome);stroke:none"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" style="fill:${fill};stroke:none"/>`;
const arrow = (x, y, dir, size = 9, color = 'var(--bg)') => {
    const r = dir === 'up' ? 0 : dir === 'left' ? -90 : 90;
    return `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 ${size}V${-size}M${-size * .8} ${-size * .15}L0 ${-size}L${size * .8} ${-size * .15}" style="fill:none;stroke:${color};stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round"/>`;
};
const tap = (x, y, gold = false, css = '') => `<g class="${css}">${pill(x - 28, y - 13, 56, 26, gold ? 'var(--gold)' : 'var(--accent)')}${arrow(x, y, 'up')}</g>`;
const disc = (x, y, dir, gold = false, css = '') => `<g class="${css}"><circle cx="${x}" cy="${y}" r="17" style="fill:url(#y2k-chrome);stroke:none"/><circle cx="${x}" cy="${y}" r="14" style="fill:${gold ? 'var(--gold)' : 'var(--accent)'};stroke:none"/>${arrow(x, y, dir, 8)}</g>`;
const zigzag = (x, y) => `<path d="M${x - 26} ${y + 8}l7-16 7 16 6-16 7 16 6-16 7 16" style="fill:none;stroke:var(--muted);stroke-width:3"/><path d="M${x - 7} ${y - 7}l14 14m0-14-14 14" style="stroke:var(--ink);stroke-width:3"/>`;
const core = (x, top, h, level, gold = false, extra = '') => {
    const fill = gold ? 'var(--gold)' : 'var(--accent)', y = top + h - 6 - (h - 12) * level / 10;
    return `<rect x="${x - 25}" y="${top - 3}" width="50" height="${h + 6}" rx="25" style="fill:url(#y2k-chrome);stroke:none"/><rect x="${x - 22}" y="${top}" width="44" height="${h}" rx="22" style="fill:var(--bg);stroke:none"/>`
        + `<rect x="${x - 18}" y="${y}" width="36" height="${top + h - 6 - y}" rx="12" style="fill:${fill};opacity:.75;stroke:none"/>` + extra
        + `<path d="M${x - 20} ${top + 9}H${x + 20}" style="stroke:var(--ink);stroke-width:2;stroke-dasharray:5 3"/>`;
};
const orb = (x, y, r, value, css = '') => `<g class="${css}">${candy(x, y, r)}${text(value, x, (y + r * .38).toFixed(1), Math.round(r * 1.05), 900, 'var(--bg)')}</g>`;

export const diagrams = {
    orbital: [
        frame(orbit(200, 86, 58, -Math.PI / 2, 'y2k-turn') + `<path d="M118 40a64 64 0 0 0-22 40" style="fill:none;stroke:var(--accent);stroke-width:4"/><path d="M90 70l6 12 8-10" style="fill:none;stroke:var(--accent);stroke-width:4"/>`
            + `<path d="M282 40a64 64 0 0 1 22 40" style="fill:none;stroke:var(--gold);stroke-width:4"/><path d="M310 70l-6 12-8-10" style="fill:none;stroke:var(--gold);stroke-width:4"/>`
            + text('L ↑', 66, 118, 22, 900) + text('turn ↺', 66, 140, 14, 700, 'var(--muted)') + text('R ↑', 334, 118, 22, 900) + text('turn ↻', 334, 140, 14, 700, 'var(--muted)')),
        frame(orbit(120, 84, 56, -Math.PI / 6, 'y2k-meet') + `<path d="M176 52L250 12" style="stroke:var(--border);stroke-width:2;stroke-dasharray:4 5"/>`
            + `<g class="y2k-incoming">${comet(236, 22)}</g>` + text('each comet flies', 300, 76, 15, 700) + text('down its sector line', 300, 96, 15, 700) + text('meet it with the shield', 300, 128, 15, 900, 'var(--accent)')),
        frame(comet(44, 40) + text('+10 × streak', 120, 42, 16, 900) + text('up to ×4', 120, 62, 12, 700, 'var(--muted)')
            + star(232, 40, 15, 'var(--accent)', 4, .35) + text('STAR +30', 310, 42, 15, 900) + text('20 s · optional', 310, 62, 12, 700, 'var(--muted)')
            + star(44, 112, 17, 'var(--gold)', 12, .6) + candy(44, 112, 9, true) + text('FLARE', 120, 108, 16, 900, 'var(--gold)') + text('45 s · never touch', 120, 128, 12, 700, 'var(--muted)')
            + candy(232, 112, 16) + text('planet hit', 310, 108, 15, 900) + text('= −1 life', 310, 128, 15, 900, 'var(--gold)'))
    ],
    beat: [
        frame(text('L wrist', 100, 22, 15, 900) + text('R wrist', 300, 22, 15, 900)
            + tap(100, 52) + text('raise = tap', 100, 82, 12, 700, 'var(--muted)') + disc(62, 114, 'left') + disc(138, 114, 'right') + text('sweep = scratch', 100, 152, 12, 700, 'var(--muted)')
            + tap(300, 52, true) + text('raise = tap', 300, 82, 12, 700, 'var(--muted)') + disc(262, 114, 'left', true) + disc(338, 114, 'right', true) + text('sweep = scratch', 300, 152, 12, 700, 'var(--muted)')),
        frame(`<rect x="50" y="6" width="110" height="148" rx="14" style="fill:var(--accent);opacity:.14;stroke:none"/><rect x="240" y="6" width="110" height="148" rx="14" style="fill:var(--gold);opacity:.14;stroke:none"/>`
            + pill(58, 112, 94, 22, 'var(--soft)') + pill(248, 112, 94, 22, 'var(--soft)') + '<path d="M62 123H148M252 123H338" style="stroke:var(--ink);stroke-width:2"/>'
            + tap(105, 30, false, 'y2k-fall') + disc(295, 30, 'right', true, 'y2k-fall y2k-later')
            + text('play it as it', 200, 60, 12, 700) + text('touches the line', 200, 78, 12, 700) + text('PERFECT', 200, 104, 15, 900, 'var(--accent)')),
        frame(text('GOOD 10 · PERFECT 25', 104, 26, 14, 900) + text('× streak, up to ×4', 104, 46, 12, 700, 'var(--muted)')
            + pill(236, 12, 140, 22, 'var(--accent)') + text('L+R', 306, 28, 13, 900, 'var(--bg)') + text('15 s · chord pays ×2', 306, 52, 12, 700, 'var(--muted)')
            + zigzag(50, 96) + text('50 s · static', 150, 92, 14, 900) + text('leave it alone', 150, 110, 12, 700, 'var(--muted)')
            + text('stray move', 306, 92, 14, 900) + text('= streak lost', 306, 110, 12, 700, 'var(--muted)')
            + text('a miss or touched static = −1 life', 200, 146, 14, 900, 'var(--gold)'))
    ],
    reactor: [
        frame(core(70, 52, 96, 4) + core(330, 52, 96, 6, true) + '<path d="M176 34H70V50M224 34H330V50" style="fill:none;stroke:url(#y2k-chrome);stroke-width:9"/>'
            + '<circle cx="200" cy="34" r="27" style="fill:url(#y2k-chrome);stroke:none"/>' + orb(200, 34, 21, 3, 'y2k-pulse')
            + text('L ↑', 140, 82, 22, 900) + text('left core', 140, 100, 12, 700, 'var(--muted)') + text('R ↑', 260, 82, 22, 900) + text('right core', 260, 100, 12, 700, 'var(--muted)')
            + text('L+R together = vent', 200, 140, 14, 900, 'var(--accent)')),
        frame(core(90, 34, 118, 7, false, `<g class="y2k-fuse">${star(90, 43, 26, 'var(--accent)', 8, .45)}</g>`) + orb(90, 18, 15, 3, 'y2k-drop')
            + text('7 + 3 = 10', 240, 44, 20, 900) + text('FUSION', 240, 68, 18, 900, 'var(--accent)') + text('core empties · +1 vent', 240, 88, 12, 700, 'var(--muted)')
            + text('above 10 = MELTDOWN', 240, 122, 15, 900, 'var(--gold)') + text('dashed mark = where it lands', 240, 142, 11, 700, 'var(--muted)')),
        frame(text('FUSION 100 × streak', 105, 28, 15, 900) + text('up to ×4', 105, 46, 12, 700, 'var(--muted)')
            + star(282, 30, 18, 'var(--gold)', 10, .7) + candy(282, 30, 11) + text('SPARK ×2', 348, 30, 13, 900) + text('60 s', 348, 47, 11, 700, 'var(--muted)')
            + '<circle cx="46" cy="100" r="17" style="fill:url(#y2k-chrome);stroke:none"/><circle cx="46" cy="100" r="13" style="fill:var(--soft);stroke:none"/>' + text('−3', 46, 105, 13, 900)
            + text('30 s · coolant, 4s', 140, 96, 13, 900) + text('5 fusions = +1 life', 140, 114, 12, 700, 'var(--muted)')
            + text('fuse ring out', 318, 96, 14, 900) + text('= SPILL', 318, 114, 13, 900, 'var(--gold)')
            + text('spill or meltdown = −1 life', 200, 148, 14, 900, 'var(--gold)'))
    ]
};

export const captions = {
    orbital: ['Raise L to turn the shield ↺, R to turn it ↻, one sector each.', 'Comets fly down the sector lines. The ring lights where one will land: be there.', 'Streaks multiply. Stars are a bonus; flares must miss the shield.'],
    beat: ['Each wrist owns a lane. Raise to tap; sweep sideways to scratch.', 'Play the note’s move as it reaches the line. On the line: PERFECT.', 'Streaks multiply. Chords need both wrists; leave static alone.'],
    reactor: ['Raise L or R to pour the orb into that core. Both together: vent.', 'Exactly 10 fuses the core. Above 10 melts it down.', 'Fusions in a row multiply. An orb left too long spills.']
};

export const lessons = {
    orbital: ['Turn the chrome shield one sector anticlockwise.', 'Turn the chrome shield one sector clockwise.',
        'Comets fly in along six sector lines on a visible schedule, and the ring brightens where the next one will arrive. The shield breaks every comet that reaches its sector: 10 points times a streak level (×2 after 6, ×3 after 12, ×4 after 18). Every 15 breaks in a row restore a life. Consecutive comets are always reachable at one turn per second. From 20 s, star shards (four-point stars) are optional pickups worth 30 × level. From 45 s, solar flares (rayed suns) arrive between comets: they are harmless unless they meet the shield, which costs a life. A comet reaching the planet costs a life and resets the streak.'],
    beat: ['Left wrist plays the left lane: raise to tap ↑, sweep left or right to scratch ← or →.', 'Right wrist plays the right lane: raise to tap ↑, sweep left or right to scratch ← or →.',
        'Play each note with the move it shows as it reaches the pad: within 0.4 s is GOOD (10), touching the line within 0.15 s is PERFECT (25). The streak multiplier rises every 8 notes, up to ×4, and every 16 in a row restore a life. A stray or wrong move only breaks the streak. Chords (L+R bar, from 15 s) need both raises and pay double. Scratch discs arrive from 30 s. Static zig-zags (from 50 s) must be left alone: touching one costs a life, as does a missed note.'],
    reactor: ['Pour the orb in the chute into the left core.', 'Pour it into the right core. Raise both together to vent it.',
        'A core that reaches exactly 10 fuses: it scores 100 times your fusion streak (up to ×4), empties and earns a vent charge (up to 3). Above 10 it melts down: a life lost and the streak reset. The dashed mark on each core shows where the current orb would land; the number under a core is what it still needs. Raising both wrists together vents the orb for one charge. Each orb has a fuse ring: if it runs out the orb spills and costs a life. From 30 s big 4s and coolant (−3) arrive, from 60 s 5s and spark orbs that double a fusion. Every 5 fusions restore a life.']
};
