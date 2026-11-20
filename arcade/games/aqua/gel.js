import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { pinstripes, toolbar, brushed, gel as drawGel, light, poof, throb, isDark, text, etched,
    addBurst, bursts, pruneBursts, addEffect, pruneEffects } from './display.js';

// Gel Factory: a gel button is extruded and grows wider; the dialog sheet above asks for buttons of
// set widths. Raise L to stamp the growing button into the leftmost empty slot, R into the rightmost.
// Every stamp, good or not, starts a fresh button, so the order of the stamps is the plan.
// A full sheet ships (slides back up) and scores; the host's 18 s score rounds are the pressure.
export const GEL = { min: .14, max: 1, grow: 2.6, minGrow: 1.8, growStep: .05, good: .085, perfect: .03,
    sizes: { S: .4, M: .63, L: .86 }, ship: .8, refill: .5, points: { good: 20, perfect: 40 }, clean: 20, cleanStep: 10, cleanMax: 60,
    stages: { two: 3, three: 8 }, threeChance: .5 };
/** Seconds the button takes from its smallest to its widest; sheets shipped make it a little quicker. */
export const growSeconds = shipped => Math.max(GEL.minGrow, GEL.grow - GEL.growStep * shipped);
export const sizeAt = (elapsed, shipped) => GEL.min + Math.max(0, elapsed) / growSeconds(shipped) * (GEL.max - GEL.min);
export function fitOf(size, target) {
    const off = size - target;
    return Math.abs(off) <= GEL.perfect ? 'perfect' : Math.abs(off) <= GEL.good ? 'good' : off < 0 ? 'small' : 'big';
}
export const cleanBonus = streak => Math.min(GEL.cleanMax, GEL.clean + GEL.cleanStep * streak);
/** Slots per sheet: one while learning, two from the third sheet, sometimes three from the eighth. */
export function slotCount(shipped, random) {
    if (shipped < GEL.stages.two) return 1;
    if (shipped < GEL.stages.three) return 2;
    return random() < GEL.threeChance ? 3 : 2;
}
/** Which slot a wrist stamps: L the leftmost empty slot, R the rightmost. */
export function slotFor(slots, action) {
    const empty = slots.map((slot, i) => slot.fill ? -1 : i).filter(i => i >= 0);
    return action === 'left' ? empty[0] : empty.at(-1);
}
const NAMES = Object.keys(GEL.sizes);
const STAGE_NEWS = { [GEL.stages.two]: 'new · two buttons per sheet', [GEL.stages.three]: 'new · three-button sheets' };

