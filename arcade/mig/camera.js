import { arcadeProfile } from './profile.js';

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
        this.onStatus('Starting camera…');
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
                    const visible = points.every(point => point && point.confidence >= .5);
                    this.lastFrame = this.clock();
                    this.onTracking({ visible, left: points[2], right: points[3], timestamp: this.lastFrame });
                    const actions = this.pending.splice(0);
                    if (!visible) return;
                    // Two contrary commands in one observation are ambiguous for
                    // these two-button games. Ask for one wrist rather than guessing.
                    if (new Set(actions.map(event => event.action)).size > 1) {
                        this.onStatus('Lift one wrist at a time.');
                        return;
                    }
                    for (const event of actions) this.onInput(event.action, event.timestamp);
                }
            });
            this.session = session;
            this.unsubscribe = session.subscribe(state => {
                if (generation !== this.generation) return;
                this.running = state.running;
                if (!state.busy && !state.running) this.onStatus('Camera stopped. Keyboard and touch are available.');
            });
            await session.importJSON(JSON.stringify(arcadeProfile));
            if (generation !== this.generation) return;
            await session.start(video, overlay);
            if (generation !== this.generation) return;
            if (!session.state.running) {
                this.onStatus('Camera unavailable. You can still use the two buttons.');
                this.stop();
                return;
            }
            this.onStatus('Keep shoulders and wrists visible. Lower hands, then lift one wrist.');
        } catch {
            if (generation === this.generation) {
                this.stop();
                this.onStatus('Camera unavailable. You can still use the two buttons.');
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
