import {arcadeProfile, popupProfile, constructionLiftProfile, wristRaiseProfile} from '../mig/profile.js?v=phosphor-31';
import {WRIST_DIRECTION_COOLDOWN_MS} from '../games/popup-panic.js?v=survival-17';

/** Host integration policy, separate from engine rules and visual theme materials. */
export function gameConfig(description) {
    const directional = ['wrist-directions','flight-directions'].includes(description.inputScheme);
    const lifts = ['maze','juggle'].includes(description.engine);
    const phosphor = ['invaders','lander','snake'].includes(description.engine);
    return {
        directional,
        profile: directional ? popupProfile : lifts ? constructionLiftProfile : phosphor ? wristRaiseProfile : arcadeProfile,
        profileFile: directional ? 'popup-directions' : lifts ? 'construction-lifts' : phosphor ? 'wrist-up-only' : 'wrist-raises',
        cooldownMs: directional ? WRIST_DIRECTION_COOLDOWN_MS : 0,
        portraitBoard: directional || lifts || phosphor,
        outcomeFeedback: phosphor
    };
}
