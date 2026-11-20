// Frutiger Aero teaching material: three SVG cards per engine, their captions and the Controls text.
// Cards are small glass-and-water scenes with the same glossy orbs as the canvas. Scene colours come
// from CSS custom properties (arcade/themes/aero.css) so dark appearance swaps day for night.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const COLORS = { aqua: '#18a9e0', lime: '#78c832', sun: '#ffbf1f', pink: '#e2559b', violet: '#8b62d6', orange: '#ff8a1e',
    coral: '#f0564a', jelly: '#c056d2', white: '#f6fbff', pebble: '#8d9aa3', leaf: '#3c9a26', sky: '#4cc4f2' };

const stop = (offset, variable, fallback) => `<stop offset="${offset}" style="stop-color:var(${variable},${fallback})"/>`;
const defs = () => `<defs>
<linearGradient id="aero-water" x1="0" y1="0" x2="0" y2="1">${stop(0, '--aero-card-top', '#dffbff')}${stop(.5, '--aero-card-mid', '#7fdcf2')}${stop(1, '--aero-card-low', '#2aa6d4')}</linearGradient>
<linearGradient id="aero-sky" x1="0" y1="0" x2="0" y2="1">${stop(0, '--aero-sky-top', '#3aa6e6')}${stop(1, '--aero-sky-low', '#dff6ff')}</linearGradient>
<linearGradient id="aero-hill" x1="0" y1="0" x2="0" y2="1">${stop(0, '--aero-hill-top', '#b6ef6a')}${stop(1, '--aero-hill-low', '#3f9f30')}</linearGradient>
<linearGradient id="aero-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>
<linearGradient id="aero-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
${Object.entries(COLORS).map(([name, color]) => `<radialGradient id="aero-orb-${name}" cx=".5" cy=".78" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".25" stop-color="${color}" stop-opacity=".9"/><stop offset=".7" stop-color="${color}"/><stop offset="1" stop-color="#0b3c5a"/></radialGradient>`).join('')}
</defs>`;
const frame = (content, scene = 'water') => `<svg viewBox="0 0 400 160" class="guide-art aero-diagram" aria-hidden="true">${defs()}`
    + `<rect x="1" y="1" width="398" height="158" rx="18" class="aero-card-bg" style="fill:url(#aero-${scene});stroke:rgba(255,255,255,.85);stroke-width:1.5"/>`
    + (scene === 'sky' ? '<path d="M1 120Q120 92 230 112T399 100V141a18 18 0 0 1-18 18H19A18 18 0 0 1 1 141Z" style="fill:url(#aero-hill);stroke:none"/>' : '')
    + '<rect x="2" y="2" width="396" height="62" rx="17" style="fill:url(#aero-band);stroke:none"/>'
    + `${content}<rect class="aero-sweep" x="-90" y="2" width="56" height="156" style="fill:rgba(255,255,255,.22);stroke:none" transform="skewX(-20)"/></svg>`;
const text = (value, x, y, size = 18, weight = 600, anchor = 'middle') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" class="aero-label">${escape(value)}</text>`;
const orb = (x, y, r, color, glyph = '') => `<g><circle cx="${x}" cy="${y}" r="${r}" style="fill:url(#aero-orb-${color});stroke:rgba(0,50,80,.45);stroke-width:1"/>`
    + `<ellipse cx="${x}" cy="${y - r * .46}" rx="${r * .62}" ry="${r * .34}" style="fill:url(#aero-shine);stroke:none"/>${glyph ? icon(glyph, x, y + r * .06, r * .5) : ''}</g>`;
