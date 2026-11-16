const STORAGE_KEY = 'mig-arcade-bindings-v1';
const MAX_BYTES = 1024 * 1024;

function readProfile(source) {
    if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_BYTES)
        throw new Error('Choose a MIG JSON configuration smaller than 1 MiB.');
    const profile = JSON.parse(source);
    if (profile?.schema_version !== 2 || !Array.isArray(profile.inputs) || !profile.inputs.length)
        throw new Error('Choose a MIG configuration with schema_version 2 and at least one input.');
    const ids = new Set();
    for (const input of profile.inputs) {
        if (typeof input?.id !== 'string' || !input.id || ids.has(input.id))
            throw new Error('Every binding needs a unique input ID.');
        ids.add(input.id);
    }
    return profile;
}

/** Validate and normalize with the deployed MIG engine, without starting models/camera. */
export async function validateBindings(source, load = () => import('../../vendor/motion-input-grid/runtime/mig-tracker.mjs')) {
    readProfile(source);
    const { MIGTracker } = await load();
    const tracker = await MIGTracker.create(source);
    try { return readProfile(tracker.exportJSON()); }
    finally { tracker.dispose(); }
}

function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
export const bindingName = input => String(input.name || input.action || input.id).slice(0,80);
export function controlLabels(description) {
    if(description.engine==='lander')return {left:'L thruster',right:'R thruster'};
    if (description.engine === 'maze') return {left:'L route',right:'R route'};
    if (description.engine === 'juggle') return {left:'L bounce',right:'R bounce'};
    return description.controls;
}

/** Only rules are copied. Engine identity, difficulty and scoring remain game-owned. */
export function compileBindings(description, defaults, imported, assignments = {}) {
    const controls = Object.keys(description.controls);
    const selected = new Map(imported?.inputs.map(input => [input.id,input]) || []);
    const chosen = controls.filter(control => selected.has(assignments[control]));
    if (!chosen.length) return { profile:defaults, mapped:false, labels:{} };
    const labels = {};
    const inputs = controls.map(control => {
        const fallback = defaults.inputs.find(input => input.action === (controls.length === 2 ? `${control}_up` : control));
        const input = selected.get(assignments[control]) || fallback;
        if (!input) throw new Error(`No binding is available for ${control}.`);
        labels[control] = selected.has(assignments[control]) ? bindingName(input) : 'Game default';
        // One native channel per game control also permits sharing a source binding.
        return {...structuredClone(input), id:`arcade_${control}`, action:control};
    });
    return {profile:{...structuredClone(imported),inputs},mapped:true,labels};
}

/** Imported JSON and per-game assignments stay local, with an in-memory fallback. */
export class BindingStore extends EventTarget {
    constructor(storage = browserStorage()) {
        super();
        this.storage = storage; this.profile = null; this.name = ''; this.games = {};
        try {
            const value = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
            if (value?.version !== 1) return;
            this.profile = readProfile(JSON.stringify(value.profile));
            this.name = typeof value.name === 'string' ? value.name.slice(0,120) : 'Imported configuration';
            this.games = value.games && typeof value.games === 'object' && !Array.isArray(value.games) ? value.games : {};
        } catch { this.profile = null; this.games = {}; }
    }
    async importFile(file, validate = validateBindings) {
        if (file.size > MAX_BYTES) throw new Error('Choose a MIG JSON configuration smaller than 1 MiB.');
        const profile = await validate(await file.text());
        this.profile = profile; this.name = file.name.slice(0,120); this.games = {};
        this.save();
    }
    assignments(description) {
        const saved = this.games[description.engine] || {}, result = {};
        const ids = new Set(this.profile?.inputs.map(input=>input.id) || []);
        for (const control of Object.keys(description.controls)) result[control] = ids.has(saved[control]) ? saved[control] : '';
        return result;
    }
    setAssignments(description, assignments) {
        this.games[description.engine] = Object.fromEntries(Object.keys(description.controls).map(control =>
            [control,this.profile?.inputs.some(input=>input.id===assignments[control]) ? assignments[control] : '']));
        this.save();
    }
    clear() { this.profile=null;this.name='';this.games={};this.save(); }
    save() {
        try {this.storage.setItem(STORAGE_KEY,JSON.stringify({version:1,profile:this.profile,name:this.name,games:this.games}));}
        catch { /* The current page remains usable when storage is unavailable. */ }
        this.dispatchEvent(new Event('change'));
    }
}
export const localBindings = new BindingStore();

/** Native recognition owns landmark validity. This only deduplicates mapped pulses. */
export class BindingGate {
    constructor(profile,cooldownMs=0) {
        this.byId=new Map(profile.inputs.map(input=>[input.id,input.action]));
        this.actions=new Set(this.byId.values());this.last=new Map();this.cooldownMs=cooldownMs;
    }
    consume(events) {
        const accepted=[];
        for(const event of events){
            if(!Number.isFinite(event.timestamp))continue;
            const action=event.id ? this.byId.get(event.id) : this.actions.has(event.action) ? event.action : null;
            if(!action)continue;
            const previous=this.last.get(action)??-Infinity;
            if(event.timestamp<=previous || event.timestamp-previous<this.cooldownMs)continue;
            this.last.set(action,event.timestamp);accepted.push({...event,action});
        }
        return accepted;
    }
}
