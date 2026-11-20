import { game } from '../../core/game.js';
import { decodeGesture } from '../../core/commands.js';
import { techno, chrome, pill, backdrop, header, addBurst, bursts, pruneBursts,
    addEffect, pruneEffects, shatter, loseLife, gainLife } from './display.js';

// Chrome Beat: two lanes, one per wrist, on a Winamp-style deck. Notes slide down to the pads and are
// played with the move they show: ↑ raise; from 30 s ← / → scratch (sweep that wrist to the side).
// Chords (from 15 s) need both raises. Static (from 50 s) must be left alone. Timing is broad
// (±.4 s); touching the line (±.15 s) is PERFECT. A streak raises the multiplier; a stray or wrong
// move only breaks the streak; a missed note or touched static costs a life.
export const BEAT = { lead: 2.4, minLead: 1.6, step: 1.6, minStep: 1.05, good: .4, perfect: .15,
    goodPoints: 10, perfectPoints: 25, multEvery: 8, maxMult: 4, restoreEvery: 16,
    chordFrom: 15, scratchFrom: 30, staticFrom: 50, rest: .12, chord: .2, scratch: .35, static: .15,
    opening: [['left', 3], ['right', 4.6], ['left', 6.2], ['right', 7.8]] };
export const stepFor = pace => Math.max(BEAT.minStep, BEAT.step / pace);
export const leadFor = pace => Math.max(BEAT.minLead, BEAT.lead / pace);
export const multFor = streak => Math.min(BEAT.maxMult, 1 + Math.floor(streak / BEAT.multEvery));
export const stageAt = time => [BEAT.chordFrom, BEAT.scratchFrom, BEAT.staticFrom].filter(at => time >= at).length;
const WRISTS = ['left', 'right'];

