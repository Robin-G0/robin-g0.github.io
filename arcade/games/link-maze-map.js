export const MAZE_LEVELS = Object.freeze([
    { minDepth: 5, maxDepth: 8, preview: 9 },
    { minDepth: 7, maxDepth: 10, preview: 11 },
    { minDepth: 9, maxDepth: 12, preview: 13 }
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

/** Forward-only branching paths. Shared pages bound width as the maze gets deeper. */
export function generateMaze(random, level) {
    const rules = MAZE_LEVELS[Math.min(3, Math.max(1, level)) - 1];
    const nodes = [];
    const layers = Array.from({ length: rules.maxDepth + 1 }, (_, depth) => {
        // Six pages per row remain distinguishable on a phone; never build 2^depth pages.
        const count = Math.min(6, 2 ** depth), span = .34 + .12 * depth / rules.maxDepth;
        return Array.from({ length: count }, (_, column) => {
            const node = { id: nodes.length, depth, children: [], effect: 'none',
                x: count === 1 ? .5 : .5 - span + column * span * 2 / (count - 1) };
            nodes.push(node); return node;
        });
    });
    for (let depth = 0; depth < rules.maxDepth; depth++) {
        const next = layers[depth + 1];
        for (const node of layers[depth]) {
            // The next row spreads slightly farther: both choices straddle the parent.
            const right = next.findIndex(child => child.x > node.x);
            node.children = [next[right - 1].id, next[right].id];
        }
    }
    const shortRoute = Array.from({ length: rules.minDepth }, () => random() < .5 ? 0 : 1);
    let route = [0];
    for (const side of shortRoute) route.push(nodes[route.at(-1)].children[side]);
    const shortExit = route.at(-1), longPath = new Set([0]);
    let current = 0;
    for (let depth = 1; depth <= rules.maxDepth; depth++) {
        const choices = nodes[current].children.filter(id => id !== shortExit);
        current = choices[Math.floor(random() * choices.length)]; longPath.add(current);
    }
    // Keep both a short and a long route, with additional early exits along the way.
    for (const node of nodes) {
        if (node.id === shortExit || (!longPath.has(node.id) && node.depth >= rules.minDepth && random() < .2)) {
            node.children = [];
        }
        if (!node.children.length) node.effect = 'exit';
    }
    // Remove unreachable pages after early exits. Reindex once for direct game lookups.
    const reachable = new Set();
    function visit(id) {
        if (reachable.has(id)) return;
        reachable.add(id); nodes[id].children.forEach(visit);
    }
    visit(0);
    const pages = nodes.filter(node => reachable.has(node.id));
    const ids = new Map(pages.map((node, id) => [node.id, id]));
    for (const node of pages) { node.id = ids.get(node.id); node.children = node.children.map(id => ids.get(id)); }
    route = route.map(id => ids.get(id));
    const safe = new Set(route);
    let bag = [];
    for (const node of pages) {
        if (!node.id || !node.children.length) continue;
        if (safe.has(node.id)) {
            node.effect = ['none', 'points', 'seconds', 'reveal'][Math.floor(random() * 4)];
        } else {
            if (!bag.length) bag = shuffle(['points', 'seconds', 'reveal', 'tax', 'delay', 'flip'], random);
            node.effect = bag.pop();
        }
    }
    return { nodes: pages, route, shortRoute, ...rules };
}
