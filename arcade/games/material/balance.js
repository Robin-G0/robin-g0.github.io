import { game } from '../../core/game.js?v=eras-4';
import { integer } from '../../core/random.js?v=eras-4';
import { type, header, sheet, elevated, ink, swatch, onSwatch, tint, surface, ease, clamp01,
    addBurst, drawBursts, addEffect, addSnack, drawSnacks, prune, loseLife, backdrop } from './display.js?v=eras-4';

// Paper Balance: a hanging mobile with two trays. Each paper card falls down the middle; raise L to
// lay it in the left tray, R for the right tray. Unplaced cards land in the lower (heavier) tray.
// The moment both trays weigh the same, the mobile levels and clears for 5 × cards² (gold cards
// double it). It tips, costing a heart and the trays, when one side outweighs the other by more
// than four or a tray takes a sixth card. Building a bigger level is the risk you choose.
export const BALANCE = { fall: 4.5, minFall: 1.8, limit: 4, capacity: 5, recovery: 1.2, points: 5, stages: [0, 3, 8, 14], fly: .3 };
const STAGE_TEXT = ['', '3-weight cards join', '4-weight cards join', 'Gold cards double a level'];
export const balanceStage = clears => BALANCE.stages.filter(at => clears >= at).length - 1;
export const fallSeconds = pace => Math.max(BALANCE.minFall, BALANCE.fall / pace);
export const weightOf = tray => tray.reduce((sum, card) => sum + card.w, 0);
export function levelPoints(cards) {
    const golds = cards.filter(card => card.gold).length;
    return BALANCE.points * cards.length ** 2 * Math.min(4, 2 ** golds);
}
const COLORS = ['teal', 'teal', 'indigo', 'pink', 'orange'];

export function balance(env) {
    const s = { time: 0, trays: [[], []], card: null, next: null, clears: 0, stage: 0, best: 0, ids: 0, bag: [], recoverUntil: 0,
        tilt: { from: 0, to: 0, at: 0 }, bursts: [], effects: [], snacks: [], ended: false };
    const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = integer(env.random, 0, i); [list[i], list[j]] = [list[j], list[i]]; } return list; };
    function draw() {
        if (!s.bag.length) {
            const max = [2, 3, 4, 4][s.stage], weights = [];
            for (let w = 1; w <= max; w++) weights.push(w, w);
            const bag = weights.map(w => ({ w, gold: false }));
            if (s.stage >= 3) bag[integer(env.random, 0, bag.length - 1)].gold = true;
            s.bag = shuffle(bag);
        }
        return { ...s.bag.pop(), id: ++s.ids };
    }
    function deal() { s.card = { ...(s.next || draw()), born: s.time, fall: fallSeconds(env.pace) }; s.next = draw(); }
    s.next = draw(); deal();
    const diff = () => weightOf(s.trays[1]) - weightOf(s.trays[0]);
    function setTilt() { s.tilt = { from: s.tilt.to, to: Math.max(-BALANCE.limit - 1, Math.min(BALANCE.limit + 1, diff())), at: s.time }; }
    function tip(reason) {
        addEffect(s, { kind: 'spill', trays: s.trays.map(tray => tray.map(card => ({ ...card }))), dir: Math.sign(diff()) || 1, life: 1 });
        addBurst(s, reason, 360, 0, false);
        s.trays = [[], []]; s.card = null; s.recoverUntil = s.time + BALANCE.recovery; setTilt();
        loseLife(s, env);
    }
    function place(side, auto = false) {
        const card = s.card, progress = clamp01((s.time - card.born) / card.fall);
        s.card = null;
        if (s.trays[side].length >= BALANCE.capacity) { s.trays[side].push({ ...card, at: s.time, from: progress }); setTilt(); tip('tray full'); return; }
        s.trays[side].push({ w: card.w, gold: card.gold, id: card.id, at: s.time, from: progress, auto });
        setTilt();
        env.sound?.({ kind: 'turn', action: side ? 'right' : 'left' });
        const d = diff();
        if (Math.abs(d) > BALANCE.limit) { tip('tipped'); return; }
        if (d === 0) {
            const cards = [...s.trays[0], ...s.trays[1]], points = levelPoints(cards);
            s.score += points; s.clears++; s.best = Math.max(s.best, cards.length);
            addEffect(s, { kind: 'level', trays: s.trays.map(tray => tray.map(c => ({ ...c }))), life: 1.1, at: s.time + BALANCE.fly });
            addBurst(s, `level ${cards.length} · +${points}`, 360, 0, true); s.bursts.at(-1).at = s.time + BALANCE.fly;
            env.sound?.(cards.length >= 6 ? { kind: 'powerup' } : { kind: 'clear', count: cards.length, chain: Math.min(4, cards.length - 1) });
            s.trays = [[], []]; setTilt();
            const stage = balanceStage(s.clears);
            if (stage > s.stage) { s.stage = stage; s.bag = []; s.next = draw(); addSnack(s, STAGE_TEXT[stage]); }
        }
        deal();
    }
    return game(s, {
        feedback: () => ({ hideAll: true }),
        input(s, event) {
            if (s.ended || !s.card || !['left', 'right'].includes(event.action)) return; // Between cards: harmless.
            addEffect(s, { kind: 'press', side: event.action === 'left' ? 0 : 1, life: .6 });
            place(event.action === 'left' ? 0 : 1);
        },
        update(s) {
            prune(s); if (s.ended) return;
            if (!s.card && s.time >= s.recoverUntil) deal();
            // An unplaced card settles into the lower tray (the right one when level).
            if (s.card && s.time - s.card.born >= s.card.fall) place(diff() >= 0 ? 1 : 0, true);
        },
        render(s, p) { drawBalance(s, p, env.reducedMotion); }
    });
}

