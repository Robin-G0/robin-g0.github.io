// The same broad ordered wrist raise as MIG's official browser example.
// Hands/finger inference is unnecessary: body landmarks include both wrists.
export const arcadeProfile = {
    schema_version: 2,
    tracking: { hands: false },
    inputs: ['left', 'right'].map(side => ({
        id: `arcade_${side}`,
        name: `Raise ${side} wrist`,
        action: side,
        space: 'body',
        cooldown_ms: 700,
        action_mode: 'single_press',
        steps: [{
            id: `${side}_raise`, mode: 'ordered',
            constraints: [
                { id: `${side}_rest`, landmark: `${side}_wrist`, cell: [-9, 3, 27, 3],
                    type: 'required', priority: 'high', order: 1 },
                { id: `${side}_finish`, landmark: `${side}_wrist`, cell: [-9, 1, 27, 2],
                    type: 'trigger', priority: 'high', order: 2 },
                { id: `${side}_tolerance`, landmark: `${side}_wrist`, cell: [-9, 0, 27, 3],
                    type: 'trigger', priority: 'low', tolerance_for: `${side}_finish` }
            ]
        }]
    }))
};
