/** A recognised MIG pulse can confirm a screen, never become a queued game move. */
export class MotionNavigation {
    request(phase, visible, now) {
        if (!visible || this.deadline || !['ready', 'paused'].includes(phase)) return false;
        this.deadline = now + 3000;
        return true;
    }

    cancel() { this.deadline = null; }

    step({ visible, lastSeen, lostSince }, now) {
        if (!this.deadline) return null;
        if (now - lastSeen > 1500 || (lostSince != null && now - lostSince > 700)) {
            this.cancel();
            return { cancelled: true };
        }
        if (now >= this.deadline && visible) {
            this.cancel();
            return { play: true };
        }
        return { remaining: Math.max(1, Math.ceil((this.deadline - now) / 1000)) };
    }
}