function geometry(p) {
    const compact = p.compact, k = compact ? 1.6 : 1, h = p.h;
    const arm = compact ? 236 : 252, cardW = compact ? 180 : 132, cardH = compact ? 48 : 28, gap = 3 * k;
    const swing = Math.sin(angleFor(BALANCE.limit)) * arm, hang = BALANCE.capacity * (cardH + gap) + 16 * k;
    const sliderY = h - (compact ? 56 : 34), top = compact ? 84 : 52, bottom = sliderY - 46 * k;
    const rig = swing * 2 + hang, pivotY = top + swing + Math.max(0, (bottom - top - rig) / 2);
    return { compact, k, pivotY, arm, hang, cardW, cardH, gap, trayW: cardW + 20 * k, fallTop: pivotY + 34 * k,
        fallBottom: pivotY + swing + hang - cardH, sliderY };
}
const angleFor = d => d * 3 * Math.PI / 180;
function trayPoint(G, side, angle) {
    const dir = side ? 1 : -1, x = 360 + Math.cos(angle) * G.arm * dir, y = G.pivotY + Math.sin(angle) * G.arm * dir;
    return [x, y + G.hang];
}
/** A weight card: Material swatch, the weight as a numeral and the same count as pips (a shape cue). */
function card(p, x, y, w, h, value, gold, dp, k, alpha = 1) {
    const c = p.c; c.save(); c.globalAlpha = alpha;
    const fill = gold ? swatch(p, 'amber') : swatch(p, COLORS[value]);
    elevated(p, dp, cc => { cc.beginPath(); cc.roundRect(x - w / 2, y - h / 2, w, h, 3 * k); }, fill);
    const ink = onSwatch(p), gw = gold ? '#3e2723' : ink;
    type(p, value, x - w / 2 + h * .55, y + 1, h * .62, gw, 'center', 500);
    for (let i = 0; i < value; i++) p.circle(x - w / 2 + h * 1.25 + i * h * .42, y, h * .12, gw);
    if (gold) type(p, '×2', x + w / 2 - h * .5, y + 1, h * .5, gw, 'center', 500);
    c.restore();
}

