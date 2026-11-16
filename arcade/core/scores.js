export const SCORE_KEY = 'mig-arcade-scores-v1';
const MAX_GAMES = 64, MAX_ENTRIES = 5;
const validName = name => typeof name === 'string' && /^[A-Z0-9]{5}$/.test(name);

export function scoreKey(description) {
    return `${description.engine}:${description.difficulty || 'gentle'}`;
}

function browserStorage() {
    try { return globalThis.localStorage; } catch { return null; }
}

/** Local top five, with bounded/validated data and a usable storage-denied fallback. */
export class ScoreStore {
    constructor(storage = browserStorage(), now = () => Date.now()) {
        this.storage = storage; this.now = now; this.serial = 0; this.saved = false;
        this.data = { version: 1, name: 'GUEST', games: {} };
        try {
            const source = JSON.parse(storage?.getItem(SCORE_KEY) || 'null');
            if (source?.version !== 1 || !source.games || typeof source.games !== 'object') return;
            if (validName(source.name)) this.data.name = source.name;
            for (const [key, rows] of Object.entries(source.games).slice(-MAX_GAMES)) {
                if (!/^[a-z0-9:-]{1,140}$/.test(key) || !Array.isArray(rows)) continue;
                this.data.games[key] = rows.filter(row => row && validName(row.name) &&
                    typeof row.id === 'string' && /^[a-z0-9-]{1,64}$/.test(row.id) &&
                    Number.isSafeInteger(row.score) && row.score >= 0 && Number.isFinite(row.at))
                    .sort((a,b) => b.score-a.score || a.at-b.at).slice(0,MAX_ENTRIES);
            }
        } catch { /* Corrupt or blocked storage starts a clean in-memory board. */ }
    }
    list(description) { return [...(this.data.games[scoreKey(description)] || [])]; }
    hasScore(description) { return this.list(description).length > 0; }
    write() {
        try { this.storage.setItem(SCORE_KEY, JSON.stringify(this.data)); this.saved = true; }
        catch { this.saved = false; }
    }
    record(description, score) {
        if (!Number.isSafeInteger(score) || score < 0) return null;
        const key = scoreKey(description), rows = this.list(description);
        const entry = { id: `${this.now().toString(36)}-${this.serial++}`, name: this.data.name, score, at: this.now() };
        rows.push(entry); rows.sort((a,b) => b.score-a.score || a.at-b.at);
        this.data.games[key] = rows.slice(0,MAX_ENTRIES);
        const keys = Object.keys(this.data.games);
        if (keys.length > MAX_GAMES) delete this.data.games[keys[0]];
        this.write();
        return this.data.games[key]?.some(row => row.id === entry.id) ? entry.id : null;
    }
    rename(description, id, name) {
        if (!validName(name)) return false;
        const row = this.data.games[scoreKey(description)]?.find(entry => entry.id === id);
        if (!row) return false;
        row.name = name; this.data.name = name; this.write(); return true;
    }
}

// Share the in-memory fallback across rooms when this browser blocks storage.
export const localScores = new ScoreStore();
