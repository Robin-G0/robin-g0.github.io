import { WRISTS, decodeGesture } from '../core/commands.js';

/** Sequence native MIG events; never classify coordinates or fabricate release. */
export class GestureGate {
    constructor() { this.reset(); }
    reset() { this.ready = { left: false, right: false }; }
    consume(events, visible) {
        const accepted = [];
        for (const wrist of WRISTS) {
            if (!visible[wrist]) { this.ready[wrist] = false; continue; }
            const gestures = events.map(event => ({ ...event, ...decodeGesture(event.action) }))
                .filter(event => event.wrist === wrist);
            if (gestures.some(event => event.direction === 'neutral')) {
                this.ready[wrist] = true;
                continue;
            }
            const commands = [...new Set(gestures.map(event => event.action))];
            if (commands.length > 1) { this.ready[wrist] = false; continue; }
            if (commands.length === 1 && this.ready[wrist]) {
                this.ready[wrist] = false;
                accepted.push(gestures[0]);
            }
        }
        return accepted;
    }
}
