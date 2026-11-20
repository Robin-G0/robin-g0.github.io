import { game } from '../../core/game.js';
import { integer } from '../../core/random.js';
import { pinstripes, toolbar, brushed, gel as drawGel, light, poof, throb, isDark, text, etched,
    addBurst, bursts, pruneBursts, addEffect, pruneEffects } from './display.js';

// Gel Factory: a gel button is extruded and grows wider; the dialog sheet above asks for buttons of
// set widths. Raise L to stamp the growing button into the leftmost empty slot, R into the rightmost.
// Every stamp, good or not, starts a fresh button, so the order of the stamps is the plan.
// A full sheet ships (slides back up) and scores; the host's 18 s score rounds are the pressure.
export const GEL = { min: .14, max: 1, grow: 2.6, minGrow: 1.8, growStep: .05, good: .085, perfect: .03,
    sizes: { S: .4, M: .63, XL: .86 }, ship: .8, refill: .5, points: { good: 20, perfect: 40 }, clean: 20, cleanStep: 10, cleanMax: 60,
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
            const compact = p.compact, reduced = env.reducedMotion, dark = isDark(p), c = p.c;
            pinstripes(p);
            const news = s.effects.findLast(e => e.kind === 'stage');
            const top = toolbar(p, `${s.shipped} ${s.shipped === 1 ? 'sheet' : 'sheets'}`, news ? news.text : s.cleanStreak ? `clean run ${s.cleanStreak} · next +${cleanBonus(s.cleanStreak)}` : 'clean sheet +20');
            // Buttons are drawn at true size everywhere: the slot on the sheet is exactly the width to reach.
            const extW = compact ? 250 : 240, bh = compact ? 64 : 40, gap = compact ? 12 : 16;
            // A document window; the order hangs from its title bar as an Aqua sheet.
            const winX = 16, winW = 688, titleY = top + (compact ? 22 : 10), titleH = compact ? 48 : 26, sheetH = bh + (compact ? 100 : 58);
            brushed(p, winX, titleY, winW, titleH, 8);
            ['close', 'minimise', 'zoom'].forEach((kind, i) => light(p, winX + 20 + i * titleH * .8, titleY + titleH / 2, titleH * .26, kind));
            etched(p, 'Untitled Order', 360, titleY + titleH / 2, compact ? 28 : 15, dark ? '#e6f5ff' : '#25455f', 'center', 700);
            const sheet = s.sheet, since = s.time - sheet.at, shipT = s.ship ? (s.time - s.ship.at) / GEL.ship : 0;
            // Sheets slide down out of the title bar and back up into it when they ship.
            const drop = reduced ? (s.ship && shipT >= .5 ? 0 : 1) : s.ship ? Math.max(0, 1 - shipT * 1.4) : Math.min(1, since / .35);
            const sy = titleY + titleH - sheetH * (1 - drop);
            c.save(); c.beginPath(); c.rect(winX, titleY + titleH, winW, sheetH + 30); c.clip();
            c.shadowColor = '#0a284640'; c.shadowBlur = 16; c.shadowOffsetY = 6;
            p.rect(winX + 8, sy, winW - 16, sheetH, dark ? '#2a3d4fee' : '#f9fbfdf0', 8);
            c.shadowColor = 'transparent';
            const widths = sheet.slots.map(slot => GEL.sizes[slot.size] * extW);
            const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
            let x = 360 - total / 2; const slotY = sy + (compact ? 22 : 12), slotX = [];
            const nextL = slotFor(sheet.slots, 'left'), nextR = slotFor(sheet.slots, 'right');
            sheet.slots.forEach((slot, i) => {
                slotX.push(x + widths[i] / 2);
                const stampFx = s.effects.findLast(e => e.kind === 'stamp' && e.sheet === sheet.id && e.index === i);
                const fresh = stampFx && s.time - stampFx.at < .25 && !reduced;
                if (slot.fill && !fresh) {
                    drawGel(p, x, slotY, widths[i], bh, slot.fill === 'perfect' ? 'blue' : 'clear');
                    text(p, slot.fill === 'perfect' ? `✓ ${slot.size}` : slot.size, x + widths[i] / 2, slotY + bh / 2, bh * .42, slot.fill === 'perfect' ? '#ffffff' : '#25455f', 'center', 700);
                } else {
                    const mine = i === nextL || i === nextR;
                    c.save(); c.setLineDash([6, 5]); c.strokeStyle = p.color(mine ? 'accent' : 'border'); c.lineWidth = mine ? 2.5 : 2;
                    c.beginPath(); c.roundRect(x, slotY, widths[i], bh, bh / 2); c.stroke(); c.restore();
                    text(p, slot.size, x + widths[i] / 2, slotY + bh / 2, bh * .42, 'muted', 'center', 700);
                    const owner = i === nextL && i === nextR ? 'L or R' : i === nextL ? 'L' : i === nextR ? 'R' : '';
                    if (owner) text(p, owner, x + widths[i] / 2, slotY + bh + (compact ? 30 : 18), compact ? 28 : 16, 'accent', 'center', 700);
                }
                x += widths[i] + gap;
            });
            c.restore();
            // The extruder: a brushed nozzle; the button grows out of it, centred. Tick pairs mark the next widths.
            const sheetBottom = titleY + titleH + sheetH, cy = compact ? Math.max(sheetBottom + bh * 1.6, (sheetBottom + p.h) / 2 - 20) : 296;
            const value = s.ship || s.time < s.bornAt ? 0 : Math.min(GEL.max, size()), w = value * extW;
            brushed(p, 360 - (compact ? 60 : 44), cy - bh / 2 - (compact ? 40 : 26), compact ? 120 : 88, compact ? 24 : 16, compact ? 8 : 6);
            p.rect(360 - 6, cy - bh / 2 - (compact ? 16 : 10), 12, compact ? 16 : 10, dark ? '#5d6a76' : '#b7bec5');
            const targets = new Map();
            if (!s.ship) for (const [index, who] of [[nextL, 'L'], [nextR, 'R']]) {
                if (index == null) continue;
                const name = sheet.slots[index].size, entry = targets.get(name) || { size: name, who: [] };
                if (!entry.who.includes(who)) entry.who.push(who);
                targets.set(name, entry);
            }
            const widest = Math.max(0, ...[...targets.values()].map(v => GEL.sizes[v.size]));
            let glow = false;
            for (const target of targets.values()) {
                const t = GEL.sizes[target.size], half = t * extW / 2, fit = fitOf(value, t);
                const near = value > 0 && (fit === 'good' || fit === 'perfect'), pulse = near ? throb(s.time, reduced) : 0;
                glow ||= near;
                for (const side of [-1, 1]) {
                    const tx = 360 + side * half;
                    if (near) { c.save(); c.globalAlpha = .25 + .35 * pulse; p.rect(tx - (compact ? 9 : 6), cy - bh * .85, compact ? 18 : 12, bh * 1.7, '#4aa8ff', 6); c.restore(); }
                    p.line([[tx, cy - bh * .8], [tx, cy + bh * .8]], near ? 'accent' : 'muted', near ? (compact ? 5 : 3) : 2, near ? [] : [5, 4]);
                }
                const lower = targets.size > 1 && t === widest;
                text(p, `${target.who.join(' or ')} · ${target.size}`, 360 + half, cy + bh * .8 + (compact ? 28 : 16) + (lower ? (compact ? 34 : 20) : 0), compact ? 28 : 16, near ? 'accent' : 'muted', 'center', 700);
            }
            // Gel wobble: the extruded button breathes a little as it grows (decoration only).
            const wob = reduced ? 0 : Math.sin(s.time * 11) * .04;
            if (w > 4) drawGel(p, 360 - w / 2, cy - bh / 2 * (1 - wob), w, bh * (1 - wob), 'blue', { glow: glow ? .8 : 0 });
            for (const e of s.effects) {
                const age = s.time - e.at;
                if (e.kind === 'pop') { poof(p, 360 - extW / 2, cy, bh, age); poof(p, 360 + extW / 2, cy, bh, age); }
                if (e.kind === 'stamp' && age < .5 && e.sheet === sheet.id) {
                    // The stamped button flies up into its slot (a misfit drops away, red).
                    const misfit = e.fit === 'small' || e.fit === 'big', ew = e.value * extW;
                    if (reduced) { if (misfit && age < .4) p.outline(slotX[e.index] - widths[e.index] / 2 - 4, slotY - 4, widths[e.index] + 8, bh + 8, '#e0503c', 3); continue; }
                    const k = Math.min(1, age / .25), tx = misfit ? 360 : slotX[e.index], ty = misfit ? cy + bh * 2.5 : slotY + bh / 2;
                    c.save(); c.globalAlpha = misfit ? Math.max(0, 1 - age / .5) : 1;
                    drawGel(p, 360 + (tx - 360) * k - ew / 2, cy + (ty - cy) * k - bh / 2, ew, bh, misfit ? 'red' : 'blue');
                    c.restore();
                }
            }
            bursts({ ...s, bursts: s.bursts.map(b => ({ ...b, x: b.x < 0 ? 360 : slotX[b.x] ?? 360, y: b.x < 0 ? sy + sheetH * .5 : b.good ? slotY + bh + (compact ? 70 : 40) : cy - bh * 1.2 })) }, p, reduced);
        }
    });
}
