import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRESETS, presetsFor, resolvePreset, recommendedPreset, presetForLevel, meetsLevel, detectGraphics,
    readPrecision, savePrecision, isMobileDevice } from '../arcade/mig/precision.js';
import { POSE_MODELS, modelURL, poseModelBytes, precisionModelLoader } from '../arcade/mig/pose-models.js';
import { shortRenderer } from '../assets/experience.js';
import { games } from '../arcade/catalog.js';

const runtime = 'https://example.test/vendor/runtime/';

test('computers get five presets, phones three plain levels with the same model ladder', () => {
    assert.deepEqual(presetsFor(false).map(p => p.id), ['low', 'medium', 'medium-fast', 'full', 'full-fast']);
    assert.deepEqual(presetsFor(true).map(p => p.id), ['low', 'medium', 'full']);
    assert.deepEqual(presetsFor(false).map(p => [p.model, p.delegate]),
        [['lite', 'CPU'], ['full', 'CPU'], ['full', 'GPU'], ['heavy', 'CPU'], ['heavy', 'GPU']]);
    assert.deepEqual(presetsFor(true).map(p => [p.model, p.delegate]), [['lite', 'CPU'], ['full', 'GPU'], ['heavy', 'GPU']]);
    assert.equal(resolvePreset('full-fast', true), null, 'phones have no separate fast levels');
    assert.equal(resolvePreset('nope', false), null);
});

test('Full is recommended with a graphics card; CPU-only computers and phones start on Medium', () => {
    assert.equal(recommendedPreset({ mobile: false, gpu: true }), 'full-fast');
    assert.equal(recommendedPreset({ mobile: false, gpu: false }), 'medium');
    assert.equal(recommendedPreset({ mobile: true, gpu: true }), 'medium');
});

test('a game level maps to a device preset and tells whether the current preset is enough', () => {
    assert.equal(presetForLevel('full', { mobile: false, gpu: true }), 'full-fast');
    assert.equal(presetForLevel('full', { mobile: false, gpu: false }), 'medium');
    assert.equal(presetForLevel('medium', { mobile: false, gpu: true }), 'medium-fast');
    assert.equal(presetForLevel('full', { mobile: true, gpu: true }), 'full');
    assert.equal(meetsLevel(PRESETS.low, 'full'), false);
    assert.equal(meetsLevel(PRESETS['full-fast'], 'full'), true);
    assert.equal(meetsLevel(PRESETS.medium, 'medium'), true);
    assert.equal(meetsLevel(PRESETS.low, undefined), true);
    for (const game of games) assert.ok(['low', 'medium', 'full'].includes(game.precision), game.id);
    assert.equal(games.find(game => game.engine === 'popups').precision, 'full', 'sweeps recommend Full');
});

test('the saved choice is validated per device and survives unavailable storage', () => {
    const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(readPrecision(storage, false), null);
    savePrecision('full-fast', storage, false);
    assert.equal(readPrecision(storage, false), 'full-fast');
    assert.equal(readPrecision(storage, true), null, 'a desktop-only preset is not reused on a phone');
    assert.throws(() => savePrecision('ultra', storage, false), RangeError);
    store.set('robin-g0-precision', '{broken');
    assert.equal(readPrecision(storage, false), null);
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.equal(readPrecision(blocked, false), null);
    assert.equal(savePrecision('low', blocked, false), 'low');
});

