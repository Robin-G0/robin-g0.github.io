import {arcadeProfile, popupProfile, constructionLiftProfile, wristRaiseProfile} from '../mig/profile.js?v=eras-2';
import {WRIST_DIRECTION_COOLDOWN_MS} from '../games/popup-panic.js?v=eras-2';
import {PRESSURE_RULES} from './pressure.js?v=eras-2';

// What the third HUD cell counts. Round puzzles spend attempts on timeouts, survival games
// spend lives, one-life or stack/clock games show nothing there.
const livesLabels = { merge: null, popups: null, maze: null, memory: 'Lives' };
export function livesLabel(engine) {
    if (engine in livesLabels) return livesLabels[engine];
    return PRESSURE_RULES[engine]?.kind === 'rounds' ? 'Attempts' : 'Lives';
}

/** Host integration policy, separate from engine rules and visual theme materials. */
export function gameConfig(description) {
    const directional = description.inputScheme==='wrist-directions';
    const lifts = ['maze','juggle'].includes(description.engine);
    // Reworked engines draw their own outcome feedback and use the two-raise profile (catalog flag).
    const illustrated = description.illustrated === true;
    return {
        directional,
        profile: directional ? popupProfile : lifts ? constructionLiftProfile : illustrated ? wristRaiseProfile : arcadeProfile,
        profileFile: directional ? 'popup-directions' : lifts ? 'construction-lifts' : illustrated ? 'wrist-up-only' : 'wrist-raises',
        cooldownMs: directional ? WRIST_DIRECTION_COOLDOWN_MS : 0,
        portraitBoard: directional || lifts || illustrated,
        outcomeFeedback: illustrated,
        livesLabel: livesLabel(description.engine)
    };
}
