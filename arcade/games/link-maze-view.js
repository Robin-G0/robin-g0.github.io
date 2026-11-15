import { LINK_EFFECTS } from './link-maze-map.js';
import { drawLinkEffect } from './link-maze-art.js';
import { Painter } from '../core/painter.js?v=power-11';

const ink = '#f2eaff', navy = '#110b32', cyan = '#63ffff', yellow = '#fff15a';
const arrow = side => side === 0 ? '←' : '→';

const mapLayers = new WeakMap();

function mapPoint(map, node, height) {
    return { x: 38 + node.x * 644,
        y: height - 126 - node.depth * ((height - 274) / map.maxDepth) };
}

function mapDrawing(s, p) {
    const { map } = s, safe = new Set(map.route);
    const top = 148, bottom = p.h - 126, step = (bottom - top) / map.maxDepth;
    const x = node => 38 + node.x * 644;
    const y = node => bottom - node.depth * step;
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
        if (!node.children.length) p.line([[x(node), y(node) - 5], [x(node), top - 28]], '#4e386d', 1);
    }
    const labelWidth = p.compact ? 128 : 84;
    p.rect(x(map.nodes[0]) - labelWidth / 2, bottom - 3, labelWidth, p.compact ? 38 : 29, yellow);
    p.text('START', x(map.nodes[0]), bottom + 12, p.compact ? 34 : 23, navy, 'center');
    p.line([[38, top - 28], [682, top - 28]], yellow, 2);
    p.rect(360 - labelWidth / 2, top - 43, labelWidth, p.compact ? 40 : 30, yellow);
    p.text('END', 360, top - 28, p.compact ? 36 : 25, navy, 'center');
    p.text('QUICK ROUTE', 360, p.h - 82, p.compact ? 31 : 23, cyan, 'center');
    const spacing = 82, origin = 360 - (map.shortRoute.length - 1) * spacing / 2;
    map.shortRoute.forEach((side, i) => p.text(arrow(side), origin + i * spacing, p.h - 44, 54, ink, 'center'));
}

function overview(s, p, reducedMotion) {
    if (typeof document === 'undefined') mapDrawing(s, p);
    else {
        let layer = mapLayers.get(p);
        if (!layer || layer.map !== s.map || layer.height !== p.h || layer.compact !== p.compact) {
            const scale = p.c.getTransform().a || 1, canvas = document.createElement('canvas');
            canvas.width = Math.ceil(p.w * scale); canvas.height = Math.ceil(p.h * scale);
            const context = canvas.getContext('2d'); context.setTransform(scale, 0, 0, scale, 0, 0);
            const cached = new Painter(context, p.colors); cached.h = p.h; cached.compact = p.compact;
            mapDrawing(s, cached);
            layer = { canvas, map: s.map, height: p.h, compact: p.compact };
            mapLayers.set(p, layer);
        }
        p.c.drawImage(layer.canvas, 0, 0, p.w, p.h);
    }
    // Animate only the small sprites above the cached tree. Neither path consumes RNG.
    for (const id of s.map.route) {
        const node = s.map.nodes[id];
        if (!node.children.length || node.effect === 'none') continue;
        const point = mapPoint(s.map, node, p.h), width = p.compact ? 116 : 68;
        drawLinkEffect(p, node.effect, point.x + width / 2 + 17, point.y,
            p.compact ? 38 : 28, s.time, reducedMotion);
    }
}

function links(s, p, reducedMotion) {
    const { h } = p, top = Math.max(132, Math.round(h * .28)), active = s.flipped > 0;
    const playerY = h - 76;
    const pulse = !reducedMotion ? Math.sin(s.time * 3) * 2 : 0;
    p.text(`/LOCAL/${String(s.completed + 1).padStart(2, '0')}/PAGE-${s.current}`, 44, 107, p.compact ? 30 : 23, '#b7a5dc');
    const recent = s.outcome && s.time - s.outcome.at < 1.6;
    const effect = recent ? LINK_EFFECTS[s.outcome.effect] : null;
    if (active || s.peek) p.text(active ? `↔ ${s.flipped}` : `PEEK ${s.peek}`, 590, 107, 35, active ? '#ffbe70' : cyan, 'center');
    for (let side = 0; side < 2; side++) {
        const left = side ? 380 : 40, center = left + 150;
        const selected = s.flash?.action === (side ? 'right' : 'left') && s.time - s.flash.at < .55;
        const wire = active
            ? [[360, playerY - 43], [center, playerY - 78], [side ? 190 : 530, top + 110]]
            : [[360, playerY - 43], [center, top + 110]];
        p.line(wire, active ? '#ffbe70' : '#4e386d', 3);
        const next = s.map.nodes[s.map.nodes[s.current].children[active ? 1 - side : side]];
        const content = s.peek ? LINK_EFFECTS[next.effect] : null;
        const flashColor = selected ? LINK_EFFECTS[s.flash.effect].color : cyan;
        p.rect(left, top, 300, 110, selected ? flashColor : '#241747');
        p.outline(left, top, 300, 110, selected ? ink : active ? '#ffbe70' : cyan, selected ? 5 : 2);
        p.text(arrow(side), center, top + 33, 60, selected ? navy : cyan, 'center');
        const illustrated = content && drawLinkEffect(p, next.effect, left + 50, top + 79, 45, s.time, reducedMotion);
        p.text(content?.label || 'LINK ?', center + (illustrated ? 15 : 0), top + 82, p.compact ? 44 : 33, selected ? navy : content?.color || ink, 'center');
    }
    p.rect(306, playerY - 43 + pulse, 108, 86, '#241747');
    p.outline(306, playerY - 43 + pulse, 108, 86, cyan, 3);
    const illustrated = effect && effect !== LINK_EFFECTS.none &&
        drawLinkEffect(p, s.outcome.effect, 360, playerY + pulse, 82, s.time, reducedMotion);
    if (!illustrated) p.text('@', 360, playerY + pulse, 60, cyan, 'center');
    if (effect && effect !== LINK_EFFECTS.none) {
        p.rect(245, playerY - 105, 230, 58, navy);
        p.text(effect.label, 360, playerY - 76, p.compact ? 54 : 43, effect.color, 'center');
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
        overview(s, p, reducedMotion);
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
