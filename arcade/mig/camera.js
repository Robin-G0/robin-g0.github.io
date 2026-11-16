import { arcadeProfile } from './profile.js?v=targets-25';
import { GestureGate } from './gesture-gate.js?v=directions-16';
import { BindingGate } from './bindings.js?v=bindings-29';

export function visiblePoint(point) {
    return Boolean(point && point.confidence >= .5 && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
}

/** Public npm API only; the application never reconstructs MIG gesture rules. */
export class MotionCamera {
    constructor({ onInput, onTracking, onStatus, loadPackage = () => import('motion-input-grid'),
        clock = () => performance.now(), profile = arcadeProfile, cooldownMs = 0, mapped = false }) {
        Object.assign(this, { onInput, onTracking, onStatus, loadPackage, clock, profile });
        this.session = null;
        this.generation = 0;
        this.pending = [];
        this.gate = new GestureGate({ cooldownMs });
        this.cooldownMs = cooldownMs;
        this.mapped = mapped;
        this.bindingGate = new BindingGate(profile,cooldownMs);
        this.inferenceFps = 20;
    }

    async start(video, overlay) {
        const generation = ++this.generation;
        this.gate.reset();
        this.bindingGate = new BindingGate(this.profile,this.cooldownMs);
        this.onStatus('Loading motion tracking. First start may take a few seconds…');
        try {
            const { MIGSession } = await this.loadPackage();
            if (generation !== this.generation) return;
            const session = new MIGSession({
                assetBase: new URL('../../vendor/motion-input-grid/runtime/', import.meta.url).href,
                profileMode: true,
                maxInferenceFps: this.inferenceFps,
                drawOverlay: false,
                videoConstraints: { width: 640, height: 480, frameRate: { ideal: 20, max: 30 } },
                onAction: event => {
                    if (generation === this.generation && !this.configuring) this.pending.push({ ...event, timestamp: this.clock() });
                },
                onFrame: frame => {
                    if (generation !== this.generation || this.configuring) return;
                    const points = [11, 12, 15, 16].map(index => frame.coordinate(index, 0));
                    const shoulders = points.slice(0, 2).every(visiblePoint);
                    const visible = shoulders && points.slice(2).some(visiblePoint);
                    const mappedVisible = this.mapped && (shoulders || points.slice(2).some(visiblePoint) ||
                        visiblePoint(frame.coordinate(0,0)) || [0,1].some(side=>
                            visiblePoint(frame.tracker?.handCoordinate?.(side,0,0))));
                    this.lastFrame = this.clock();
                    const events = this.pending.splice(0);
                    const actions = this.mapped ? this.bindingGate.consume(events) : this.gate.consume(events, {
                        left: shoulders && visiblePoint(points[2]), right: shoulders && visiblePoint(points[3])
                    });
                    this.onTracking({ visible:this.mapped ? mappedVisible : visible, shoulders, shoulderPoints: points.slice(0, 2),
                        aspect: video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1,
                        left: points[2], right: points[3],
                        active: this.profile.inputs.filter((input, index) => (this.mapped || (shoulders &&
                            visiblePoint(points[input.action.startsWith('left_') ? 2 : 3]))) &&
                            frame.tracker?.active?.(index)).map(input => input.action),
                        timestamp: this.lastFrame });
                    if (this.mapped) {
                        for (const event of actions) this.onInput(event.action,event.timestamp,{mapped:true});
                        return;
                    }
                    if (!visible) return;
                    // MIG already recognised these pulses. An off-screen OTHER
                    // wrist must not suppress an observed hand's valid command.
                    for (const event of actions) {
                        const wrist = event.wrist === 'left' ? points[2] : points[3];
                        if (visiblePoint(wrist)) this.onInput(event.action, event.timestamp);
                    }
                }
            });
            this.session = session;
            this.unsubscribe = session.subscribe(state => {
                if (generation !== this.generation) return;
                this.running = state.running;
                if (state.busy) this.onStatus('Loading camera models. Allow camera access when your browser asks.');
                if (!state.busy && !state.running) this.onStatus('Camera stopped. Keyboard and touch are available.');
            });
            await session.importJSON(JSON.stringify(this.profile));
            if (generation !== this.generation) return;
            await session.start(video, overlay);
            if (generation !== this.generation) return;
            if (!session.state.running) {
                this.onStatus('Camera unavailable. Allow camera access in your browser, then retry, or play with buttons.');
                this.stop();
                return;
            }
            this.onStatus(this.mapped ? 'Use your assigned motion bindings.' : 'Keep shoulders and wrists visible. Lower hands, then lift one wrist.');
        } catch {
            if (generation === this.generation) {
                this.stop();
                this.onStatus('Camera unavailable. Allow camera access in your browser, then retry, or play with buttons.');
            }
        }
    }

    recalibrate() {
        this.pending.length = 0;
        this.gate.reset();
        this.bindingGate = new BindingGate(this.profile,this.cooldownMs);
        this.session?.recalibrate();
        this.onStatus(this.mapped ? 'Recalibrated. Use your assigned motion bindings.' : 'Lower your hands and keep both shoulders visible.');
    }

    setInferenceFps(fps) {
        if (this.inferenceFps === fps) return;
        this.inferenceFps = fps;
        this.session?.setInferenceFps?.(fps);
    }

    async configure(profile, mapped) {
        const session = this.session, generation = this.generation, previous = this.profile;
        this.configuring = true; this.pending.length = 0;
        try {
            if (session) await session.importJSON(JSON.stringify(profile));
            if (generation !== this.generation) return false;
            this.profile = profile; this.mapped = mapped;
            this.gate.reset();this.bindingGate=new BindingGate(profile,this.cooldownMs);
            return true;
        } catch(error) {
            if (generation === this.generation && session) {
                try { await session.importJSON(JSON.stringify(previous)); }
                catch { this.stop(); }
            }
            throw error;
        } finally { this.configuring = false; this.pending.length = 0; }
    }

    stop() {
        ++this.generation;
        this.pending.length = 0;
        this.gate.reset();
        this.running = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.session?.dispose();
        this.session = null;
    }
}
