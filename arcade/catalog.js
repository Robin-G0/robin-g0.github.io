import { WRIST_COMMANDS, commandLabel } from './core/commands.js?v=eras-4';

function entry(theme, engine, title, goal, left, right, options = {}) {
    return Object.freeze({ id: `${theme}-${engine}`, theme, engine, title, goal,
        controls: engine === 'popups' ? Object.fromEntries(WRIST_COMMANDS.map(action => [action, commandLabel(action)])) : { left, right },
        inputScheme: engine === 'popups' ? 'wrist-directions' : 'wrist-up', duration:60, difficulty: 'gentle',
        // Recommended tracking precision: sweeps and fine placement read better on larger models.
        precision: engine === 'popups' ? 'full' : 'low', ...options });
}

export const games = Object.freeze([
    entry('phosphor', 'invaders', 'Terminal Invaders', 'Use cover. Dodge warned shots. Clear the next fleet.', 'Move left', 'Move right', {scoreVersion:3,illustrated:true}),
    entry('phosphor', 'lander', 'Lunar Lander', 'Two thrusters. Line up. Land softly.', 'Left jet', 'Right jet', {scoreVersion:4,illustrated:true}),
    entry('phosphor', 'snake', 'ASCII Snake', 'Route the signal. Queue a corner. Collect the next cache.', 'Turn left', 'Turn right', {scoreVersion:2,illustrated:true}),
    entry('desktop95', 'sort', 'Folder Sort', 'Send each file to the matching folder.', 'Media folder', 'Text folder', {scoreVersion:3,randomizeReplay:true,illustrated:true}),
    entry('desktop95', 'stack', 'Window Stack', 'Place each moving window on the stack.', 'Place window', 'Reverse slide', {scoreVersion:2,illustrated:true}),
    entry('desktop95', 'ski', 'Ski Run', 'Pass the gates and avoid the trees.', 'Left lane', 'Right lane', {scoreVersion:2,illustrated:true}),
    entry('construction', 'popups', 'Pop-up Panic', 'Keep both stacks below the top bar.', 'Clear ←', 'Clear →'),
    entry('construction', 'maze', 'Link Maze', 'Memorise the map. Find home. Keep the clock alive.', 'Raise left wrist', 'Raise right wrist'),
    entry('construction', 'juggle', 'GIF Juggler', 'Catch late. Touch the line for x2. Keep your GIFs online.', 'Raise left wrist', 'Raise right wrist'),
    entry('matrix', 'parry', 'Construct Parry', 'Each wrist guards its side. Answer the arrow in the guard zone: up blocks, sideways sweeps. Late parries score more.', 'Left guard', 'Right guard', {inputScheme:'wrist-directions', controls:{left_left:'L sweep ←', left_up:'L block ↑', left_right:'L sweep →', right_left:'R sweep ←', right_up:'R block ↑', right_right:'R sweep →'}, scoreVersion:2, illustrated:true, precision:'full'}),
    entry('matrix', 'binary', 'Binary Lock', 'Rotate and flip the register until it matches the key. Solve in par for x2.', 'Rotate left', 'Flip head bit', {scoreVersion:2, illustrated:true, precision:'low'}),
    entry('matrix', 'gravity', 'Gravity Switch', 'Run the shaft. Switch walls around ledges, never mid-beam. Chain the code.', 'Left wall', 'Right wall', {scoreVersion:2, illustrated:true, precision:'low'}),
    entry('y2k', 'orbital', 'Orbital Breaker', 'Turn the shield to break each comet. Grab star shards; dodge solar flares.', 'Turn ↺', 'Turn ↻', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('y2k', 'beat', 'Chrome Beat', 'Play each note with its move as it reaches the pad: raise, scratch, chord.', '', '', {scoreVersion:2,illustrated:true,precision:'full',inputScheme:'wrist-directions',controls:{left_left:'L scratch ←',left_up:'L tap ↑',left_right:'L scratch →',right_left:'R scratch ←',right_up:'R tap ↑',right_right:'R scratch →'}}),
    entry('y2k', 'reactor', 'Reactor Balance', 'Pour each orb into a core. Hit exactly 10 to fuse; above 10 melts down.', 'Left core', 'Right core', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('aqua', 'marble', 'Marble Gates', 'Tilt the tray. The marble drops through the first gate it meets. Stay below the ceiling.', 'Tilt left', 'Tilt right', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('aqua', 'gel', 'Gel Factory', 'Stamp the growing gel button when it fits each slot of the sheet.', 'Left slot', 'Right slot', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('aqua', 'dock', 'Dock Bounce', 'Glide along the Dock. Open bouncing apps, force-quit hung ones before they time out.', '', '', {scoreVersion:2,illustrated:true,precision:'full',inputScheme:'wrist-directions',controls:{left_left:'Glide ←',left_up:'Open',left_right:'Glide →',right_left:'Glide ←',right_up:'Force quit',right_right:'Glide →'}}),
    entry('aero', 'school', 'School Rescue', 'Steer the school. Gather strays. Swim through the glass gate to bring them home.', 'Swim left', 'Swim right', {scoreVersion:2,illustrated:true,precision:'full',inputScheme:'wrist-directions',
        controls:{left_left:'Swim left',left_up:'Bubble shield',left_right:'Swim right',right_left:'Swim left',right_up:'Bubble shield',right_right:'Swim right'}}),
    entry('aero', 'bubbles', 'Bubble Cascade', 'Send each bubble up a column. Pop three of a colour. Set up cascades.', 'Left column', 'Right column', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('aero', 'garden', 'Living Garden', 'Rain or shine on the whole garden. Wait for a bigger batch, but not too long.', 'Rain', 'Sunshine', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('metro', 'memory', 'Live Tiles', 'Watch the tiles. Repeat them, or follow along live for x2.', 'Blue tile', 'Purple tile', {scoreVersion:2,illustrated:true}),
    entry('metro', 'merge', 'Tile Drop', 'Place each tile. Merge equal neighbours. Chain them before the drop.', 'Move left', 'Move right', {scoreVersion:4,illustrated:true}),
    entry('metro', 'rail', 'Metro Line', 'Trains leave on time. Set the junctions so each reaches its station. The network grows.', 'Switch junction 1', 'Switch junction 2', {scoreVersion:3,illustrated:true}),
    entry('material', 'tangram', 'Paper Tangram', 'Turn each paper piece into its outline. Flip it when the outline is mirrored.', 'Turn piece', 'Turn piece', {inputScheme:'wrist-directions',controls:{left_left:'Turn left',left_up:'Flip over',left_right:'Turn right',right_left:'Turn left',right_up:'Flip over',right_right:'Turn right'},scoreVersion:2,illustrated:true,precision:'full'}),
    entry('material', 'golf', 'Ripple Golf', 'Chip one cell or drive three. Stop exactly in the cup, around the water, at par.', 'Chip 1', 'Drive 3', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('material', 'balance', 'Paper Balance', 'Lay each card in a tray. Level the mobile to clear it; bigger levels pay more.', 'Left tray', 'Right tray', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('glass', 'prisms', 'Prisms', 'Turn the prism so each crystal catches the ray of its own colour. Light several at once.', 'Turn left', 'Turn right', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('glass', 'abyss', 'Abyss Drift', 'Swim between lanes and pulse to catch the light. Keep glowing; slip past the reefs.', 'Swim / pulse', 'Swim / pulse', {scoreVersion:2,illustrated:true,precision:'full',inputScheme:'wrist-directions',controls:{left_left:'Swim left',left_up:'Pulse',left_right:'Swim right',right_left:'Swim left',right_up:'Pulse',right_right:'Swim right'}}),
    entry('glass', 'orbit', 'Orbital Assist', 'Change orbit to meet each beacon. Inner rings are faster. Dodge the debris.', 'Inner orbit', 'Outer orbit', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('field-notes', 'clockwork', 'Clockwork', 'Keep the pendulum swinging. Strike each pallet as the bob arrives; the jewel at the turn counts double.', 'Left pallet', 'Right pallet', {scoreVersion:2,illustrated:true,precision:'low'}),
    entry('field-notes', 'contour', 'Contour Survey', 'Steer the pencil. Close a loop around the summits. Keep the marsh out and stay on the sheet.', 'Turn left', 'Turn right', {scoreVersion:2,illustrated:true,precision:'medium'}),
    entry('field-notes', 'stars', 'Constellations', 'Watch the figure being inked, then retrace it from memory, pointing toward each next star.', 'Left star', 'Right star', {scoreVersion:2,illustrated:true,precision:'full',inputScheme:'wrist-directions',
        controls:Object.fromEntries(WRIST_COMMANDS.map(action => [action, {left:'Left star', up:'Star above', right:'Right star'}[action.split('_')[1]]]))})
]);

export const gamesForTheme = theme => games.filter(game => game.theme === theme);
