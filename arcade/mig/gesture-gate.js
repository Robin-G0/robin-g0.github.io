import { WRISTS, decodeGesture } from '../core/commands.js?v=eras-4';

/** Space repeated wrist/direction commands independently. MIG owns physical rearming. */
export class GestureGate {
    constructor({ cooldownMs = 0 } = {}) { this.cooldownMs = cooldownMs; this.reset(); }
    reset() { this.last = new Map(); this.latest = { left: -Infinity, right: -Infinity }; }
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
                const event = gestures[0], key = `${wrist}_${event.direction}`, previous = this.last.get(key);
                if (event.timestamp < this.latest[wrist]) continue;
                if (previous != null && (event.timestamp === previous || event.timestamp - previous < this.cooldownMs)) continue;
                this.last.set(key, event.timestamp);
                this.latest[wrist] = event.timestamp;
                accepted.push(event);
            }
        }
        return accepted;
    }
}
