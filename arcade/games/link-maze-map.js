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
    fatal: { label: 'DIE', color: '#ff456c' },
    exit: { label: 'END', color: '#fff15a' }
});

export function mazePenalties(round) {
    const step = Math.max(0, round - 1);
    return { tax: 25 + step * 25, delay: Math.min(20, 5 + step * 2), flip: Math.min(6, 2 + Math.floor(step / 2)) };
}

function effectsForRound(round) {
    const penalty = mazePenalties(round);
    return { ...LINK_EFFECTS,
        tax: { ...LINK_EFFECTS.tax, label: `−${penalty.tax}` },
        delay: { ...LINK_EFFECTS.delay, label: `−${penalty.delay}s` },
        flip: { ...LINK_EFFECTS.flip, label: `↔ ${penalty.flip}` } };
}

function assignEffects(pages, safe, random, round) {
    // Separate spatial quotas prevent one half becoming the obvious good/bad side.
    // Protected pages can be neutral or beneficial; protection never promotes a penalty to a bonus.
    for (const left of [true, false]) {
        const cells = pages.filter(node => node.id && node.children.length && (node.x < .5) === left);
        const candidates = shuffle(cells.filter(node => !safe.has(node.id)), random);
        const penaltyCount = Math.min(candidates.length, Math.max(1, Math.round(cells.length * .3)));
        const bad = candidates.slice(0, penaltyCount);
        let bag = [];
        for (const node of bad) {
            if (!bag.length) bag = shuffle(['tax', 'delay', 'flip'], random);
            node.effect = bag.pop();
        }
        if (round > 3 && bad.length) {
            const lethal = Math.min(1 + Math.floor((round - 4) / 3), Math.max(1, Math.floor(bad.length / 3)));
            for (const node of shuffle([...bad], random).slice(0, lethal)) node.effect = 'fatal';
        }
        const good = shuffle(cells.filter(node => node.effect === 'none'), random)
            .slice(0, Math.max(1, Math.round(cells.length * .25)));
        bag = [];
        for (const node of good) {
            if (!bag.length) bag = shuffle(['points', 'seconds', 'reveal'], random);
            node.effect = bag.pop();
        }
        // Unassigned cells stay plain PAGEs, including most of the protected route.
    }
}

function shuffle(items, random) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

/** Forward-only branching paths. Shared pages bound width as the maze gets deeper. */
export function generateMaze(random, level, round = level) {
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
    assignEffects(pages, safe, random, round);
    return { nodes: pages, route, shortRoute, round, effects: effectsForRound(round), ...rules };
}
