import { WRISTS, DIRECTIONS } from '../core/commands.js';

// Body cells use unmirrored image X; the preview is mirrored once. A screen-left
// movement therefore increases grid X. Each anatomical wrist has its own home.
export const wristZones = {
    left: { neutral: [5, 4, 3, 3], up: [5, 1, 3, 2], left: [9, 4, 3, 3], right: [1, 4, 3, 3] },
    right: { neutral: [1, 4, 3, 3], up: [1, 1, 3, 2], left: [5, 4, 3, 3], right: [-3, 4, 3, 3] }
};

function region(wrist, direction) {
    const action = `${wrist}_${direction}`;
    return {
        id: action, name: `${wrist} wrist ${direction}`, action,
        mirror: false, space: 'body', cooldown_ms: 0, action_mode: 'single_press',
        steps: [{
            id: `${action}_settle`, mode: 'simultaneous',
            hold_ms: direction === 'neutral' ? 120 : 60,
            constraints: [{ id: `${action}_zone`, landmark: `${wrist}_wrist`,
                cell: wristZones[wrist][direction], type: 'trigger', priority: 'high' }]
        }]
    };
}

// Six directions plus two internal neutral confirmations. Native MIG owns the
// dwell timers and current-occupancy checks; the host only sequences its events.
export const arcadeProfile = {
    schema_version: 2, tracking: { hands: false },
    inputs: WRISTS.flatMap(wrist => ['neutral', ...DIRECTIONS].map(direction => region(wrist, direction)))
};