test('a software rasteriser or missing WebGL 2 is not a graphics card', () => {
    const canvas = renderer => () => ({ getContext: () => renderer === null ? null : {
        RENDERER: 1, getExtension: name => name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 2 } : { loseContext() {} },
        getParameter: () => renderer } });
    assert.equal(detectGraphics(canvas('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).gpu, true);
    assert.equal(detectGraphics(canvas('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).gpu, false);
    assert.equal(detectGraphics(canvas('llvmpipe (LLVM 15.0.7, 256 bits)')).gpu, false);
    assert.equal(detectGraphics(canvas(null)).gpu, false);
    assert.equal(detectGraphics(() => { throw new Error('no canvas'); }).gpu, false);
    assert.equal(shortRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'NVIDIA GeForce RTX 3060');
    assert.equal(shortRenderer('Apple M2'), 'Apple M2');
});

test('phones are recognised from client hints, user agent or touch-first iPads', () => {
    assert.equal(isMobileDevice({ navigator: { userAgentData: { mobile: true } } }), true);
    assert.equal(isMobileDevice({ navigator: { userAgentData: { mobile: false }, userAgent: 'Android' } }), false);
    assert.equal(isMobileDevice({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' } }), true);
    assert.equal(isMobileDevice({ navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 5 }, matchMedia: () => ({ matches: true }) }), true);
    assert.equal(isMobileDevice({ navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }, matchMedia: () => ({ matches: false }) }), false);
});

async function digest(bytes) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
async function withFixture(name, text, run) {
    const model = POSE_MODELS[name], saved = { size: model.size, sha256: model.sha256 };
    const bytes = new TextEncoder().encode(text);
    Object.assign(model, { size: bytes.byteLength, sha256: await digest(bytes) });
    try { await run(bytes); } finally { Object.assign(model, saved); }
}
function memoryCache() {
    const store = new Map();
    globalThis.caches = { async open() { return {
        async match(url) { return store.has(url) ? new Response(store.get(url)) : undefined; },
        async put(url, response) { store.set(url, new Uint8Array(await response.arrayBuffer())); },
        async delete(url) { return store.delete(url); } }; } };
    return store;
}

test('Full and Heavy download once, are verified before caching and then work offline', async () => {
    assert.equal(modelURL('lite', runtime), `${runtime}models/pose_landmarker_lite.task`);
    assert.match(modelURL('heavy', runtime), /storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_heavy\/float16\/1\//);
    const store = memoryCache();
    await withFixture('heavy', 'heavy bytes', async bytes => {
        const online = async () => new Response(bytes), offline = async () => { throw new TypeError('offline'); };
        assert.equal((await poseModelBytes('heavy', runtime, online)).source, 'download');
        assert.equal((await poseModelBytes('heavy', runtime, offline)).source, 'cache');
        store.set(modelURL('heavy', runtime), new TextEncoder().encode('heavy bytez'));
        assert.equal((await poseModelBytes('heavy', runtime, online)).source, 'download', 'a damaged cache entry is replaced');
        store.clear();
        await assert.rejects(poseModelBytes('heavy', runtime, async () => new Response(bytes.slice(2))), /incomplete/);
    });
    store.clear();
    await withFixture('full', 'full bytes', async () => {
        await assert.rejects(poseModelBytes('full', runtime, async () => new Response('full bytez')), /integrity/);
        assert.equal(store.size, 0, 'rejected files never enter the cache');
        await assert.rejects(poseModelBytes('full', runtime, async () => { throw new TypeError('offline'); }), /internet or choose Low/);
    });
    delete globalThis.caches;
});

test('the loader falls back from GPU to CPU and reports the delegate actually used', async () => {
    const created = [];
    globalThis.__fakeVision = {
        FilesetResolver: { forVisionTasks: async () => ({}) },
        PoseLandmarker: { createFromOptions: async (files, options) => {
            created.push(options.baseOptions.delegate);
            if (options.baseOptions.delegate === 'GPU') throw new Error('no WebGL');
            return { close() {} };
        } },
        HandLandmarker: { createFromOptions: async () => ({ close() {} }) }
    };
    const dir = await import('node:fs/promises').then(fs => fs.mkdtemp((process.env.TEMP || '/tmp') + '/vision-'));
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(`${dir}/vision`, { recursive: true });
    await writeFile(`${dir}/vision/vision_bundle.mjs`, 'export const {FilesetResolver,PoseLandmarker,HandLandmarker}=globalThis.__fakeVision;');
    const base = (await import('node:url')).pathToFileURL(dir + '/').href;
    await withFixture('lite', 'lite bytes', async bytes => {
        globalThis.fetch = async () => new Response(bytes);
        let report = null;
        const load = precisionModelLoader(base, { model: 'lite', delegate: 'GPU', report: value => { report = value; } });
        const models = await load({ hands: false });
        assert.deepEqual(created, ['GPU', 'CPU']);
        assert.deepEqual(report, { model: 'lite', delegate: 'CPU', requested: 'GPU', source: 'bundled' });
        assert.equal(models.hands, null);
        assert.equal(typeof models.loadHands, 'function');
    });
    delete globalThis.__fakeVision;
});