export function gel(env) {
    const s = { time: 0, sheet: null, shipped: 0, bornAt: 0, cleanStreak: 0, ship: null, solved: false, pops: 0, ids: 0,
        bursts: [], effects: [], ended: false };
    function newSheet() {
        const count = slotCount(s.shipped, env.random);
        s.sheet = { id: ++s.ids, at: s.time, clean: true, slots: Array.from({ length: count }, () => ({ size: NAMES[integer(env.random, 0, NAMES.length - 1)], fill: null })) };
        s.bornAt = s.time; s.solved = false; s.ship = null;
        if (STAGE_NEWS[s.shipped] && s.shipped) addEffect(s, { kind: 'stage', text: STAGE_NEWS[s.shipped] });
    }
    newSheet();
    const size = (at = s.time) => sizeAt(at - s.bornAt, s.shipped);
    function stamp(action, at) {
        const index = slotFor(s.sheet.slots, action); if (index == null || s.time < s.bornAt) return; // No button yet: harmless.
        const slot = s.sheet.slots[index], value = size(Math.min(s.time, Math.max(s.bornAt, at))), fit = fitOf(value, GEL.sizes[slot.size]);
        addEffect(s, { kind: 'stamp', sheet: s.sheet.id, index, fit, value });
        s.bornAt = s.time + GEL.refill; // The nozzle refills before the next button starts.
        if (fit === 'small' || fit === 'big') {
            s.sheet.clean = false; s.cleanStreak = 0;
            addBurst(s, fit === 'small' ? 'too small' : 'too big', index, 0, false);
            env.sound?.({ kind: 'brake' }); return;
        }
        slot.fill = fit;
        addBurst(s, fit === 'perfect' ? 'PERFECT' : 'fits', index, 0);
        env.sound?.({ kind: 'bounce', perfect: fit === 'perfect', action });
        if (s.sheet.slots.every(item => item.fill)) {
            const sum = s.sheet.slots.reduce((total, item) => total + GEL.points[item.fill], 0);
            const bonus = s.sheet.clean ? cleanBonus(s.cleanStreak) : 0;
            s.cleanStreak = s.sheet.clean ? s.cleanStreak + 1 : 0;
            s.score += sum + bonus; s.shipped++; s.solved = true;
            s.ship = { at: s.time, points: sum + bonus, clean: s.sheet.clean };
            addBurst(s, bonus ? `+${sum + bonus} · clean +${bonus}` : `+${sum}`, -1, 0);
            env.sound?.({ kind: 'clear', count: s.sheet.slots.length * 2, chain: Math.min(4, s.cleanStreak + 1), perfect: s.sheet.clean });
        }
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || s.ship || !['left', 'right'].includes(event.action)) return; // While a sheet ships, raises are harmless.
            stamp(event.action, event.at ?? s.time);
        },
        update(s) {
            pruneBursts(s); pruneEffects(s, 1.7); if (s.ended) return;
            if (s.ship) { if (s.time - s.ship.at >= GEL.ship) newSheet(); return; }
            if (size() > GEL.max) { addEffect(s, { kind: 'pop' }); s.pops++; s.bornAt = s.time + GEL.refill; } // Over-inflated: it pops, harmlessly, and restarts.
        },
        render(s, p) {
            const compact = p.compact, reduced = env.reducedMotion, dark = isDark(p);
            pinstripes(p);
            const news = s.effects.findLast(e => e.kind === 'stage');
            const top = toolbar(p, `${s.shipped} sheets`, news ? news.text : s.cleanStreak ? `clean run ${s.cleanStreak} · next +${cleanBonus(s.cleanStreak)}` : 'clean sheet +20');
            // A document window; the order hangs from its title bar as an Aqua sheet.
            const winX = 24, winW = 672, titleY = top + (compact ? 22 : 10), titleH = compact ? 40 : 24;
            const sheetH = compact ? 210 : 104, extW = compact ? 640 : 560, scale = compact ? .3 : .34;
            brushed(p, winX, titleY, winW, titleH, 8);
            ['close', 'minimise', 'zoom'].forEach((kind, i) => light(p, winX + 20 + i * titleH * .8, titleY + titleH / 2, titleH * .26, kind));
            etched(p, 'Untitled Order', 360, titleY + titleH / 2, compact ? 22 : 13, dark ? '#e6f5ff' : '#25455f', 'center', 700);
            const sheet = s.sheet, since = s.time - sheet.at, shipT = s.ship ? (s.time - s.ship.at) / GEL.ship : 0;
            const drop = reduced ? (s.ship ? (shipT < .5 ? 1 : 0) : 1) : s.ship ? Math.max(0, 1 - shipT * 1.4) : Math.min(1, since / .35);
            const sy = titleY + titleH - sheetH * (1 - drop), c = p.c;
            c.save(); c.beginPath(); c.rect(winX, titleY + titleH, winW, sheetH + 30); c.clip();
            c.shadowColor = '#0a284640'; c.shadowBlur = 16; c.shadowOffsetY = 6;
            p.rect(winX + 40, sy, winW - 80, sheetH, dark ? '#2a3d4fee' : '#f7f9fbee', 8);
            c.shadowColor = 'transparent';
            const slotH = compact ? 56 : 34, gap = compact ? 18 : 22;
            const widths = sheet.slots.map(slot => GEL.sizes[slot.size] * extW * scale + slotH * .6);
            const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
            let x = 360 - total / 2; const slotY = sy + sheetH * .5 - slotH / 2, slotX = [];
            const nextL = slotFor(sheet.slots, 'left'), nextR = slotFor(sheet.slots, 'right');
            sheet.slots.forEach((slot, i) => {
                slotX.push(x + widths[i] / 2);
                const stampFx = s.effects.findLast(e => e.kind === 'stamp' && e.sheet === sheet.id && e.index === i);
                const fresh = stampFx && s.time - stampFx.at < .25 && !reduced;
                if (slot.fill && !fresh) {
                    drawGel(p, x, slotY, widths[i], slotH, slot.fill === 'perfect' ? 'blue' : 'clear');
                    text(p, slot.fill === 'perfect' ? '✓ ' + slot.size : slot.size, x + widths[i] / 2, slotY + slotH / 2, slotH * .42, slot.fill === 'perfect' ? '#ffffff' : '#25455f', 'center', 700);
                } else {
                    c.save(); c.setLineDash([6, 5]); c.strokeStyle = p.color(i === nextL || i === nextR ? 'accent' : 'border'); c.lineWidth = 2;
                    c.beginPath(); c.roundRect(x, slotY, widths[i], slotH, slotH / 2); c.stroke(); c.restore();
                    text(p, slot.size, x + widths[i] / 2, slotY + slotH / 2, slotH * .42, 'muted', 'center', 700);
                    const owner = i === nextL && i === nextR ? 'L R' : i === nextL ? 'L' : i === nextR ? 'R' : '';
                    if (owner) text(p, owner, x + widths[i] / 2, slotY + slotH + (compact ? 24 : 14), compact ? 22 : 13, 'accent', 'center', 700);
                }
                x += widths[i] + gap;
            });
            c.restore();
            // The extruder: a brushed nozzle bar; the button grows out of it, centred. Tick pairs mark the next L and R widths.
            const cy = compact ? Math.max(top + 560, p.h * .6) : 300, bh = compact ? 92 : 50;
            const value = s.ship || s.time < s.bornAt ? 0 : Math.min(GEL.max, size()), w = value * extW;
            brushed(p, 360 - extW / 2 - 20, cy - bh / 2 - (compact ? 46 : 28), extW + 40, compact ? 22 : 14, 7);
            const targets = [];
            if (!s.ship) {
                if (nextL != null) targets.push({ index: nextL, label: nextL === nextR ? 'L R' : 'L' });
                if (nextR != null && nextR !== nextL) targets.push({ index: nextR, label: 'R' });
            }
            for (const target of targets) {
                const t = GEL.sizes[sheet.slots[target.index].size], half = t * extW / 2, fit = fitOf(value, t);
                const near = fit === 'good' || fit === 'perfect', pulse = near ? throb(s.time, reduced) : 0;
                for (const side of [-1, 1]) {
                    const tx = 360 + side * half;
                    if (near) { c.save(); c.globalAlpha = .25 + .35 * pulse; p.rect(tx - (compact ? 10 : 7), cy - bh * .9, compact ? 20 : 14, bh * 1.8, '#4aa8ff', 7); c.restore(); }
                    p.line([[tx, cy - bh * .85], [tx, cy + bh * .85]], near ? 'accent' : 'muted', near ? (compact ? 5 : 3) : 2, near ? [] : [5, 4]);
                }
                const labelY = target.label === 'R' && targets.length > 1 ? cy + bh * .85 + (compact ? 26 : 15) : cy - bh * .85 - (compact ? 22 : 13);
                text(p, `${target.label} · ${sheet.slots[target.index].size}`, 360 + half, labelY, compact ? 22 : 13, near ? 'accent' : 'muted', 'center', 700);
            }
            // Gel wobble: the extruded button breathes a little as it grows (decoration only).
            const wob = reduced ? 0 : Math.sin(s.time * 11) * .04;
            if (w > 4) drawGel(p, 360 - w / 2, cy - bh / 2 * (1 - wob), w, bh * (1 - wob), 'blue', { glow: targets.some(t => ['good', 'perfect'].includes(fitOf(value, GEL.sizes[sheet.slots[t.index].size]))) ? .8 : 0 });
            for (const e of s.effects) {
                const age = s.time - e.at;
                if (e.kind === 'pop') { poof(p, 360 - extW / 2, cy, bh, age); poof(p, 360 + extW / 2, cy, bh, age); }
                if (e.kind === 'stamp' && age < .5 && e.sheet === sheet.id) {
                    // The stamped button flies up to its slot and shrinks to the sheet's scale; a misfit drops away.
                    const k = Math.min(1, age / .25), ew = e.value * extW, misfit = e.fit === 'small' || e.fit === 'big';
                    if (reduced) { if (misfit && age < .4) p.outline(slotX[e.index] - 30, slotY - 6, 60, slotH + 12, '#e0503c', 3); continue; }
                    const tx = misfit ? 360 : slotX[e.index], ty = misfit ? cy + bh * 2 : slotY + slotH / 2;
                    const fw = ew + (ew * scale - ew) * (misfit ? 0 : k), fy = cy + (ty - cy) * k;
                    c.save(); c.globalAlpha = misfit ? 1 - age / .5 : 1;
                    drawGel(p, 360 + (tx - 360) * k - fw / 2, fy - bh * (1 - k * .5) / 2, fw, bh * (1 - (misfit ? 0 : k * .4)), misfit ? 'red' : 'blue');
                    c.restore();
                }
            }
            bursts({ ...s, bursts: s.bursts.map(b => ({ ...b, x: b.x < 0 ? 360 : slotX[b.x] ?? 360, y: b.x < 0 ? titleY + titleH + sheetH * .5 : slotY - (compact ? 30 : 18) })) }, p, reduced);
        }
    });
}
