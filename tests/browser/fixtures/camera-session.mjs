// Deterministic public SDK events for UI tests, not a pose detector or production code.
export class MIGSession {
    constructor(options) {
        this.options = options; this.state = { running: false }; this.points = []; this.activeActions = new Set(); this.inputs = [];
        this.tracker = { active: index => this.activeActions.has(this.inputs[index]?.action) };
        window.motionTest = {
            fps: options.maxInferenceFps,
            observe: (visible = true, missing = null) => {
                this.points = visible ? [11, 12, 15, 16].map(index => index === missing ? null
                    : ({ x: index === 11 ? .65 : index === 12 ? .35 : index === 15 ? .7 : .3, y: index < 15 ? .35 : .65, confidence: .95 })) : [];
                this.options.onFrame(this);
            },
            move: (side, x, y) => { this.points[side === 'left' ? 2 : 3] = {x,y,confidence:.95}; this.options.onFrame(this); },
            raw: action => {
                this.activeActions = new Set([action]);
                this.options.onAction({ action }); this.options.onFrame(this);
            },
            gesture: action => {
                const command = action.includes('_') ? action : action + '_up';
                this.options.onAction({ action: command.split('_')[0] + '_neutral' }); this.options.onFrame(this);
                this.options.onAction({ action: command }); this.options.onFrame(this);
            },
            stop: () => {
                this.dispose(); this.state.running = false; this.listener(this.state);
            }
        };
    }
    subscribe(listener) { this.listener = listener; listener(this.state); return () => {}; }
    setInferenceFps(fps) { window.motionTest.fps = fps; }
    async importJSON(text) { this.inputs = JSON.parse(text).inputs; }
    async start(video) {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
        canvas.getContext('2d').fillRect(0, 0, 640, 480);
        this.stream = canvas.captureStream(30); video.srcObject = this.stream; await video.play();
        this.video = video; this.state.running = true; this.listener(this.state);
        this.interval = setInterval(() => this.options.onFrame(this), 50);
    }
    coordinate(index) { return this.points[[11, 12, 15, 16].indexOf(index)] || null; }
    recalibrate() {}
    dispose() {
        clearInterval(this.interval); this.stream?.getTracks().forEach(track => track.stop());
        if (this.video) this.video.srcObject = null;
    }
}
