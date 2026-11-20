// Glass teaching material: three SVG cards per engine (acrylic panels, spectrum rays, light), their captions
// and the Controls panel text. Cards describe the engines' real rules; animations live in themes/glass.css.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (value, x, y, size = 20, weight = 400, fill = '', anchor = 'middle') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}"${fill ? ` style="fill:${fill}"` : ''}>${escape(value)}</text>`;
const frame = content => `<svg viewBox="0 0 400 160" class="guide-art glass-diagram" aria-hidden="true">${content}</svg>`;
const ROSE = '#ff8fb4', MINT = '#74f0c4', SKY = '#8cc8ff', GOLD = '#f3d392', DANGER = '#ff9d8a', ICE = '#bff4ff', VIOLET = '#c9a4ff', INK = '#f0f2ff', MUTED = '#b4bfdc';
const panel = (x, y, w, h, r = 18) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" style="fill:rgba(214,226,255,.10);stroke:rgba(240,244,255,.4);stroke-width:1"/>`;
const ray = (x1, y1, x2, y2, color) => `<path d="M${x1} ${y1}L${x2} ${y2}" style="stroke:${color};stroke-width:10;opacity:.25;fill:none"/><path d="M${x1} ${y1}L${x2} ${y2}" style="stroke:${color};stroke-width:3;fill:none"/>`;
const hexPath = (x, y, r) => [...Array(6)].map((_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${i ? 'L' : 'M'}${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`; }).join('') + 'Z';
const glyph = (kind, x, y, r, color) => kind === 'triangle' ? `<path d="M${x} ${y - r}L${x + r * .92} ${y + r * .62}L${x - r * .92} ${y + r * .62}Z" style="fill:${color};stroke:none"/>`
    : kind === 'square' ? `<rect x="${x - r * .78}" y="${y - r * .78}" width="${r * 1.56}" height="${r * 1.56}" rx="${r * .2}" style="fill:${color};stroke:none"/>`
        : `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${color};stroke:none"/>`;
const crystal = (x, y, color, kind, css = '', r = 17) => `<g class="${css}" style="transform-origin:${x}px ${y}px"><path d="${hexPath(x, y, r)}" style="fill:rgba(14,20,48,.55);stroke:${color};stroke-width:2.5"/>${glyph(kind, x, y, r * .42, color)}</g>`;
const shard = (x, y, r = 16) => `<path d="M${x} ${y - r}L${x + r * .55} ${y - r * .2}L${x + r * .9} ${y + r * .35}L${x + r * .15} ${y + r * .95}L${x - r * .6} ${y + r * .6}L${x - r * .85} ${y - r * .15}Z" style="fill:#0b0e1c;stroke:${DANGER};stroke-width:2"/>` + text('!', x, y + 6, 15, 700, DANGER);
const prism = (x, y, r = 20) => `<path d="M${x} ${y - r}L${x + r * .9} ${y + r * .6}L${x - r * .9} ${y + r * .6}Z" style="fill:rgba(232,240,255,.22);stroke:#fff;stroke-width:2"/>`;
const hand = (x, y, label) => panel(x - 26, y - 26, 52, 52, 26) + text(label, x, y + 8, 24, 600, INK);
const jelly = (x, y) => `<path d="M${x - 16} ${y}Q${x} ${y - 26} ${x + 16} ${y}Z" style="fill:rgba(191,244,255,.55);stroke:${ICE};stroke-width:1.5"/>${[-9, -3, 3, 9].map(d => `<path d="M${x + d} ${y}q3 9 0 18" style="stroke:${ICE};stroke-width:1.5;fill:none;opacity:.8"/>`).join('')}`;
const ring = (cx, cy, r, bright = false) => `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:none;stroke:${bright ? '#b2bfff' : 'rgba(219,230,255,.35)'};stroke-width:${bright ? 2.5 : 1.5}"/>`;
const probe = (x, y) => `<rect x="${x - 9}" y="${y - 6}" width="18" height="12" rx="6" style="fill:#eef4ff;stroke:#b2bfff;stroke-width:2"/>`;
const beacon = (x, y, color = ICE) => `<path d="${hexPath(x, y, 11)}" style="fill:rgba(14,20,48,.6);stroke:${color};stroke-width:2"/><path d="${hexPath(x, y, 5)}" style="fill:${color};stroke:none"/>`;
const planet = (cx, cy, r = 20) => `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:#2b5a8f;stroke:rgba(143,200,255,.7);stroke-width:2"/>`;

export const diagrams = {
    prisms: [
        // Card 1: two raises turn the prism one spoke each way; the three rays turn with it.
        frame(hand(55, 66, 'L') + text('turn left', 55, 120, 18, 400, INK) + hand(345, 66, 'R') + text('turn right', 345, 120, 18, 400, INK)
            + `<g class="glass-spin" style="transform-origin:200px 80px">${ray(200, 80, 200, 26, ROSE)}${ray(200, 80, 238, 42, MINT)}${ray(200, 80, 254, 80, SKY)}${glyph('triangle', 200, 44, 6, ROSE)}${glyph('square', 226, 54, 6, MINT)}${glyph('circle', 240, 80, 6, SKY)}${prism(200, 82)}</g>`
            + text('↺', 112, 78, 34, 300, INK) + text('↻', 288, 78, 34, 300, INK) + text('one spoke per raise', 200, 150, 16, 400, MUTED)),
        // Card 2: a crystal lights when the ray of its own colour points at it; two at once score ×4.
        frame(ray(110, 92, 110, 30, ROSE) + ray(110, 92, 154, 48, MINT) + ray(110, 92, 172, 92, SKY) + prism(110, 94)
            + crystal(110, 24, ROSE, 'triangle', 'glass-lit') + crystal(178, 92, SKY, 'circle', 'glass-lit') + crystal(52, 48, MINT, 'square')
            + text('its own colour lights it', 110, 146, 15, 400, MUTED)
            + panel(232, 30, 156, 90) + text('2 at once', 310, 62, 20, 400, INK) + text('10 × 2² = 40', 310, 96, 22, 600, GOLD)),
        // Card 3: par and PERFECT, dark glass, attempts and the clock.
        frame(panel(10, 10, 182, 66) + text('par 3 · turns 3', 101, 36, 16, 400, MUTED) + text('PERFECT +40', 101, 62, 20, 600, GOLD)
            + panel(208, 10, 182, 66) + shard(236, 42) + text('any ray', 314, 36, 16, 400, MUTED) + text('cracks it: −1', 314, 62, 18, 600, DANGER)
            + text('2 → 3 → 4 crystals · dark glass from set 4', 200, 100, 15, 400, INK)
            + `<rect x="60" y="116" width="280" height="10" rx="5" style="fill:rgba(240,242,255,.16);stroke:none"/><rect class="glass-clock" x="60" y="116" width="280" height="10" rx="5" style="fill:#b2bfff;stroke:none"/>`
            + text('each crystal renews the clock · time up −1', 200, 150, 14, 400, MUTED))
    ],
    abyss: [
        // Card 1: six moves, either hand: sweep sideways to swim a lane, raise to pulse.
        frame(panel(8, 8, 384, 144, 22) + `<path d="M120 22V112M200 22V112M280 22V112" style="stroke:rgba(214,226,255,.2);stroke-width:1"/>`
            + `<g class="glass-swim">${jelly(160, 64)}</g><circle class="glass-pulse" cx="160" cy="66" r="24" style="fill:none;stroke:${ICE};stroke-width:2"/>`
            + text('←', 66, 76, 40, 300, INK) + text('→', 334, 76, 40, 300, INK) + text('sweep ← →: swim a lane', 200, 128, 17, 400, INK)
            + text('raise ↑: pulse · either hand', 200, 148, 14, 400, MUTED)),
        // Card 2: a mote rises into the pulse ring; pulse while it is inside to catch it. Glow drains; motes refill it.
        frame(panel(8, 8, 220, 144, 22) + `<rect x="78" y="42" width="80" height="56" rx="14" style="fill:none;stroke:${ICE};stroke-width:1.5;stroke-dasharray:5 6;opacity:.7"/>`
            + jelly(118, 66) + `<circle class="glass-mote" cx="118" cy="70" r="7" style="fill:${ICE};stroke:none"/>`
            + text('pulse while it is in the ring', 118, 30, 14, 400, INK)
            + panel(242, 30, 150, 100) + text('glow', 262, 58, 15, 400, MUTED, 'start') + `<rect x="262" y="70" width="110" height="9" rx="4.5" style="fill:rgba(240,242,255,.16);stroke:none"/><rect class="glass-glow" x="262" y="70" width="110" height="9" rx="4.5" style="fill:#9fe8ff;stroke:none"/>`
            + text('drains slowly', 317, 100, 14, 400, INK) + text('motes refill it', 317, 118, 14, 400, INK)),
        // Card 3: chain multiplier, violet ×3, reefs and darkness cost a life; stages.
        frame(panel(8, 12, 124, 70) + text('chain', 70, 38, 15, 400, MUTED) + text('×2 ×3 ×4', 70, 66, 19, 600, GOLD)
            + panel(140, 12, 120, 70) + `<path d="${hexPath(166, 47, 10)}" style="fill:${VIOLET};stroke:none"/>` + text('violet', 216, 40, 15, 400, MUTED) + text('×3', 216, 66, 20, 600, VIOLET)
            + panel(268, 12, 124, 70) + `<path d="M280 66L290 40L302 58L314 34L328 60L340 44L350 66Z" style="fill:#0d1426;stroke:${DANGER};stroke-width:2"/>` + text('−1', 372, 56, 20, 600, DANGER)
            + text('reef or no glow: −1 life · a missed mote ends the chain', 200, 106, 13, 400, INK)
            + text('40 s wide reefs · 80 s violet · 130 s currents', 200, 138, 14, 400, MUTED))
    ],
    orbit: [
        // Card 1: L drops to the faster inner ring, R climbs to the slower outer ring.
        frame(planet(200, 80, 18) + ring(200, 80, 34) + ring(200, 80, 50, true) + ring(200, 80, 66) + ring(200, 80, 82)
            + `<g class="glass-hop">${probe(250, 80)}</g>` + hand(48, 56, 'L') + text('inner ring', 48, 108, 17, 400, INK) + text('faster', 48, 128, 14, 400, MUTED)
            + hand(352, 56, 'R') + text('outer ring', 352, 108, 17, 400, INK) + text('slower', 352, 128, 14, 400, MUTED)),
        // Card 2: wait on your ring until the beacon lines up, then change orbit next to it.
        frame(planet(110, 80, 16) + ring(110, 80, 40, true) + ring(110, 80, 62)
            + `<g class="glass-orbit-a" style="transform-origin:110px 80px">${probe(150, 80)}</g><g class="glass-orbit-b" style="transform-origin:110px 80px">${beacon(172, 80)}</g>`
            + panel(212, 26, 178, 108) + text('1  wait until it', 228, 56, 16, 400, INK, 'start') + text('lines up', 245, 76, 16, 400, INK, 'start')
            + text('2  change orbit', 228, 104, 16, 400, INK, 'start') + text('beside it', 245, 124, 16, 400, INK, 'start')),
        // Card 3: chain, gold relays, fading beacons, debris.
        frame(panel(8, 12, 124, 70) + beacon(34, 47) + text('chain', 88, 40, 15, 400, MUTED) + text('×2 ×3 ×4', 88, 66, 16, 600, GOLD)
            + panel(140, 12, 120, 70) + beacon(166, 47, GOLD) + text('gold', 216, 40, 15, 400, MUTED) + text('×3', 216, 66, 20, 600, GOLD)
            + panel(268, 12, 124, 70) + `<path d="M296 33L305 43L311 53L298 62L288 56L285 45Z" style="fill:#0b0e1c;stroke:${DANGER};stroke-width:2"/>` + text('debris', 352, 40, 15, 400, MUTED) + text('−1', 352, 66, 20, 600, DANGER)
            + text('a faded beacon ends the chain · debris flies backwards', 200, 106, 13, 400, INK)
            + text('30 s debris · 75 s gold relays · 120 s more debris', 200, 138, 14, 400, MUTED))
    ]
};

export const captions = {
    prisms: ['Raise L to turn the prism one spoke left, R one spoke right. Its three rays turn with it.',
        'A crystal lights when the ray of its own colour and shape points at it. Light two with one turn for ×4.',
        'Clear a set in par turns for PERFECT. From set 4 dark glass cracks if any ray touches it: go the other way round.'],
    abyss: ['Sweep either hand sideways to swim one lane. Raise either hand to pulse.',
        'Pulse while a mote is inside the ring to catch it. Glow drains slowly; motes refill it, pulses cost a little.',
        'Catch motes in a row to raise the multiplier. Reefs and an empty glow cost a life. New depths open as you go.'],
    orbit: ['Raise L to drop to the inner ring, which is faster. Raise R to climb to the outer ring, which is slower.',
        'Wait until a beacon lines up with you on the next ring, then change orbit to arrive beside it.',
        'Beacons in a row chain up to ×4; gold relays pay ×3. A faded beacon ends the chain. Debris costs a life.']
};

export const lessons = {
    prisms: ['Turn the prism one spoke anticlockwise.', 'Turn the prism one spoke clockwise.',
        'The prism sends three rays on neighbouring spokes: rose triangle, mint square, sky circle. A crystal lights when the ray of its own colour and shape points at it: 10 points, or 10 × n² when one turn lights n crystals. Lighting every crystal adds 20, plus 20 for PERFECT when you used no more turns than par. Each crystal renews the clock; running out of time costs an attempt. Sets grow from two to four crystals, and from set 4 a dark-glass shard cracks if any ray touches it, costing an attempt: plan the way round it.'],
    abyss: ['Left hand: sweep ← or → to swim one lane that way; raise ↑ to pulse.', 'Right hand: the same moves. Either hand can swim either way.',
        'Motes rise towards the jellyfish. Pulse while one is inside the dashed ring in your lane to catch it: 10 points times the chain multiplier (×2 after 4 in a row, up to ×4). A mote that slips past ends the chain. Glow drains slowly and each pulse costs a little; motes refill it. Touching a reef or running out of glow costs a life. Wide reefs arrive at 40 s, violet motes worth ×3 beside the rocks at 80 s, and currents that push you a lane at 130 s.'],
    orbit: ['Drop to the inner ring: faster around the planet.', 'Climb to the outer ring: slower around the planet.',
        'Each change of orbit takes under half a second. Arrive on a beacon\'s ring right beside it to collect it: 20 points times your chain, up to ×4. If you share its ring you never catch up, so wait on a faster or slower ring until it lines up, then change. A beacon that fades ends the chain. Debris appears at 30 s, flying against the orbit: change ring to let it pass; a hit costs a life. Gold relays worth ×3 appear on the inner ring at 75 s, and debris thickens at 120 s.']
};
