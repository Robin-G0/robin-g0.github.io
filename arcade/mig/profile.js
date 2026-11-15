import { WRISTS, DIRECTIONS } from '../core/commands.js';

// Body cells use unmirrored image X; the preview is mirrored once. A screen-left
// movement therefore increases grid X. Regions stay relative to the shoulders.
export const wristZones = {
    left: { up: [-9, -9, 27, 13], left: [7, 4, 11, 14], right: [-9, 4, 15, 14] },
    right: { up: [-9, -9, 27, 13], left: [3, 4, 15, 14], right: [-9, 4, 11, 14] }
};

function region(wrist, direction) {
    const action = `${wrist}_${direction}`;
    return {
        id: action, name: `${wrist} wrist ${direction}`, action,
        mirror: false, space: 'body', cooldown_ms: 0, action_mode: 'single_press',
        steps: [{
            id: `${action}_settle`, mode: 'simultaneous',
            hold_ms: 120,
            constraints: [
                // Required occupancy makes hold_ms continuous. A trigger alone
                // does not reset the native step timer when the wrist leaves.
                { id: `${action}_hold`, landmark: `${wrist}_wrist`,
                    cell: wristZones[wrist][direction], type: 'required', priority: 'high' },
                { id: `${action}_zone`, landmark: `${wrist}_wrist`,
                    cell: wristZones[wrist][direction], type: 'trigger', priority: 'high' }
            ]
        }]
    };
}

// A small gap separates directions. Native dwell filters jitter, and Single Press
// suppresses held repeats. Leaving a target is enough: no precise home return.
// Extend outward to the schema's [-9,18) limits, rather than adding far-edge misses.
export const arcadeProfile = {
    schema_version: 2, tracking: { hands: false },
    inputs: WRISTS.flatMap(wrist => DIRECTIONS.map(direction => region(wrist, direction)))
};
