import { WRIST_COMMANDS, commandLabel } from './core/commands.js';

function entry(theme, engine, title, goal, left, right, duration = 60) {
    return Object.freeze({ id: `${theme}-${engine}`, theme, engine, title, goal,
        controls: engine === 'popups' ? Object.fromEntries(WRIST_COMMANDS.map(action => [action, commandLabel(action)])) : { left, right },
        inputScheme: engine === 'popups' ? 'wrist-directions' : 'wrist-up', duration, difficulty: 'gentle' });
}

export const games = Object.freeze([
    entry('phosphor', 'invaders', 'Terminal Invaders', 'Clear the fleet before it reaches your ship.', 'Move left', 'Move right'),
    entry('phosphor', 'lander', 'Lunar Lander', 'Land softly on the illuminated pad.', 'Thrust', 'Air brake'),
    entry('phosphor', 'snake', 'ASCII Snake', 'Collect the signals without crossing your trail.', 'Turn left', 'Turn right'),
    entry('desktop95', 'sort', 'Folder Sort', 'Send each file to the matching folder.', 'Left folder', 'Right folder'),
    entry('desktop95', 'stack', 'Window Stack', 'Place each moving window on the stack.', 'Place window', 'Reverse slide'),
    entry('desktop95', 'ski', 'Ski Run', 'Pass the gates and avoid the trees.', 'Left lane', 'Right lane'),
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
    entry('metro', 'memory', 'Tile Memory', 'Repeat the sequence shown by the two tiles.', 'Blue tile', 'Purple tile'),
    entry('metro', 'merge', 'Tile Merge', 'Merge equal tiles to build the largest number.', 'Slide left', 'Slide right'),
    entry('metro', 'rail', 'Rail Junction', 'Set the junction and dispatch each train to its station.', 'Switch track', 'Dispatch train'),
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