function drawBalance(s, p, reduced) {
    const G = geometry(p), k = G.k, c = p.c;
    const d = weightOf(s.trays[1]) - weightOf(s.trays[0]);
    backdrop(p);
    header(p, `${s.clears} levelled`);
    // The next card waits as a small sheet at the right of the header.
    if (s.next) {
        const y = G.compact ? 46 : 30;
        type(p, 'next', 692 - G.cardW * .6 - 12 * k, y, (G.compact ? 28 : 17), 'muted', 'right', 500, true);
        card(p, 692 - G.cardW * .3, y, G.cardW * .6, G.cardH * .8, s.next.w, s.next.gold, 1, k * .8);
    }
    // Beam tilt eases with the standard curve and a slight overshoot settle, purely on simulation time.
    const t = clamp01((s.time - s.tilt.at) / .45), e = reduced ? 1 : ease.standard(t) + Math.sin(Math.PI * t) * .08 * (t > .5 ? 1 : 0);
    const angle = angleFor(s.tilt.from + (s.tilt.to - s.tilt.from) * e);
    const danger = Math.abs(d) === BALANCE.limit;
    p.line([[360, 0], [360, G.pivotY]], 'muted', 1.5 * k);
    const dx = Math.cos(angle) * G.arm, dy = Math.sin(angle) * G.arm;
    // The beam is a long paper strip at 2 dp, amber when one more step would tip it.
    c.save(); c.translate(360, G.pivotY); c.rotate(angle);
    elevated(p, 2, cc => { cc.beginPath(); cc.roundRect(-G.arm - 10 * k, -6 * k, G.arm * 2 + 20 * k, 12 * k, 6 * k); }, danger ? swatch(p, 'amber') : p.color('accent'));
    c.restore();
    p.circle(360, G.pivotY, 7 * k, surface(p, 8)); p.circle(360, G.pivotY, 7 * k, 'ink', false);
    for (const side of [0, 1]) {
        const [tx, ty] = trayPoint(G, side, angle), ex = 360 + (side ? dx : -dx), ey = G.pivotY + (side ? dy : -dy);
        p.line([[ex, ey], [tx - G.trayW / 2 + 6 * k, ty]], 'muted', 1.2 * k); p.line([[ex, ey], [tx + G.trayW / 2 - 6 * k, ty]], 'muted', 1.2 * k);
        const tray = s.trays[side], full = tray.length >= BALANCE.capacity;
        elevated(p, 2, cc => { cc.beginPath(); cc.roundRect(tx - G.trayW / 2, ty, G.trayW, 9 * k, 4 * k); }, full ? swatch(p, 'amber') : surface(p, 2));
        const press = s.effects.filter(e => e.kind === 'press' && e.side === side).at(-1);
        if (press) ink(p, tx, ty, s.time - press.at, G.trayW * .7, 'accent', { reduced, duration: .5, alpha: .25 });
        tray.forEach((item, i) => {
            const restX = tx, restY = ty - G.cardH / 2 - 2 * k - i * (G.cardH + G.gap);
            const fly = reduced ? 1 : ease.standard(clamp01((s.time - item.at) / BALANCE.fly));
            const fromY = G.fallTop + (G.fallBottom - G.fallTop) * item.from;
            const x = 360 + (restX - 360) * fly, y = fromY + (restY - fromY) * fly;
            card(p, x, y, G.cardW, G.cardH, item.w, item.gold, fly < 1 ? 10 : 1, k);
        });
        // Capacity dots under each tray: five slots, filled per card.
        for (let i = 0; i < BALANCE.capacity; i++) p.circle(tx - 2 * 9 * k + i * 9 * k, ty + 22 * k, 3 * k, i < tray.length ? 'accent' : 'border');
    }
    // Levelled or spilled trays leave as a group: cards lift and fade (level) or slide off downhill (tip).
    for (const fx of s.effects) {
        if (fx.kind !== 'level' && fx.kind !== 'spill') continue;
        const age = s.time - fx.at; if (age < 0) continue;
        const u = clamp01(age / .8);
        fx.trays.forEach((tray, side) => tray.forEach((item, i) => {
            const [tx, ty] = trayPoint(G, side, fx.kind === 'level' ? 0 : angleFor(fx.dir * (BALANCE.limit + 1)));
            const lag = clamp01(u * 1.3 - i * .06);
            const x = tx + (fx.kind === 'spill' ? fx.dir * 140 * k * ease.accelerate(lag) : 0);
            const y = ty - G.cardH / 2 - i * (G.cardH + G.gap) + (fx.kind === 'level' ? -90 * k * ease.decelerate(lag) : 160 * k * ease.accelerate(lag));
            if (!reduced || u < .6) card(p, x, y, G.cardW, G.cardH, item.w, item.gold, fx.kind === 'level' ? 4 + 8 * lag : 2, k, 1 - lag);
        }));
        if (fx.kind === 'level') ink(p, 360, G.pivotY, age, 300 * k, 'accent', { reduced, duration: .8, alpha: .22 });
    }
    // The falling card at 12 dp; its height above the drop line is its clock.
    if (s.card) {
        const prog = clamp01((s.time - s.card.born) / s.card.fall), y = G.fallTop + (G.fallBottom - G.fallTop) * prog;
        p.line([[360 - G.cardW * .7, G.fallBottom + G.cardH * .8], [360 + G.cardW * .7, G.fallBottom + G.cardH * .8]], 'border', 2 * k, [6 * k, 6 * k]);
        const enter = reduced ? 1 : ease.decelerate(clamp01((s.time - s.card.born) / .25));
        card(p, 360, y, G.cardW * (.9 + .1 * enter), G.cardH * (.9 + .1 * enter), s.card.w, s.card.gold, 12, k, enter);
    }
    slider(p, G, d, reduced);
    drawBursts(s, p, reduced, b => ({ ...b, y: G.pivotY + (G.compact ? 120 : 52) }));
    drawSnacks(s, p, reduced);
}

