// Original synthesized cues. No audio files, microphone, network or copied OS sounds.
const voices = {
    phosphor: ['square', 147], desktop95: ['triangle', 262], construction: ['square', 220],
    matrix: ['triangle', 196], y2k: ['sawtooth', 165], aqua: ['sine', 392], aero: ['sine', 440],
    metro: ['triangle', 330], material: ['sine', 523], glass: ['sine', 659], 'field-notes': ['triangle', 349]
};

export class ArcadeAudio {
    constructor(theme, createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)()) {
        this.profile = voices[theme] || voices.material;
        this.createContext = createContext; this.enabled = true; this.nodes = new Map();
    }
    unlock() {
        if (!this.enabled || this.disposed) return;
        try {
            if (!this.context) {
                this.context = this.createContext(); this.output = this.context.createGain();
                this.output.gain.value = .035; this.output.connect(this.context.destination);
            }
            this.context.resume()?.catch(() => {});
        } catch { /* Unsupported or blocked audio never blocks play. */ }
    }
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) this.unlock();
        if (this.context && this.output) this.output.gain.setTargetAtTime(this.enabled ? .035 : 0, this.context.currentTime, .01);
        return this.enabled;
    }
    play({ kind = 'input', count = 1, chain = 1, perfect = false, action = 'left' } = {}) {
        if (!this.enabled || this.disposed || this.context?.state !== 'running') return;
        const [type, base] = this.profile;
        const outcomeNotes = { thrust: [-12,-7], brake: [7,0,-5], turn:[action==='left'?0:7],
            bounce: perfect ? [0, 7, 12] : [action === 'left' ? 0 : 7],
            powerup: [0, 4, 7, 12], rescue: [7, 0, 7], miss: [0, -5, -12] };
        const notes = outcomeNotes[kind] || (kind === 'clear'
            ? [0, 4, 7, 12].slice(0, perfect ? 4 : Math.min(3, 1 + Math.floor(count / 2)))
            : [action === 'left' ? 0 : 7]);
        const lift = kind === 'clear' ? Math.min(12, chain - 1) : 0;
        notes.forEach((note, index) => {
            if (this.nodes.size >= 12) return;
            const start = this.context.currentTime + index * .055;
            const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(base * 2 ** ((note + lift) / 12), start);
            envelope.gain.setValueAtTime(0, start);
            envelope.gain.linearRampToValueAtTime(.45, start + .006);
            envelope.gain.exponentialRampToValueAtTime(.001, start + .14);
            oscillator.connect(envelope); envelope.connect(this.output);
            this.nodes.set(oscillator, envelope);
            oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
            oscillator.start(start); oscillator.stop(start + .16);
        });
    }
    dispose() {
        this.disposed = true;
        for (const [node, envelope] of this.nodes) {
            node.onended = null;
            try { node.stop(); } catch { /* Already ended. */ }
            node.disconnect(); envelope.disconnect();
        }
        this.nodes.clear(); this.output?.disconnect(); this.context?.close()?.catch(() => {});
        this.output = null; this.context = null;
    }
}
