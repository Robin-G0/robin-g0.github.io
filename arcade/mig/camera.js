import { arcadeProfile } from './profile.js?v=motion-6';

export function visiblePoint(point) {
    return Boolean(point && point.confidence >= .5 && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
}

/** Public npm API only; the application never reconstructs MIG gesture rules. */
export class MotionCamera {
    constructor({ onInput, onTracking, onStatus, loadPackage = () => import('motion-input-grid'),
        clock = () => performance.now() }) {
        Object.assign(this, { onInput, onTracking, onStatus, loadPackage, clock });
        this.session = null;
        this.generation = 0;
        this.pending = [];
    }

    async start(video, overlay) {
        const generation = ++this.generation;
        this.onStatus('Loading motion tracking. First start may take a few seconds…');
        try {
            const { MIGSession } = await this.loadPackage();
            if (generation !== this.generation) return;
            const session = new MIGSession({
                assetBase: new URL('../../vendor/motion-input-grid/runtime/', import.meta.url).href,
                profileMode: true,
                onAction: event => {
                    if (generation === this.generation) this.pending.push({ ...event, timestamp: this.clock() });
                },
                onFrame: frame => {
                    if (generation !== this.generation) return;
                    const points = [11, 12, 15, 16].map(index => frame.coordinate(index, 0));
                    const shoulders = points.slice(0, 2).every(visiblePoint);
                    const visible = shoulders && points.slice(2).some(visiblePoint);
                    this.lastFrame = this.clock();
                    this.onTracking({ visible, shoulders,
                        left: points[2], right: points[3], timestamp: this.lastFrame });
                    const actions = this.pending.splice(0);
                    if (!visible) return;
                    // MIG already recognised these pulses. An off-screen OTHER
                    // wrist must not suppress an observed hand's valid command.
                    for (const event of actions) {
                        const wrist = event.action === 'left' ? points[2] : event.action === 'right' ? points[3] : null;
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
            await session.importJSON(JSON.stringify(arcadeProfile));
            if (generation !== this.generation) return;
            await session.start(video, overlay);
            if (generation !== this.generation) return;
            if (!session.state.running) {
                this.onStatus('Camera unavailable. Allow camera access in your browser, then retry, or play with buttons.');
                this.stop();
                return;
            }
            this.onStatus('Keep shoulders and wrists visible. Lower hands, then lift one wrist.');
        } catch {
            if (generation === this.generation) {
                this.stop();
                this.onStatus('Camera unavailable. Allow camera access in your browser, then retry, or play with buttons.');
            }
        }
    }

    recalibrate() {
        this.pending.length = 0;
        this.session?.recalibrate();
        this.onStatus('Lower your hands and keep both shoulders visible.');
    }

    stop() {
        ++this.generation;
        this.pending.length = 0;
        this.running = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.session?.dispose();
        this.session = null;
    }
}
