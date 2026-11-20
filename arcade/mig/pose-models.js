// BlazePose GHUM pose models for the vendored MIG runtime (npm 1.2.0 bundles Lite only).
// Pinned MediaPipe release, float16 v1, Apache-2.0. Full and Heavy come from Google's
// model storage once, are checked by size and SHA-256, then kept in Cache Storage.
export const POSE_MODELS = Object.freeze({
    lite: { file: 'pose_landmarker_lite.task', size: 5777746, bundled: true,
        sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a' },
    full: { file: 'pose_landmarker_full.task', size: 9398198, bundled: false,
        sha256: '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1' },
    heavy: { file: 'pose_landmarker_heavy.task', size: 30664242, bundled: false,
        sha256: '64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b' }
});
const STORAGE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/';
const CACHE = 'mig-pose-models';

export function modelURL(name, runtime) {
    const model = POSE_MODELS[name];
    if (!model) throw new RangeError(`Unknown pose model: ${name}`);
    return model.bundled ? new URL(`models/${model.file}`, runtime).href
        : `${STORAGE}${model.file.replace('.task', '')}/float16/1/${model.file}`;
}

async function sha256(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verified(bytes, model) {
    if (bytes.byteLength !== model.size) throw new Error('The tracking model download was incomplete. Try again.');
    if (await sha256(bytes) !== model.sha256) throw new Error('The tracking model failed its integrity check and was rejected.');
    return new Uint8Array(bytes);
}

async function openCache() {
    try { return await globalThis.caches?.open(CACHE) ?? null; } catch { return null; }
}

/** Verified model bytes; `source` says whether they were bundled, cached or just downloaded. */
export async function poseModelBytes(name, runtime, fetcher = globalThis.fetch) {
    const model = POSE_MODELS[name], url = modelURL(name, runtime);
    const cache = model.bundled ? null : await openCache();
    const cached = await cache?.match(url);
    if (cached) {
        try { return { bytes: await verified(await cached.arrayBuffer(), model), source: 'cache' }; }
        catch { await cache.delete(url).catch(() => {}); }
    }
    const response = await fetcher(url).catch(() => null);
    if (!response?.ok) throw new Error('This precision needs a one-time download. Connect to the internet or choose Low.');
    const bytes = await response.arrayBuffer();
    const result = await verified(bytes, model);
    await cache?.put(url, new Response(bytes)).catch(() => {});
    return { bytes: result, source: model.bundled ? 'bundled' : 'download' };
}

export async function isPoseModelReady(name, runtime) {
    if (POSE_MODELS[name]?.bundled) return true;
    const cache = await openCache();
    return Boolean(await cache?.match(modelURL(name, runtime)).catch(() => null));
}

/**
 * The `loadModels` dependency MIGSession calls. GPU requests fall back to CPU when
 * WebGL inference cannot start; `report` receives the delegate actually used.
 */
export function precisionModelLoader(runtime, { model = 'lite', delegate = 'CPU', report = () => {} } = {}) {
    return async ({ hands = false } = {}) => {
        const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import(new URL('vision/vision_bundle.mjs', runtime).href);
        const files = await FilesetResolver.forVisionTasks(new URL('vision/wasm', runtime).href);
        const { bytes, source } = await poseModelBytes(model, runtime);
        let used = delegate;
        const createPose = choice => PoseLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetBuffer: bytes, delegate: choice }, runningMode: 'VIDEO', numPoses: 1 });
        let pose;
        try { pose = await createPose(delegate); }
        catch (error) { if (delegate !== 'GPU') throw error; used = 'CPU'; pose = await createPose('CPU'); }
        report({ model, delegate: used, requested: delegate, source });
        const loadHands = () => HandLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: new URL('models/hand_landmarker.task', runtime).href, delegate: used },
            runningMode: 'VIDEO', numHands: 2 });
        try {
            return { pose, hands: hands ? await loadHands() : null, loadHands };
        } catch (error) {
            pose.close();
            throw error;
        }
    };
}