const ring = (x, y, r, css = '') => `<g class="${css}"><circle cx="${x}" cy="${y}" r="${r}" style="fill:rgba(220,250,255,.18);stroke:rgba(255,255,255,.9);stroke-width:2"/><ellipse cx="${x - r * .35}" cy="${y - r * .42}" rx="${r * .26}" ry="${r * .14}" style="fill:#fff;stroke:none" transform="rotate(-30 ${x - r * .35} ${y - r * .42})"/></g>`;
function icon(kind, x, y, r, fill = '#fff') {
    const s = `style="fill:${fill};stroke:none"`;
    if (kind === 'drop') return `<path ${s} d="M${x} ${y - r}C${x + r * .9} ${y} ${x + r * .7} ${y + r * .9} ${x} ${y + r * .9}S${x - r * .9} ${y} ${x} ${y - r}Z"/>`;
    if (kind === 'sun') return `<circle ${s} cx="${x}" cy="${y}" r="${r * .45}"/><g style="stroke:${fill};stroke-width:${r * .18};stroke-linecap:round">${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<path d="M${(x + Math.cos(a) * r * .66).toFixed(1)} ${(y + Math.sin(a) * r * .66).toFixed(1)}L${(x + Math.cos(a) * r * .96).toFixed(1)} ${(y + Math.sin(a) * r * .96).toFixed(1)}"/>`; }).join('')}</g>`;
    if (kind === 'leaf') return `<path ${s} d="M${x - r * .8} ${y + r * .7}Q${x - r * .7} ${y - r * .8} ${x + r * .8} ${y - r * .8}Q${x + r * .7} ${y + r * .6} ${x - r * .8} ${y + r * .7}Z"/>`;
    if (kind === 'star') return `<path ${s} d="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * .42 : r; return `${i ? 'L' : 'M'}${(x + Math.cos(a) * k).toFixed(1)} ${(y + Math.sin(a) * k).toFixed(1)}`; }).join('')}Z"/>`;
    if (kind === 'rainbow') return ['#ff6b5e', '#ffd23f', '#4cd964'].map((c, i) => { const k = r * (1 - i * .25); return `<path d="M${x - k} ${y + r * .4}A${k} ${k} 0 0 1 ${x + k} ${y + r * .4}" style="fill:none;stroke:${c};stroke-width:${r * .22}"/>`; }).join('');
    return '';
}
const fish = (x, y, size, color = COLORS.orange, angle = -90) =>
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size / 40})"><path d="M-14 0L-26 -9Q-22 0 -26 9Z" style="fill:${color};stroke:none;opacity:.85"/><ellipse cx="0" cy="0" rx="16" ry="8" style="fill:${color};stroke:rgba(80,30,0,.5);stroke-width:1"/><ellipse cx="1" cy="-3.5" rx="10" ry="2.5" style="fill:#fff;opacity:.55;stroke:none"/><circle cx="9" cy="-1.5" r="2.2" style="fill:#062033;stroke:#fff;stroke-width:1"/></g>`;
const jelly = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-10 4v14M-4 5v16M3 5v15M9 4v13" style="fill:none;stroke:${COLORS.jelly};stroke-width:2.5;stroke-linecap:round;opacity:.8"/><path d="M-16 5C-16 -18 16 -18 16 5Q12 9 8 5Q4 9 0 5Q-4 9 -8 5Q-12 9 -16 5Z" style="fill:url(#aero-orb-jelly);stroke:#fff;stroke-width:1"/><ellipse cx="-3" cy="-7" rx="8" ry="3.5" style="fill:#fff;opacity:.7;stroke:none"/></g>`;
const glassBlock = (x, y, w, h, tint = 'rgba(240,86,74,.6)') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" style="fill:${tint};stroke:rgba(255,255,255,.9);stroke-width:1.5"/><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h / 2 - 2}" rx="6" style="fill:url(#aero-band);stroke:none"/>`;
const pill = (x, y, w, h, content, r = Math.min(h / 2, 16)) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" style="fill:rgba(255,255,255,.55);stroke:rgba(255,255,255,.95);stroke-width:1.5"/><rect x="${x + 2}" y="${y + 1.5}" width="${w - 4}" height="${h / 2 - 1}" rx="${r - 2}" style="fill:url(#aero-band);stroke:none"/>${content}`;
function arrow(x1, y1, x2, y2, color = '#fff') {
    const a = Math.atan2(y2 - y1, x2 - x1), head = d => `${(x2 - 11 * Math.cos(a + d)).toFixed(1)} ${(y2 - 11 * Math.sin(a + d)).toFixed(1)}`;
    return `<path d="M${x1} ${y1}L${x2} ${y2}M${x2} ${y2}L${head(-.5)}M${x2} ${y2}L${head(.5)}" class="aero-arrow" style="fill:none;stroke:${color};stroke-width:4;stroke-linecap:round"/>`;
}
const lane = x => `<rect x="${x - 34}" y="8" width="68" height="146" rx="26" style="fill:rgba(255,255,255,.16);stroke:none"/>`;
const school = (x, y, css = 'aero-school') => `<g class="${css}">${fish(x, y, 30)}${fish(x - 14, y + 16, 22, COLORS.sky)}${fish(x + 14, y + 16, 22)}</g>`;
const cloud = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${[[-20, 4, 13], [-5, -5, 17], [14, 1, 15], [26, 7, 10]].map(([dx, dy, r]) => orb(dx, dy, r, 'white')).join('')}</g>`;
const sprout = (x, y, stage = 1) => `<g class="aero-sway" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y}Q${x + 2} ${y - 12 - stage * 6} ${x} ${y - 20 - stage * 10}" style="fill:none;stroke:${COLORS.leaf};stroke-width:3"/>${Array.from({ length: stage + 1 }, (_, i) => { const lx = x + (i % 2 ? 8 : -8), ly = y - 10 - i * 9; return `<ellipse cx="${lx}" cy="${ly}" rx="8" ry="3.5" style="fill:${COLORS.lime};stroke:${COLORS.leaf};stroke-width:1" transform="rotate(${i % 2 ? -30 : 30} ${lx} ${ly})"/>`; }).join('')}</g>${glassBlock(x - 18, y - 2, 36, 16, 'rgba(60,154,38,.6)')}`;
const need = (x, y, kind) => `<circle cx="${x}" cy="${y}" r="17" style="fill:none;stroke:rgba(255,255,255,.75);stroke-width:3"/><g class="aero-bob">${orb(x, y, 13, kind === 'drop' ? 'aqua' : kind === 'sun' ? 'sun' : 'white', kind)}</g>`;

