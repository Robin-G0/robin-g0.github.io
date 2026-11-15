import { LINK_EFFECTS } from './link-maze-map.js';

const ink = '#f2eaff', navy = '#110b32', cyan = '#63ffff', yellow = '#fff15a';
const arrow = side => side === 0 ? '←' : '→';

function overview(s, p) {
    const { map } = s, safe = new Set(map.route);
    const top = 112, bottom = p.h - 150, step = (bottom - top) / map.maxDepth;
    const x = node => 38 + node.x * 644;
    const y = node => top + node.depth * step;
    // Muted branches first; the suggested short route remains legible above them.
    for (const highlight of [false, true]) for (const node of map.nodes) {
        for (const childId of node.children) {
            const child = map.nodes[childId], chosen = safe.has(node.id) && safe.has(childId);
            if (chosen !== highlight) continue;
            p.line([[x(node), y(node)], [x(child), y(child)]], chosen ? cyan : '#4e386d', chosen ? 4 : 1);
        }
    }
    for (const node of map.nodes) {
        const effect = LINK_EFFECTS[node.effect], chosen = safe.has(node.id);
        const width = chosen ? 16 : 6;
        p.rect(x(node) - width / 2, y(node) - width / 2, width, width, chosen ? cyan : effect.color);
        if (chosen && node.id && node.children.length) {
            const w = p.compact ? 116 : 68, height = p.compact ? 38 : 22;
            p.rect(x(node) - w / 2, y(node) - height / 2, w, height, navy);
            p.outline(x(node) - w / 2, y(node) - height / 2, w, height, effect.color);
            p.text(effect.label, x(node), y(node), p.compact ? 30 : 18, effect.color, 'center');
        }
        if (!node.children.length) p.line([[x(node), y(node) + 5], [x(node), bottom + 22]], '#4e386d', 1);
    }
    const labelWidth = p.compact ? 128 : 84;
    p.rect(x(map.nodes[0]) - labelWidth / 2, top - 19, labelWidth, p.compact ? 38 : 29, yellow);
    p.text('START', x(map.nodes[0]), top - 2, p.compact ? 34 : 23, navy, 'center');
    p.line([[38, bottom + 22], [682, bottom + 22]], yellow, 2);
    p.rect(360 - labelWidth / 2, bottom + 14, labelWidth, p.compact ? 40 : 30, yellow);
    p.text('END', 360, bottom + 29, p.compact ? 36 : 25, navy, 'center');
    p.text('QUICK ROUTE', 360, p.h - 82, p.compact ? 31 : 23, cyan, 'center');
    const spacing = 82, origin = 360 - (map.shortRoute.length - 1) * spacing / 2;
    map.shortRoute.forEach((side, i) => p.text(arrow(side), origin + i * spacing, p.h - 44, 54, ink, 'center'));
}

function links(s, p, reducedMotion) {
    const { h } = p, top = h - 155, active = s.flipped > 0;
    const pulse = !reducedMotion ? Math.sin(s.time * 3) * 2 : 0;
    p.text(`/LOCAL/${String(s.completed + 1).padStart(2, '0')}/PAGE-${s.current}`, 44, 107, p.compact ? 30 : 23, '#b7a5dc');
    p.rect(316, 147 + pulse, 88, 96, '#241747');
    p.outline(316, 147 + pulse, 88, 96, cyan, 3);
    p.text('@', 360, 192 + pulse, 60, cyan, 'center');
    const recent = s.outcome && s.time - s.outcome.at < 1.6;
    const effect = recent ? LINK_EFFECTS[s.outcome.effect] : null;
    if (effect && effect !== LINK_EFFECTS.none) {
        p.rect(245, 159, 230, 65, navy);
        p.text(effect.label, 360, 192, p.compact ? 54 : 43, effect.color, 'center');
    }
    if (active || s.peek) p.text(active ? `↔ ${s.flipped}` : `PEEK ${s.peek}`, 590, 135, 35, active ? '#ffbe70' : cyan, 'center');
    for (let side = 0; side < 2; side++) {
        const left = side ? 380 : 40, center = left + 150;
        const selected = s.flash?.action === (side ? 'right' : 'left') && s.time - s.flash.at < .55;
        p.line([[active ? center : 360, active ? top - 60 : 245], [active ? (side ? 190 : 530) : center, top]], active ? '#ffbe70' : '#4e386d', 3);
        const next = s.map.nodes[s.map.nodes[s.current].children[active ? 1 - side : side]];
        const content = s.peek ? LINK_EFFECTS[next.effect] : null;
        const flashColor = selected ? LINK_EFFECTS[s.flash.effect].color : cyan;
        p.rect(left, top, 300, 110, selected ? flashColor : '#241747');
        p.outline(left, top, 300, 110, selected ? ink : active ? '#ffbe70' : cyan, selected ? 5 : 2);
        p.text(arrow(side), center, top + 33, 60, selected ? navy : cyan, 'center');
        p.text(content?.label || 'LINK ?', center, top + 82, p.compact ? 44 : 33, selected ? navy : content?.color || ink, 'center');
    }
    // Only the route already taken remains visible; no hidden map or future effects leak.
    p.text(s.history.map(side => side === 'left' ? '←' : '→').join('  ') || 'START', 360, h - 17, p.compact ? 38 : 26, '#b7a5dc', 'center');
}

export function renderMaze(s, p, reducedMotion = false) {
    p.rect(14, 64, 692, p.h - 72, navy); p.outline(14, 64, 692, p.h - 72, '#634491', 2);
    p.rect(16, 66, 688, 22, '#342258');
    p.text(`LINK MAZE   /   LEVEL ${s.level}`, 32, 77, 16, '#b7a5dc');
    if (s.stage === 'preview') {
        p.text(`MEMORISE  ${Math.max(0, Math.ceil(s.until - s.time))}`, 360, 34, p.compact ? 48 : 35, yellow, 'center');
        overview(s, p);
    } else if (s.stage === 'arrival') {
        p.text('HOMEPAGE!', 360, p.h * .36, 60, yellow, 'center');
        p.text('+8s', 360, p.h * .54, 70, cyan, 'center');
        p.text(`+${s.outcome.points}`, 360, p.h * .7, 42, ink, 'center');
    } else if (s.stage === 'over') {
        p.text('TIME UP', 360, p.h * .5, 60, yellow, 'center');
    } else {
        p.text('FIND THE HOMEPAGE', 360, 34, p.compact ? 42 : 30, yellow, 'center');
        links(s, p, reducedMotion);
    }
}
