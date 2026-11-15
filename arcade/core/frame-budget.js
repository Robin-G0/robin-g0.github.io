/** Bound display work on high-refresh monitors; stalls never queue catch-up paints. */
export class FrameBudget {
    constructor(fps = 60) { this.interval = 1000 / fps; this.next = null; }
    due(time) {
        if (this.next != null && time < this.next - .1) return false;
        this.next = this.next == null ? time + this.interval : this.next + this.interval;
        if (this.next <= time) this.next = time + this.interval;
        return true;
    }
}