export const diagrams = {
    school: [
        frame(lane(110) + lane(200) + lane(290) + `<g class="aero-swim">${school(200, 106)}${ring(200, 112, 34, 'aero-shield')}</g>`
            + arrow(150, 60, 116, 60) + arrow(250, 60, 284, 60) + text('← sweep', 66, 34, 16) + text('sweep →', 334, 34, 16)
            + arrow(200, 54, 200, 20) + text('raise ↑ = bubble shield', 200, 150, 14)
            + pill(304, 118, 86, 26, orb(320, 131, 7, 'white') + orb(338, 131, 7, 'white') + text('pearls', 368, 135, 11))),
        frame(lane(110) + lane(200) + lane(290)
            + `<g class="aero-drift">${jelly(110, 26)}${fish(290, 26, 20, COLORS.orange, 0)}${ring(290, 26, 16)}</g>`
            + glassBlock(76, 66, 68, 18) + glassBlock(166, 66, 68, 18) + `<ellipse cx="290" cy="75" rx="30" ry="10" style="fill:none;stroke:${COLORS.lime};stroke-width:4"/>`
            + text('gate: through the green gap', 200, 104, 14) + school(290, 124) + text('stray +1', 316, 30, 13, 600, 'start') + text('avoid', 86, 30, 13, 600, 'end')),
        frame(text('HOME ×7', 96, 40, 26, 300) + text('10 per fish + 1 pearl', 96, 62, 13)
            + jelly(236, 36) + glassBlock(270, 22, 44, 24) + text('−1 life, half swim off', 270, 72, 13)
            + pill(16, 90, 368, 56, text('50 s twin jellyfish · 75 s golden strays +3', 200, 112, 13) + text('100 s crowded reef: a gate every 4 rows', 200, 132, 13)))
    ],
    bubbles: [
        frame('<rect x="140" y="8" width="120" height="100" rx="16" style="fill:rgba(255,255,255,.3);stroke:#fff;stroke-width:1.5"/>'
            + orb(162, 26, 15, 'aqua', 'drop') + orb(200, 26, 15, 'lime', 'leaf') + orb(238, 26, 15, 'sun', 'star') + orb(200, 62, 15, 'aqua', 'drop')
            + '<rect x="188" y="112" width="24" height="44" rx="12" style="fill:rgba(255,255,255,.35);stroke:#fff;stroke-width:1.5"/>'
            + `<g class="aero-rise">${orb(200, 140, 12, 'lime', 'leaf')}</g>`
            + arrow(186, 116, 164, 52) + arrow(214, 116, 236, 52)
            + text('raise L', 86, 66, 17) + text('raise R', 314, 66, 17) + text('wait: straight up', 318, 140, 14) + text('the centre', 318, 156, 12)),
        frame('<rect x="132" y="8" width="136" height="118" rx="16" style="fill:rgba(255,255,255,.3);stroke:#fff;stroke-width:1.5"/>'
            + `<g class="aero-pop">${orb(155, 28, 15, 'aqua', 'drop')}${orb(155, 62, 15, 'aqua', 'drop')}${orb(200, 62, 15, 'aqua', 'drop')}</g>`
            + orb(200, 28, 15, 'pink') + orb(245, 28, 15, 'lime', 'leaf') + orb(245, 62, 15, 'lime', 'leaf') + `<g class="aero-float">${orb(200, 96, 15, 'lime', 'leaf')}</g>`
            + text('3 touching', 68, 40, 15) + text('= pop', 68, 58, 15) + text('then float up', 334, 88, 14) + text('cascade ×2', 334, 108, 16) + text('sideways touches count too', 200, 148, 14)),
        frame(text('10 × size²', 74, 34, 22, 300) + text('3 → 90 · 4 → 160', 74, 56, 12) + text('× cascade step', 74, 74, 13)
            + orb(200, 38, 16, 'white', 'rainbow') + text('cascade → rainbow', 200, 74, 12) + text('takes the colour above', 200, 90, 11)
            + orb(322, 38, 15, 'pebble') + text('45 s: pebbles', 322, 74, 12) + text('crack beside a pop', 322, 90, 11)
            + `<path d="M40 122H360" style="stroke:${COLORS.coral};stroke-width:4;stroke-dasharray:9 7;fill:none"/>` + text('a column past the red line costs a life', 200, 146, 14))
    ],
    garden: [
        frame(cloud(92, 40) + `<g class="aero-drip">${icon('drop', 80, 76, 6, '#5fc8f5')}${icon('drop', 100, 86, 6, '#5fc8f5')}${icon('drop', 90, 98, 6, '#5fc8f5')}</g>`
            + orb(306, 40, 20, 'sun', 'sun') + '<path class="aero-ray" d="M300 64L290 104M316 64L326 104" style="stroke:#fff6b0;stroke-width:6;stroke-linecap:round;fill:none;opacity:.85"/>'
            + text('raise L = rain', 92, 146, 17) + text('raise R = sunshine', 306, 146, 17) + text('on every plant', 200, 72, 13), 'sky'),
        frame(cloud(52, 26, .7) + sprout(130, 122) + need(130, 66, 'drop') + sprout(200, 122, 2) + need(200, 66, 'drop') + sprout(270, 122) + need(270, 66, 'sun')
            + text('×2 +40', 165, 30, 18) + `<circle cx="270" cy="66" r="17" class="aero-stress" style="fill:none;stroke:${COLORS.coral};stroke-width:3;stroke-dasharray:60 50"/>`
            + text('wait for a batch: 10 × n²', 200, 152, 14) + text('rain stresses', 340, 56, 12) + text('sun plants', 340, 72, 12), 'sky'),
        frame(sprout(64, 110, 2) + `<g class="aero-bloom" style="transform-origin:64px 46px">${[0, 1, 2, 3, 4, 5].map(i => orb(+(64 + Math.cos(i * 1.05) * 9).toFixed(1), +(46 + Math.sin(i * 1.05) * 9).toFixed(1), 6, 'pink')).join('')}${orb(64, 46, 5, 'sun')}</g>`
            + text('3 served', 64, 140, 13) + text('= bloom +50', 64, 154, 13)
            + '<path d="M168 112Q176 84 196 96" style="fill:none;stroke:#9a9a7a;stroke-width:3"/>' + text('timer out:', 182, 130, 13) + text('wilt −1 life', 182, 146, 13)
            + pill(250, 16, 140, 120, text('40 s new bed', 320, 40, 13) + need(282, 76, 'rainbow') + text('65 s: rain', 340, 72, 12) + text('and sun', 340, 88, 12) + text('90 s new bed', 320, 122, 13)), 'sky')
    ]
};

