// Wrist identity and direction are separate; directions refer to the mirrored screen.
export const WRISTS = Object.freeze(['left', 'right']);
export const DIRECTIONS = Object.freeze(['left', 'up', 'right']);
export const ARROWS = Object.freeze({ left: '←', up: '↑', right: '→' });
export const WRIST_COMMANDS = Object.freeze(WRISTS.flatMap(wrist => DIRECTIONS.map(direction => `${wrist}_${direction}`)));

export function decodeGesture(action) {
    const match = /^(left|right)_(up|left|right|neutral)$/.exec(action);
    return match ? { wrist: match[1], direction: match[2] } : null;
}
export function commandLabel(action) {
    const gesture = decodeGesture(action);
    return gesture && gesture.direction !== 'neutral' ? `${gesture.wrist === 'left' ? 'L' : 'R'} ${ARROWS[gesture.direction]}` : action;
}
