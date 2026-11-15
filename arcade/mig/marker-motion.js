/** Display-only easing. Recognition always receives the original SDK observations. */
export class MarkerMotion {
    constructor() { this.clear(); }
    clear() { this.position = null; this.target = null; this.time = null; }
    observe(point) {
        if (!point) { this.clear(); return; }
        this.target = { x: point.x, y: point.y };
        this.position ??= { ...this.target };
    }
    step(time) {
        if (!this.target) return null;
        const gap = this.time == null ? 16 : Math.max(0, time - this.time);
        this.time = time;
        const blend = 1 - Math.exp(-Math.min(100, gap) / 85);
        for (const axis of ['x', 'y']) {
            const delta = this.target[axis] - this.position[axis];
            // Sub-pixel observation noise does not shake the marker at rest.
            if (Math.abs(delta) > .0025) this.position[axis] += delta * blend;
        }
        return this.position;
    }
}
