import {arcadeProfile, popupProfile, constructionLiftProfile} from '../mig/profile.js?v=targets-25';
import {WRIST_DIRECTION_COOLDOWN_MS} from '../games/popup-panic.js?v=survival-17';

/** Host integration policy, separate from engine rules and visual theme materials. */
export function gameConfig(description) {
    const directional = description.inputScheme === 'wrist-directions';
    const lifts = ['maze','juggle'].includes(description.engine);
    return {
        directional,
        profile: directional ? popupProfile : lifts ? constructionLiftProfile : arcadeProfile,
        profileFile: directional ? 'popup-directions' : lifts ? 'construction-lifts' : 'wrist-raises',
        cooldownMs: directional ? WRIST_DIRECTION_COOLDOWN_MS : 0
    };
}