export const captions = {
    school: ['Sweep either wrist left or right to swim one lane. Raise a wrist to spend a pearl on a short bubble shield.',
        'Rows drift down to your school. Swim into strays to grow it, dodge jellyfish, and pass each glass gate through its green gap.',
        'A gate brings the school home: 10 per fish and a pearl. Stings and coral cost a life and half the school. New hazards join over time.'],
    bubbles: ['Raise L or R to send the rising bubble up the left or right column. Do nothing and it floats up the centre.',
        'Three or more touching bubbles of one colour pop, across columns too. The rest float up, and new touches pop as a cascade.',
        'Bigger groups and cascades score far more; a cascade earns a rainbow bubble. Pebbles arrive at 45 s. A column past the red line costs a life.'],
    garden: ['Raise L to rain on the whole garden. Raise R for sunshine on the whole garden.',
        'Every plant asking for that weather is served at once: a batch of n scores 10 × n². The other weather shortens their timers.',
        'Three served needs bloom a plant for 50. A timer that runs out wilts it and costs a life. Beds and rainbow plants arrive over time.']
};

export const lessons = {
    school: ['Left wrist: sweep ← or → to swim one lane; raise ↑ to spend a pearl on a bubble shield.',
        'Right wrist: the same three moves. Use whichever wrist is comfortable.',
        'Rows drift down to the school line. A stray in your lane joins the school (+5 each). A jellyfish or a coral block costs a life and half your followers; the leader always stays and you get 1.2 s of recovery. Glass gates bring the school home through their green gap: 10 points per fish and one pearl (up to three). Raising a wrist spends a pearl on a 1.6 s bubble shield that absorbs one hit. Each row is at most one lane from the last, so one sweep per row is always enough. Twin jellyfish arrive at 50 s, golden strays (+3 fish) at 75 s, and a gate every four rows at 100 s.'],
    bubbles: ['Send the rising bubble up the left column.', 'Send it up the right column. Do nothing and it floats up the centre.',
        'Groups of three or more touching bubbles of one colour pop, sideways across columns too, for 10 × size² points. The columns then float up; anything that now touches pops as the next cascade step, multiplying its points. A cascade earns one rainbow bubble that takes the colour above it. Glyphs repeat the colour: drop, leaf, star, flower, diamond. From 45 s grey pebbles arrive; they never match but crack when a pop touches them. A fourth colour joins at 90 s and a fifth at 150 s. A column that grows past the red line vents and costs a life.'],
    garden: ['Rain on the whole garden: every plant showing a drop is watered.', 'Sunshine on the whole garden: every plant showing a sun is served.',
        'A batch of n plants scores 10 × n², so waiting for a bigger batch pays, but each weather cuts the opposite timers by 35 %. The cloud and the sun count the plants waiting for them. Three served needs bloom a plant for 50 points. A timer that runs out wilts the plant and costs a life. A fifth bed opens at 40 s, rainbow plants that need both rain and sun arrive at 65 s, and a sixth bed at 90 s.']
};
