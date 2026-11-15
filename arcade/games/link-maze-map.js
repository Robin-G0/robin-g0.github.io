export const MAZE_LEVELS = Object.freeze([
    { minDepth: 3, maxDepth: 5, preview: 9 },
    { minDepth: 4, maxDepth: 6, preview: 11 },
    { minDepth: 5, maxDepth: 7, preview: 13 }
]);

export const LINK_EFFECTS = Object.freeze({
    none: { label: 'PAGE', color: '#b7a5dc' },
    points: { label: '+40', color: '#8affba' },
    seconds: { label: '+5s', color: '#8affba' },
    reveal: { label: 'PEEK 2', color: '#63ffff' },
    tax: { label: '−25', color: '#ff8aa9' },
    delay: { label: '−5s', color: '#ff8aa9' },
    flip: { label: '↔ 2', color: '#ffbe70' },
    exit: { label: 'END', color: '#fff15a' }
});

function shuffle(items, random) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

/** A finite tree: every leaf links to one shared exit, with no dead ends or cycles. */
export function generateMaze(random, level) {
    const rules = MAZE_LEVELS[Math.min(3, Math.max(1, level)) - 1];
    const shortRoute = Array.from({ length: rules.minDepth }, () => random() < .5 ? 0 : 1);
    const longRoute = Array.from({ length: rules.maxDepth }, (_, i) => i ? (random() < .5 ? 0 : 1) : 1 - shortRoute[0]);
    const nodes = [];
    function branch(depth, isShort, isLong) {
        const node = { id: nodes.length, depth, children: [], effect: 'none', x: 0 };
        nodes.push(node);
        if (depth === rules.maxDepth || (depth >= rules.minDepth && !isLong &&
            (isShort || (depth === rules.maxDepth - 1 && random() < .3)))) {
            node.effect = 'exit'; return node.id;
        }
        for (let side = 0; side < 2; side++) {
            node.children.push(branch(depth + 1, isShort && shortRoute[depth] === side, isLong && longRoute[depth] === side));
        }
        return node.id;
    }
    branch(0, true, true);
    const route = [0];
    for (const side of shortRoute) route.push(nodes[route.at(-1)].children[side]);
    const safe = new Set(route);
    let bag = [];
    for (const node of nodes) {
        if (!node.id || !node.children.length) continue;
        if (safe.has(node.id)) {
            node.effect = ['none', 'points', 'seconds', 'reveal'][Math.floor(random() * 4)];
        } else {
            if (!bag.length) bag = shuffle(['points', 'seconds', 'reveal', 'tax', 'delay', 'flip'], random);
            node.effect = bag.pop();
        }
    }
    // Leaf order gives a tidy tree layout without an external graph library.
    let leaves = 0;
    function position(id) {
        const node = nodes[id];
        node.x = node.children.length ? node.children.map(position).reduce((a, b) => a + b) / 2 : leaves++;
        return node.x;
    }
    position(0);
    for (const node of nodes) node.x = (node.x + .5) / leaves;
    return { nodes, route, shortRoute, ...rules };
}
