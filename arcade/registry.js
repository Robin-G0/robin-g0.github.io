import * as phosphor from './games/phosphor.js';
import * as desktop from './games/desktop95.js';
import * as web from './games/construction.js';
import * as matrix from './games/matrix.js';
import * as chrome from './games/y2k.js';
import * as aqua from './games/aqua.js';
import * as aero from './games/aero.js';
import * as metro from './games/metro.js';
import * as paper from './games/material.js';
import * as glass from './games/glass.js';
import * as notes from './games/field-notes.js';

// This is the only executable registry. Imports cannot add module paths to it.
export const engines = Object.freeze({
    invaders: phosphor.invaders, lander: phosphor.lander, snake: phosphor.snake,
    sort: desktop.sort, stack: desktop.stack, ski: desktop.ski,
    popups: web.popups, maze: web.maze, juggle: web.juggle,
    parry: matrix.parry, binary: matrix.binary, gravity: matrix.gravity,
    orbital: chrome.orbital, beat: chrome.beat, reactor: chrome.reactor,
    marble: aqua.marble, gel: aqua.gel, dock: aqua.dock,
    school: aero.school, bubbles: aero.bubbles, garden: aero.garden,
    memory: metro.memory, merge: metro.merge, rail: metro.rail,
    tangram: paper.tangram, golf: paper.golf, balance: paper.balance,
    prisms: glass.prisms, abyss: glass.abyss, orbit: glass.orbit,
    clockwork: notes.clockwork, contour: notes.contour, stars: notes.constellations
});
