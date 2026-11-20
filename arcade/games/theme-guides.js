// One registration point for theme-owned teaching material. Each theme edits only its own module.
import {phosphorDiagrams, phosphorCaptions} from './phosphor/tutorials.js?v=eras-3';
import {desktop95Diagrams, desktop95Captions} from './desktop95-tutorials.js?v=eras-3';
import {metroDiagrams, metroCaptions} from './metro/tutorials.js?v=eras-3';
import * as matrix from './matrix/tutorials.js?v=eras-3';
import * as y2k from './y2k/tutorials.js?v=eras-3';
import * as aqua from './aqua/tutorials.js?v=eras-3';
import * as aero from './aero/tutorials.js?v=eras-3';
import * as material from './material/tutorials.js?v=eras-3';
import * as glass from './glass/tutorials.js?v=eras-3';
import * as fieldNotes from './field-notes/tutorials.js?v=eras-3';

const reworked = [matrix, y2k, aqua, aero, material, glass, fieldNotes];
const merge = key => Object.assign({}, ...reworked.map(theme => theme[key] ?? {}));
export const themeDiagrams = { ...desktop95Diagrams, ...phosphorDiagrams, ...metroDiagrams, ...merge('diagrams') };
export const themeCaptions = { ...desktop95Captions, ...phosphorCaptions, ...metroCaptions, ...merge('captions') };
export const themeLessons = merge('lessons');
