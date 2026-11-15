import { WRISTS, decodeGesture } from '../core/commands.js';

/** Deduplicate native pulses. Native dwell and Single Press own physical rearming. */
export class GestureGate {
    constructor() { this.reset(); }
    reset() { this.last = { left: null, right: null }; }
    consume(events, visible) {
        const accepted = [];
        for (const wrist of WRISTS) {
            if (!visible[wrist]) { this.last[wrist] = null; continue; }
            const gestures = events.map(event => ({ ...event, ...decodeGesture(event.action) }))
                .filter(event => event.wrist === wrist && event.direction !== 'neutral');
            const commands = [...new Set(gestures.map(event => event.action))];
            if (commands.length === 1) {
                const event = gestures[0], previous = this.last[wrist];
                if (previous?.action === event.action && previous.timestamp === event.timestamp) continue;
                this.last[wrist] = event;
                accepted.push(event);
            }
        }
        return accepted;
    }
}