export function beat(env) {
    const s = { notes: [], ids: 0, last: 0, stage: 0, streak: 0, mult: 1, best: 0, hits: 0, perfects: 0,
        bursts: [], effects: [], ended: false, lead: leadFor(env.pace) };
    for (const [lane, at] of BEAT.opening) { s.notes.push({ id: ++s.ids, lane, move: 'up', kind: 'note', at, hits: {} }); s.last = at; }
    function generate() {
        while (s.last < s.time + leadFor(env.pace) + 2) {
            const at = s.last + stepFor(env.pace), stage = stageAt(s.time); s.last = at;
            const roll = env.random(), lane = env.random() < .5 ? 'left' : 'right';
            if (roll < BEAT.rest) continue;
            let item = { id: ++s.ids, lane, move: 'up', kind: 'note', at, hits: {} };
            const r = (roll - BEAT.rest) / (1 - BEAT.rest);
            if (stage >= 3 && r < BEAT.static) item.kind = 'static';
            else if (stage >= 2 && r < BEAT.static + BEAT.scratch) item.move = env.random() < .5 ? 'left' : 'right';
            else if (stage >= 1 && r > 1 - BEAT.chord) item.lane = 'both';
            s.notes.push(item);
        }
    }
    function pad(wrist, kind, extra = {}) { addEffect(s, { kind, wrist, ...extra }); }
    function breakStreak() { s.streak = 0; s.mult = 1; }
    generate();
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended) return;
            const gesture = event.wrist ? event : decodeGesture(event.action);
            if (!gesture || !WRISTS.includes(gesture.wrist)) return;
            const { wrist, direction } = gesture, at = event.at ?? s.time;
            const candidates = s.notes.filter(n => !n.judged && (n.lane === wrist || n.lane === 'both') && !n.hits[wrist] && Math.abs(at - n.at) <= BEAT.good);
            const note = candidates.sort((a, b) => Math.abs(at - a.at) - Math.abs(at - b.at))[0];
            if (!note) { if (s.streak) addBurst(s, 'STREAK ×', 0, 0, false, { wrist }); breakStreak(); pad(wrist, 'empty'); return; }
            if (note.kind === 'static') {
                note.judged = 'struck'; breakStreak(); pad(wrist, 'static');
                addBurst(s, 'STATIC', 0, 0, false, { wrist }); loseLife(s, env); return;
            }
            if (note.move !== direction) { breakStreak(); pad(wrist, 'wrong'); addBurst(s, 'WRONG MOVE', 0, 0, false, { wrist }); return; }
            note.hits[wrist] = Math.abs(at - note.at) <= BEAT.perfect ? 'perfect' : 'good';
            if (note.lane === 'both' && !(note.hits.left && note.hits.right)) { pad(wrist, 'half'); env.sound?.({ kind: 'turn', action: wrist }); return; }
            note.judged = 'hit';
            const perfect = Object.values(note.hits).every(grade => grade === 'perfect');
            s.streak++; s.hits++; if (perfect) s.perfects++; s.best = Math.max(s.best, s.streak); s.mult = multFor(s.streak);
            const points = (perfect ? BEAT.perfectPoints : BEAT.goodPoints) * (note.lane === 'both' ? 2 : 1) * s.mult;
            s.score += points;
            for (const w of note.lane === 'both' ? WRISTS : [wrist]) pad(w, 'hit', { perfect, move: note.move });
            addBurst(s, `${perfect ? 'PERFECT' : 'GOOD'} +${points}`, 0, 0, true, { wrist: note.lane === 'both' ? 'both' : wrist });
            env.sound?.(perfect ? { kind: 'bounce', perfect: true } : { kind: 'clear', count: 1, chain: s.mult });
            if (s.streak % BEAT.restoreEvery === 0 && gainLife(s, env)) addBurst(s, '+1 LIFE', 0, 0, true, { wrist: 'both', high: true });
        },
        update(s) {
            pruneBursts(s); pruneEffects(s); if (s.ended) return;
            const stage = stageAt(s.time);
            if (stage > s.stage) {
                s.stage = stage; addBurst(s, ['', 'CHORDS L+R', 'SCRATCH ← →', 'STATIC'][stage], 0, 0, true, { wrist: 'both', high: true });
                env.sound?.({ kind: 'powerup' });
            }
            s.lead = leadFor(env.pace);
            generate();
            for (const note of s.notes) {
                if (note.judged || s.time <= note.at + BEAT.good) continue;
                if (note.kind === 'static') { note.judged = 'passed'; continue; }
                note.judged = 'miss'; breakStreak();
                for (const w of note.lane === 'both' ? WRISTS : [note.lane]) if (!note.hits[w]) pad(w, 'miss');
                addBurst(s, 'MISS', 0, 0, false, { wrist: note.lane === 'both' ? 'both' : note.lane });
                loseLife(s, env); if (s.ended) return;
            }
            s.notes = s.notes.filter(note => !note.judged);
        },
        render(s, p) {
            backdrop(p);
            const compact = p.compact, k = compact ? 1.55 : 1, reduced = env.reducedMotion, c = p.c;
            header(p, `streak ${s.streak}`, `×${s.mult}`);
            const laneX = { left: compact ? 196 : 238, right: compact ? 524 : 482 }, laneW = compact ? 270 : 190;
            const top = compact ? 96 : 62, hitY = compact ? p.h - 210 : 330, speed = (hitY - top) / s.lead;
            const colorOf = lane => lane === 'left' ? 'accent' : 'gold';
            // Winamp spectrum analyser under the deck: decorative, driven by simulation time and recent hits.
            const energy = Math.min(1, s.effects.filter(e => e.kind === 'hit').reduce((sum, e) => sum + Math.max(0, 1 - (s.time - e.at)), 0));
            const bars = 24, barW = 720 / bars, base = p.h - 4;
            for (let i = 0; i < bars; i++) {
                const wave = reduced ? .5 : .5 + .5 * Math.sin(s.time * (2.1 + i % 5 * .4) + i * 1.3);
                const height = (compact ? 70 : 40) * (.25 + .35 * wave + .4 * energy * wave);
                c.save(); c.globalAlpha = .35; p.rect(i * barW + 3, base - height, barW - 6, height, i < bars / 2 ? 'accent' : 'gold', 1);
                c.globalAlpha = .8; p.rect(i * barW + 3, base - height - 6, barW - 6, 3, chrome(p, 0, base - height - 6, 0, base - height - 3)); c.restore();
            }
            for (const lane of WRISTS) {
                const x = laneX[lane], left = x - laneW / 2;
                c.save(); c.globalAlpha = .12; p.rect(left, top - 20, laneW, hitY - top + 50, colorOf(lane), 14 * k); c.restore();
                p.rect(left - 4, top - 20, 4, hitY - top + 50, chrome(p, left - 4, 0, left, 0)); p.rect(left + laneW, top - 20, 4, hitY - top + 50, chrome(p, left + laneW, 0, left + laneW + 4, 0));
                // The pad: a chrome rail whose white centre line is the PERFECT contact line.
                const flash = s.effects.find(e => e.wrist === lane && s.time - e.at < .3);
                pill(p, left + 8, hitY - 13 * k, laneW - 16, 26 * k, flash?.kind === 'hit' ? colorOf(lane) : flash && flash.kind !== 'half' ? 'border' : 'soft');
                p.line([[left + 14, hitY], [left + laneW - 14, hitY]], flash?.kind === 'hit' ? '#ffffff' : 'ink', 2);
                if (flash && ['empty', 'wrong', 'static', 'miss'].includes(flash.kind)) {
                    const d = 10 * k; p.line([[x - d, hitY - d], [x + d, hitY + d]], 'gold', 4); p.line([[x + d, hitY - d], [x - d, hitY + d]], 'gold', 4);
                }
                if (flash?.kind === 'half') p.circle(x, hitY, 20 * k, colorOf(lane), false);
            }
            for (const effect of s.effects) if (effect.kind === 'hit') shatter(p, laneX[effect.wrist], hitY, s.time - effect.at, effect.perfect ? 'accent' : colorOf(effect.wrist), reduced, effect.perfect ? k * 1.2 : k * .8);
            for (const note of s.notes) {
                const y = hitY - (note.at - s.time) * speed;
                if (y < top - 30 || y > hitY + 60) continue;
                const touching = Math.abs(note.at - s.time) <= BEAT.perfect;
                if (note.lane === 'both') {
                    const x0 = laneX.left - laneW * .35, x1 = laneX.right + laneW * .35, hh = 32 * k;
                    pill(p, x0, y - hh / 2, x1 - x0, hh, touching ? 'ink' : 'accent');
                    for (const lane of WRISTS) if (!note.hits[lane]) arrow(p, laneX[lane], y, 'up', 12 * k, '#ffffff'); else p.circle(laneX[lane], y, 8 * k, '#ffffff');
                    techno(p, 'L+R', 360, y + 1, 15 * k, '#ffffff', 'center', 900);
                    continue;
                }
                const x = laneX[note.lane];
                if (note.kind === 'static') {
                    // Static: a hollow zig-zag with a cross. Shape alone says "leave it".
                    const w = laneW * .34, hh = 16 * k; c.save(); c.beginPath();
                    for (let i = 0; i <= 8; i++) c.lineTo(x - w + i * w / 4, y + (i % 2 ? -hh : hh));
                    c.strokeStyle = p.color('muted'); c.lineWidth = 4; c.setLineDash([]); c.stroke(); c.restore();
                    const d = 9 * k; p.line([[x - d, y - d], [x + d, y + d]], 'ink', 3); p.line([[x + d, y - d], [x - d, y + d]], 'ink', 3);
                } else if (note.move === 'up') {
                    const w = laneW * .62, hh = 34 * k;
                    pill(p, x - w / 2, y - hh / 2, w, hh, touching ? 'ink' : colorOf(note.lane));
                    arrow(p, x, y, 'up', 12 * k, '#ffffff');
                } else {
                    // Scratch: a chrome vinyl disc with the sweep arrow, a different silhouette from a tap.
                    const r = 24 * k;
                    p.circle(x, y, r + 3, chrome(p, x, y - r, x, y + r)); p.circle(x, y, r, touching ? 'ink' : colorOf(note.lane));
                    c.save(); c.globalAlpha = .5; p.circle(x, y, r * .62, '#ffffff', false); c.restore();
                    arrow(p, x, y, note.move, 13 * k, '#ffffff');
                }
                if (touching) { c.save(); c.globalAlpha = .9; p.circle(x, y, 32 * k, '#ffffff', false); c.restore(); }
            }
            bursts(s, p, reduced, b => ({ ...b, x: b.wrist === 'both' || !b.wrist ? 360 : laneX[b.wrist], y: b.high ? (compact ? p.h * .4 : 190) : hitY + (compact ? 56 : 44) }));
        }
    });
}

/** A bold arrow glyph drawn as strokes; font arrows vary too much between platforms. */
export function arrow(p, x, y, direction, size, color) {
    const c = p.c; c.save(); c.translate?.(x, y);
    c.rotate?.(direction === 'up' ? 0 : direction === 'left' ? -Math.PI / 2 : Math.PI / 2);
    c.beginPath(); c.moveTo(0, size); c.lineTo(0, -size); c.moveTo(-size * .8, -size * .15); c.lineTo(0, -size); c.lineTo(size * .8, -size * .15);
    c.strokeStyle = p.color(color); c.lineWidth = Math.max(3, size * .32); c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.restore();
}
