import { arcadeProfile } from './profile.js?v=targets-25';
import { commandLabel } from '../core/commands.js';

function attribute(element, name, value) {
    const text = String(value);
    if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

/** Project profile cells for display only; this module never emits game commands.
 * MIGSession does not publicly expose the calibrated grid. Match its shoulder-relative metric,
 * axis and 35 ms smoothing; an initial live projection is an alignment guide.
 */
export class TriggerView {
    constructor(svg, directions = ['left', 'up', 'right'], profile = arcadeProfile, {mapped=false,labels={}} = {}) {
        this.svg = svg; this.reset();
        svg.replaceChildren();
        this.unsupported = 0;
        const regions = [];
        for(const input of profile.inputs) {
            if(!mapped) {
                if(directions.includes(input.action.split('_')[1]))regions.push({input,cell:input.steps[0].constraints[0].cell});
                continue;
            }
            // The deployed API exposes body coordinates but no calibrated/hand grid.
            if(input.space!=='body' || input.mirror){this.unsupported++;continue;}
            const seen=new Set();
            for(const step of [{constraints:input.constraints},...(input.steps || [])])for(const constraint of step.constraints || []) {
                if(!['required','trigger'].includes(constraint.type) || !Array.isArray(constraint.cell))continue;
                const cell=constraint.cell.length===2?[...constraint.cell,1,1]:constraint.cell;
                const key=JSON.stringify([constraint.landmark,cell]);
                if(seen.has(key))continue;seen.add(key);
                regions.push({input,cell,wrist:constraint.landmark?.startsWith('left_')?'left':'right'});
            }
            if(!seen.size)this.unsupported++;
        }
        this.boxes = regions.map(({input,cell,wrist}) => {
            const group = document.createElementNS(svg.namespaceURI, 'g');
            group.dataset.trigger = input.action;
            group.dataset.triggerWrist = wrist || input.action.split('_')[0];
            const polygon = document.createElementNS(svg.namespaceURI, 'polygon');
            const label = document.createElementNS(svg.namespaceURI, 'text');
            label.textContent = mapped ? (labels[input.action] || input.action) : commandLabel(input.action);
            group.append(polygon, label); svg.append(group);
            return { group, polygon, label, cell };
        });
    }
    reset() { this.grid = null; this.time = null; this.svg.setAttribute('hidden', ''); }
    update(frame) {
        const shoulders = frame.shoulderPoints;
        if (!this.boxes.length || !frame.shoulders || !shoulders) { this.reset(); return; }
        const aspect = frame.aspect || 1;
        const a = { x: shoulders[1].x * aspect, y: shoulders[1].y };
        const b = { x: shoulders[0].x * aspect, y: shoulders[0].y };
        const width = Math.hypot(b.x - a.x, b.y - a.y);
        if (width < .08 || b.x <= a.x) { this.reset(); return; }
        const next = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
            ax: (b.x - a.x) / width, ay: (b.y - a.y) / width, scale: width * .2 };
        const gap = this.time == null ? Infinity : frame.timestamp - this.time;
        const blend = gap > 180 || gap < 0 ? 1 : 1 - Math.exp(-gap / 35);
        if (!this.grid) this.grid = next;
        else for (const key of Object.keys(next)) this.grid[key] += (next[key] - this.grid[key]) * blend;
        const axis = Math.hypot(this.grid.ax, this.grid.ay);
        this.grid.ax /= axis; this.grid.ay /= axis;
        this.time = frame.timestamp;
        this.svg.removeAttribute('hidden');
        const project = (x, y) => {
            const g = this.grid, dx = (x - 4.5) * g.scale, dy = (y - 3.5) * g.scale;
            return [(1 - (g.x + g.ax * dx - g.ay * dy) / aspect) * 1000,
                (g.y + g.ay * dx + g.ax * dy) * 1000];
        };
        for (const { group, polygon, label, cell: [x, y, w, h] } of this.boxes) {
            const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p => project(...p));
            attribute(polygon, 'points', corners.map(p => p.map(n => n.toFixed(1)).join(',')).join(' '));
            // Keep labels inside the visible portion of even a partly clipped region.
            const cx = (Math.max(0, Math.min(...corners.map(p => p[0]))) + Math.min(1000, Math.max(...corners.map(p => p[0])))) / 2;
            const cy = (Math.max(0, Math.min(...corners.map(p => p[1]))) + Math.min(1000, Math.max(...corners.map(p => p[1])))) / 2;
            const upper = group.dataset.trigger.endsWith('_up');
            const offset = upper ? 0 : group.dataset.triggerWrist === 'left' ? -55 : 55;
            // The broad upward region is shared by both wrists; separate its labels.
            const labelX = upper ? cx + (group.dataset.triggerWrist === 'left' ? -120 : 120) : cx;
            attribute(label, 'x', Math.max(70, Math.min(930, labelX)).toFixed(1));
            attribute(label, 'y', Math.max(45, Math.min(955, cy + offset)).toFixed(1));
            attribute(group, 'data-active', Boolean(frame.active?.includes(group.dataset.trigger)));
        }
    }
}
