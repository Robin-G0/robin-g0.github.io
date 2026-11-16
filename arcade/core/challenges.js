const STORAGE_KEY = 'mig-arcade-challenge-v1';
const difficulties = new Set(['gentle', 'standard']);

function validate(value, catalog) {
    const game = catalog.find(game => game.id === value?.game);
    if (!value || value.v !== 1 || !game ||
        typeof value.name !== 'string' || !/^[A-Z0-9]{5}$/.test(value.name) || !Number.isSafeInteger(value.score) || value.score < 0 ||
        !difficulties.has(value.difficulty) || (value.rules ?? 1) !== (game.scoreVersion || 1)) return null;
    return {v:1, game:value.game, name:value.name, score:value.score, difficulty:value.difficulty,rules:game.scoreVersion || 1};
}

/** Challenge data is a friendly target, never a verified score or executable game. */
export function readChallenge(address, catalog) {
    try {
        const url = new URL(address), data = new URLSearchParams(url.hash.split('?')[1]).get('challenge');
        if (!data || data.length > 512) return null;
        return validate(JSON.parse(data), catalog);
    } catch { return null; }
}

export function challengeLink(address, description, record) {
    const url = new URL(address);
    // Keep payload in the fragment: static hosting does not need to receive it.
    url.search = new URLSearchParams({theme:description.theme}).toString();
    url.hash = `arcade?${new URLSearchParams({challenge:JSON.stringify({v:1,game:description.id,
        difficulty:description.difficulty || 'gentle',name:record.name,score:record.score,rules:description.scoreVersion || 1})})}`;
    return url.href;
}

export function compareChallenge(score, target) {
    if (score > target.score) return `You beat ${target.name} by ${score - target.score}!`;
    if (score === target.score) return `Matched ${target.name}: ${score}`;
    return `${target.name} leads by ${target.score - score}`;
}

function browserSession() { try { return globalThis.sessionStorage; } catch { return null; } }

/** One friend target per tab/session; it never enters the player's own top five. */
export class ChallengeStore {
    constructor(catalog, storage = browserSession()) {
        this.catalog = catalog; this.storage = storage; this.target = null;
        try { this.target = validate(JSON.parse(storage?.getItem(STORAGE_KEY) || 'null'), catalog); } catch {}
    }
    set(value) {
        this.target = validate(value, this.catalog);
        try {
            if (this.target) this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.target));
            else this.storage?.removeItem(STORAGE_KEY);
        } catch { /* Keep the challenge usable in this page when storage is blocked. */ }
    }
    description() {
        const game = this.catalog.find(game => game.id === this.target?.game);
        return game ? {...game,difficulty:this.target.difficulty} : null;
    }
}
