// Tracking precision: which BlazePose model runs, and on which processor.
// "Fast" means the GPU (WebGL) delegate; the loader falls back to CPU when it fails.
const STORAGE_KEY = 'robin-g0-precision';

export const PRESETS = Object.freeze({
    low: Object.freeze({ id: 'low', label: 'Low', model: 'lite', delegate: 'CPU', size: '6 MB',
        detail: 'Lite model on the processor. Fastest, works everywhere.' }),
    medium: Object.freeze({ id: 'medium', label: 'Medium', model: 'full', delegate: 'CPU', size: '9 MB',
        detail: 'Full model on the processor. Steadier wrists and shoulders.' }),
    'medium-fast': Object.freeze({ id: 'medium-fast', label: 'Medium fast', model: 'full', delegate: 'GPU', size: '9 MB',
        detail: 'Full model on the graphics card. Steady and quick.' }),
    full: Object.freeze({ id: 'full', label: 'Full', model: 'heavy', delegate: 'CPU', size: '31 MB',
        detail: 'Heavy model on the processor. Most precise, slowest without a graphics card.' }),
    'full-fast': Object.freeze({ id: 'full-fast', label: 'Full fast', model: 'heavy', delegate: 'GPU', size: '31 MB',
        detail: 'Heavy model on the graphics card. Most precise tracking.' })
});

// Phones get three plain levels. Their Medium and Full use the GPU, with the same CPU fallback.
const MOBILE = Object.freeze({
    low: PRESETS.low,
    medium: Object.freeze({ ...PRESETS['medium-fast'], id: 'medium', label: 'Medium',
        detail: 'Full model. Steadier wrists and shoulders.' }),
    full: Object.freeze({ ...PRESETS['full-fast'], id: 'full', label: 'Full',
        detail: 'Heavy model. Most precise, larger download and more battery.' })
});

export function isMobileDevice(environment = globalThis) {
    const agent = environment.navigator?.userAgentData;
    if (typeof agent?.mobile === 'boolean') return agent.mobile;
    const ua = environment.navigator?.userAgent ?? '';
    const coarse = environment.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && /Macintosh/.test(ua) && environment.navigator?.maxTouchPoints > 1);
}

export function presetsFor(mobile) {
    return mobile ? Object.values(MOBILE) : Object.values(PRESETS);
}

export function resolvePreset(id, mobile) {
    return (mobile ? MOBILE : PRESETS)[id] ?? null;
}

/** A real graphics card, as opposed to no WebGL 2 or a software rasteriser. */
export function detectGraphics(createCanvas = () => document.createElement('canvas')) {
    try {
        const gl = createCanvas().getContext('webgl2');
        if (!gl) return { gpu: false, renderer: '' };
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        const software = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer);
        return { gpu: !software, renderer };
    } catch {
        return { gpu: false, renderer: '' };
    }
}

/**
 * Full is preferred when it can stay responsive: with a graphics card on a computer.
 * Heavy on a processor alone drops below the observation rate recognition needs,
 * and on phones its 31 MB download and battery cost make Medium the better start.
 */
export function recommendedPreset({ mobile, gpu }) {
    if (mobile) return 'medium';
    return gpu ? 'full-fast' : 'medium';
}

const MODEL_RANK = { lite: 0, full: 1, heavy: 2 };
const LEVEL_MODEL = { low: 'lite', medium: 'full', full: 'heavy' };

/** The device preset matching a game's recommended level; CPU-only computers stop at Medium. */
export function presetForLevel(level, { mobile, gpu }) {
    if (mobile || level === 'low') return level in LEVEL_MODEL ? level : 'low';
    if (level === 'medium') return gpu ? 'medium-fast' : 'medium';
    return gpu ? 'full-fast' : 'medium';
}

/** Whether a preset's model is at least as precise as a game's recommended level. */
export function meetsLevel(preset, level = 'low') {
    return MODEL_RANK[preset.model] >= MODEL_RANK[LEVEL_MODEL[level] ?? 'lite'];
}

export const LEVEL_LABELS = Object.freeze({ low: 'Low', medium: 'Medium', full: 'Full' });

export function readPrecision(storage = globalThis.localStorage, mobile = isMobileDevice()) {
    try {
        const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
        if (saved?.version === 1 && resolvePreset(saved.preset, mobile)) return saved.preset;
    } catch { /* A damaged or unavailable entry means no choice yet. */ }
    return null;
}

export function savePrecision(id, storage = globalThis.localStorage, mobile = isMobileDevice()) {
    if (!resolvePreset(id, mobile)) throw new RangeError(`Unknown precision: ${id}`);
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, preset: id })); }
    catch { /* The choice still applies to this visit. */ }
    return id;
}
