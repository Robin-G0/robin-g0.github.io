import { WRISTS, decodeGesture } from '../core/commands.js';

/** Filter native deliveries, optionally spacing commands per wrist. MIG owns rearming. */
export class GestureGate {
    constructor({ cooldownMs = 0 } = {}) { this.cooldownMs = cooldownMs; this.reset(); }
    reset() { this.last = { left: null, right: null }; }
    consume(events, visible) {
        const accepted = [];
        if (!events.length) return accepted;
        const grouped = { left: [], right: [] };
        // Decode once per native event, not once per wrist or display frame.
        for (const event of events) {
            const gesture = decodeGesture(event.action);
            if (gesture && gesture.direction !== 'neutral') grouped[gesture.wrist].push({ ...event, ...gesture });
        }
        for (const wrist of WRISTS) {
            // Brief tracking loss must not bypass an in-flight cooldown.
            if (!visible[wrist]) continue;
            const gestures = grouped[wrist];
            const commands = [...new Set(gestures.map(event => event.action))];
            if (commands.length === 1) {
                const event = gestures[0], previous = this.last[wrist];
                if (previous?.action === event.action && previous.timestamp === event.timestamp) continue;
                if (previous && event.timestamp - previous.timestamp < this.cooldownMs) continue;
                this.last[wrist] = event;
                accepted.push(event);
            }
        }
        return accepted;
    }
}
