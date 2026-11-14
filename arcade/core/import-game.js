const keys = new Set(['schema_version', 'id', 'engine', 'title', 'goal', 'duration', 'seed', 'difficulty']);

function text(value, limit, label) {
    if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f]/.test(value)) {
        throw new Error(`${label} must be a short, single-line text.`);
    }
    return value.trim();
}

/** Imports are descriptions of trusted engines, never scripts, HTML or URLs. */
export function parseGameFile(source, trustedGames, theme) {
    if (typeof source !== 'string' || new TextEncoder().encode(source).length > 32768) {
        throw new Error('Choose a game JSON file smaller than 32 KB.');
    }
    const data = JSON.parse(source);
    if (!data || Array.isArray(data) || typeof data !== 'object' || data.schema_version !== 1) {
        throw new Error('Expected a game file with schema_version: 1.');
    }
    if (Object.keys(data).some(key => !keys.has(key))) {
        throw new Error('This file contains unsupported fields. Game files contain data only.');
    }
    const template = trustedGames.find(game => game.engine === data.engine);
    if (!template) throw new Error('Choose one of the installed game engines.');
    const id = text(data.id, 40, 'Game id');
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Game id must use lowercase letters, digits and hyphens.');
    const duration = data.duration ?? 60;
    if (!Number.isInteger(duration) || duration < 30 || duration > 90) throw new Error('Duration must be 30 to 90 seconds.');
    const seed = data.seed ?? 1;
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer.');
    const difficulty = data.difficulty ?? 'gentle';
    if (!['gentle', 'standard'].includes(difficulty)) throw new Error('Difficulty must be gentle or standard.');
    return Object.freeze({ ...template, id: `import-${id}`, theme, duration, seed, difficulty,
        title: text(data.title, 48, 'Title'), goal: text(data.goal, 120, 'Goal'), imported: true });
}
