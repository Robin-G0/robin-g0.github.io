import { WRIST_COMMANDS, commandLabel } from './core/commands.js';

function entry(theme, engine, title, goal, left, right, options = {}) {
    return Object.freeze({ id: `${theme}-${engine}`, theme, engine, title, goal,
        controls: engine === 'popups' ? Object.fromEntries(WRIST_COMMANDS.map(action => [action, commandLabel(action)])) : { left, right },
        inputScheme: engine === 'popups' ? 'wrist-directions' : 'wrist-up', duration:60, difficulty: 'gentle', ...options });
}

export const games = Object.freeze([
    entry('phosphor', 'invaders', 'Terminal Invaders', 'Use cover. Dodge warned shots. Clear the next fleet.', 'Move left', 'Move right', {scoreVersion:3}),
    entry('phosphor', 'lander', 'Lunar Lander', 'Two thrusters. Line up. Land softly.', 'Left jet', 'Right jet', {scoreVersion:4}),
    entry('phosphor', 'snake', 'ASCII Snake', 'Route the signal. Queue a corner. Collect the next cache.', 'Turn left', 'Turn right', {scoreVersion:2}),
    entry('desktop95', 'sort', 'Folder Sort', 'Send each file to the matching folder.', 'Media folder', 'Text folder', {scoreVersion:3,randomizeReplay:true}),
    entry('desktop95', 'stack', 'Window Stack', 'Place each moving window on the stack.', 'Place window', 'Reverse slide', {scoreVersion:2}),
    entry('desktop95', 'ski', 'Ski Run', 'Pass the gates and avoid the trees.', 'Left lane', 'Right lane', {scoreVersion:2}),
    entry('construction', 'popups', 'Pop-up Panic', 'Keep both stacks below the top bar.', 'Clear ←', 'Clear →'),
    entry('construction', 'maze', 'Link Maze', 'Memorise the map. Find home. Keep the clock alive.', 'Raise left wrist', 'Raise right wrist'),
    entry('construction', 'juggle', 'GIF Juggler', 'Catch late. Touch the line for x2. Keep your GIFs online.', 'Raise left wrist', 'Raise right wrist'),
    entry('matrix', 'parry', 'Construct Parry', 'Block the incoming attacks on the marked side.', 'Left guard', 'Right guard'),
    entry('matrix', 'binary', 'Binary Lock', 'Transform the register into the target code.', 'Rotate bits', 'Flip first bit'),
    entry('matrix', 'gravity', 'Gravity Switch', 'Switch surfaces to pass the moving barriers.', 'Flip gravity', 'Slow time'),
    entry('y2k', 'orbital', 'Orbital Breaker', 'Return the chrome ball with your orbital shield.', 'Rotate left', 'Rotate right'),
    entry('y2k', 'beat', 'Chrome Beat', 'Hit each note as it reaches its glowing line.', 'Left beat', 'Right beat'),
    entry('y2k', 'reactor', 'Reactor Balance', 'Produce energy while keeping the reactor stable.', 'Vent heat', 'Add charge'),
    entry('aqua', 'marble', 'Marble Gates', 'Roll the marble through each opening.', 'Tilt left', 'Tilt right'),
    entry('aqua', 'gel', 'Gel Factory', 'Inflate each gel bubble to fit its container.', 'Add gel', 'Release bubble'),
    entry('aqua', 'dock', 'Dock Shuffle', 'Restore the order shown above the dock.', 'Swap first pair', 'Swap last pair'),
    entry('aero', 'school', 'School Rescue', 'Open the right gate when a school reaches it.', 'Left gate', 'Right gate'),
    entry('aero', 'bubbles', 'Bubble Cascade', 'Choose an arc and burst clusters of bubbles.', 'Change arc', 'Launch bubble'),
    entry('aero', 'garden', 'Living Garden', 'Keep the growing plants watered and lit.', 'Water plant', 'Give sunlight'),
    entry('metro', 'memory', 'Live Tiles', 'Watch the tiles. Repeat them, or follow along live for x2.', 'Blue tile', 'Purple tile', {scoreVersion:2}),
    entry('metro', 'merge', 'Tile Drop', 'Place each tile. Merge equal neighbours. Chain them before the drop.', 'Move left', 'Move right', {scoreVersion:3}),
    entry('metro', 'rail', 'Metro Line', 'Set the junction. Dispatch each train to its station. Keep the platform clear.', 'Switch junction', 'Dispatch train', {scoreVersion:2}),
    entry('material', 'tangram', 'Paper Tangram', 'Rotate and stamp each shape into its matching outline.', 'Rotate shape', 'Stamp shape'),
    entry('material', 'golf', 'Ripple Golf', 'Send the paper ball into the cup using a measured stroke.', 'Change power', 'Take stroke'),
    entry('material', 'balance', 'Paper Balance', 'Keep the hanging mobile balanced as paper pieces arrive.', 'Weight left', 'Weight right'),
    entry('glass', 'prisms', 'Prisms', 'Turn the selected mirror and guide the light to its target.', 'Rotate mirror', 'Next mirror'),
    entry('glass', 'abyss', 'Abyss Drift', 'Guide the jellyfish through the opening in each reef.', 'Swim up', 'Gentle dive'),
    entry('glass', 'orbit', 'Orbital Assist', 'Launch a probe through the planet’s gravitational field.', 'Change angle', 'Launch probe'),
    entry('field-notes', 'clockwork', 'Clockwork', 'Align both hands with the marks on the mechanism.', 'First gear', 'Second gear'),
    entry('field-notes', 'contour', 'Contour Survey', 'Draw a closed boundary around the survey point.', 'Turn pencil', 'Draw segment'),
    entry('field-notes', 'stars', 'Constellations', 'Connect the stars in the order shown in the reference.', 'Next star', 'Draw connection')
]);

export const gamesForTheme = theme => games.filter(game => game.theme === theme);