/** The imbalance as a Material discrete slider: ticks −4…4, red tip zones past the ends, a thumb with its value pin. */
function slider(p, G, d, reduced) {
    const k = G.k, width = G.compact ? 520 : 300, left = 360 - width / 2, y = G.sliderY, step = width / 10, c = p.c;
    c.save(); c.globalAlpha = .3; p.rect(left, y - 2 * k, width, 4 * k, 'accent', 2 * k); c.restore();
    p.rect(left - 2, y - 2 * k, step, 4 * k, swatch(p, 'red'), 2 * k); p.rect(left + width - step + 2, y - 2 * k, step, 4 * k, swatch(p, 'red'), 2 * k);
    for (let v = -4; v <= 4; v++) p.circle(left + step * (v + 5), y, 2 * k, v === 0 ? 'ink' : 'muted');
    const clamped = Math.max(-5, Math.min(5, d)), x = left + step * (clamped + 5), danger = Math.abs(d) >= BALANCE.limit;
    p.rect(Math.min(360, x), y - 2 * k, Math.abs(x - 360), 4 * k, danger ? swatch(p, 'red') : 'accent', 2 * k);
    p.circle(x, y, 8 * k, danger ? swatch(p, 'red') : 'accent');
    // Value pin above the thumb, as on discrete Material sliders.
    const pinY = y - 34 * k, r = 18 * k, fill = danger ? swatch(p, 'red') : p.color('accent');
    c.save(); c.fillStyle = fill; c.beginPath(); c.arc(x, pinY, r, Math.PI * .8, Math.PI * .2); c.lineTo(x, y - 10 * k); c.closePath(); c.fill(); c.restore();
    type(p, d > 0 ? `R+${d}` : d < 0 ? `L+${-d}` : '0', x, pinY + 1, (d ? 14 : 17) * (G.compact ? 1.25 : 1) * k, onSwatch(p), 'center', 500);
    type(p, 'L', left - 24 * k, y + 1, 18 * k, 'muted', 'center', 500); type(p, 'R', left + width + 24 * k, y + 1, 18 * k, 'muted', 'center', 500);
}
