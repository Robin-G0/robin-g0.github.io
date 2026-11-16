/** Wrist presence can start a round; recognised pulses can resume it. No queued moves. */
export class MotionNavigation {
    request(phase, visible, now, keepGoing = false) {
        if (!visible || this.deadline || !['tutorial', 'paused'].includes(phase)) return false;
        this.deadline = now + 3000;
        this.keepGoing = keepGoing;
        return true;
    }

    cancel() { this.deadline = null; }

    step({ visible, lastSeen, lostSince }, now) {
        if (!this.deadline) return null;
        if (!this.keepGoing && (now - lastSeen > 1500 || (lostSince != null && now - lostSince > 700))) {
            this.cancel();
            return { cancelled: true };
        }
        if (now >= this.deadline && (visible || this.keepGoing)) {
            this.cancel();
            return { play: true };
        }
        return { remaining: Math.max(1, Math.ceil((this.deadline - now) / 1000)) };
    }
}
