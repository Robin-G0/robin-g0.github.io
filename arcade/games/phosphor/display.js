/** Phosphor CRT materials. The tube colours follow the theme chart (light: P1 lime, dark: P31 green)
 * and fall back to these values outside the arcade. Decoration never consumes gameplay RNG, runs on
 * simulation time and is only drawn; reduced motion keeps the static cues. */
const BASE = {green:'#65ffab', dim:'#164e34', white:'#d5ffe4', amber:'#ffcf70', dark:'#020b07'};
export const CRT = {...BASE};

const hex = value => {
    const match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
    return match ? [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16)) : null;
};
export function mix(a, b, amount) {
    const from = hex(a), to = hex(b);
    if (!from || !to) return a;
    return '#' + from.map((v, i) => Math.round(v + (to[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}
const tuned = new WeakMap();
/** Reads the room palette once per palette object; other themes and tests keep the base tube. */
export function tune(p) {
    const colors = p?.colors;
    if (!colors || typeof colors !== 'object' || colors.theme !== 'phosphor' || !hex(colors.accent) || !hex(colors.bg)) {
        Object.assign(CRT, BASE); return CRT;
    }
    let tube = tuned.get(colors);
    if (!tube) {
        tube = {green: colors.accent, dark: colors.bg, amber: hex(colors.gold) ? colors.gold : BASE.amber,
            dim: mix(colors.bg, colors.accent, .3), white: mix(colors.ink || colors.accent, '#ffffff', .55)};
        tuned.set(colors, tube);
    }
    return Object.assign(CRT, tube);
}

/** Draws with a temporary opacity. */
export function faded(p, value, draw) {
    const c = p.c; c.save(); c.globalAlpha = (c.globalAlpha ?? 1) * Math.max(0, Math.min(1, value)); draw(); c.restore();
}

/** Additive radial bloom: the soft halo an over-driven phosphor dot leaves on the glass. */
export function bloom(p, x, y, radius, color = CRT.green, strength = .55) {
    const c = p.c, gradient = strength > 0 && c.createRadialGradient?.(x, y, 0, x, y, Math.max(1, radius));
    if (!gradient?.addColorStop) return;
    gradient.addColorStop(0, color); gradient.addColorStop(.35, mix(color, CRT.dark, .5)); gradient.addColorStop(1, CRT.dark);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, strength);
    c.fillStyle = gradient; c.beginPath(); c.arc(x, y, Math.max(1, radius), 0, Math.PI * 2); c.fill(); c.restore();
}

/** Status line: live state only (the room header already names the game). A block cursor blinks on sim time. */
export function terminal(p, status, detail, time = 0, reduced = false) {
    tune(p);
    const compact = p.compact, size = compact ? 46 : 27, prompt = `> ${status}`;
    p.outline(16, 12, 688, p.h - 24, CRT.dim, 2);
    p.text(prompt, 32, 36, size, CRT.green);
    const measured = p.c.measureText?.(prompt)?.width;
    const width = Number.isFinite(measured) ? measured : prompt.length * size * .5;
    if (reduced || Math.floor(time * 1.6) % 2 === 0) p.rect(40 + width, 36 - size * .34, size * .42, size * .66, CRT.green);
    p.text(detail, 685, 38, compact ? 42 : 25, CRT.white, 'right');
    p.line([[30, 60], [690, 60]], CRT.dim, 1);
}

/** Static glass: darker corners, drawn last over the playfield. */
export function glass(p) {
    const c = p.c, gradient = c.createRadialGradient?.(360, p.h / 2, Math.min(p.h, 720) * .42, 360, p.h / 2, Math.max(p.h, 720) * .75);
    if (!gradient?.addColorStop) return;
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.save(); c.fillStyle = gradient; c.fillRect(0, 0, 720, p.h); c.restore();
}

/** Tube warm-up: the raster opens from a bright centre line in the first half second of a run. */
export function warmUp(p, time, reduced = false) {
    if (reduced || time >= .5) return;
    const open = 1 - Math.pow(1 - time / .5, 3), half = Math.max(1, p.h / 2 * open), mid = p.h / 2;
    p.rect(0, 0, 720, mid - half, CRT.dark); p.rect(0, mid + half, 720, p.h - mid - half, CRT.dark);
    faded(p, 1 - open, () => p.rect(0, mid - 2, 720, 4, CRT.white));
    bloom(p, 360, mid, 140 * (1 - open) + 20, CRT.white, .6 * (1 - open));
}

/** Vertical-hold roll: a bright retrace band sweeps the tube once between fleets or pads. */
export function rollBand(p, progress, reduced = false) {
    if (reduced || progress < 0 || progress > 1) return;
    const y = 62 + (p.h - 84) * (1 - Math.pow(1 - progress, 2));
    faded(p, .14 * (1 - progress * .6), () => p.rect(18, y - 34, 684, 68, CRT.green));
    faded(p, .55 * (1 - progress), () => p.rect(18, y - 1, 684, 3, CRT.white));
    for (let row = -3; row <= 3; row++) if (row) faded(p, .12, () => p.rect(18, y + row * 9, 684, 1, CRT.white));
}

/** Deterministic hash noise for decoration; never touches env.random. */
export function noise(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
/** A short burst of snow over a rectangle after a crash, frame chosen from simulation time. */
export function staticBurst(p, left, top, width, height, age, reduced = false, duration = .45) {
    if (reduced || age < 0 || age > duration) return;
    const frame = Math.floor(age * 30), fade = 1 - age / duration;
    faded(p, .6 * fade, () => {
        for (let i = 0; i < 70; i++) {
            const seed = frame * 97 + i;
            p.rect(left + noise(seed) * width, top + noise(seed + .5) * height, 2 + noise(seed + .25) * 12, 2, i % 3 ? CRT.dim : CRT.white);
        }
    });
}

/** Pixel shards thrown from a hit; angles come from the actor id, not RNG. */
export function shards(p, x, y, age, seed, color = CRT.green, reduced = false, reach = 46) {
    if (reduced || age < 0 || age > .5) return;
    const t = age / .5, ease = 1 - Math.pow(1 - t, 3);
    faded(p, 1 - t, () => {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + noise(seed + i) * .6, distance = reach * ease * (.6 + noise(seed - i) * .5);
            p.rect(x + Math.cos(angle) * distance - 3, y + Math.sin(angle) * distance - 3, 6, 6, i % 2 ? color : CRT.white);
        }
    });
}

export function stars(p, bottom=p.h-70, time=0, reduced=false) {
    for (let i=0;i<32;i++) {
        const x=35+i*173%650,y=75+i*97%Math.max(1,bottom-85);
        // A few stars twinkle on simulation time; reduced motion keeps them steady.
        const twinkle=!reduced&&i%6===0&&Math.floor(time*2+i)%5===0;
        p.rect(x,y,i%7?2:4,2,twinkle?CRT.white:i%5?CRT.dim:CRT.green);
    }
}
export function addBurst(s, text, x, y, good=true, kind='') {
    s.bursts.push({text,x,y,good,at:s.time,...(kind?{kind}:{})});s.bursts=s.bursts.slice(-6);
}
/** Score text eases upward with a soft halo; reduced motion keeps it in place at full strength. */
export function bursts(s,p,project=point=>point,reduced=false) {
    for (const burst of s.bursts) {
        const age=s.time-burst.at;if(age>1.1)continue;
        const {x,y}=project(burst),color=burst.good?CRT.white:CRT.amber,size=p.compact?48:30;
        const lift=reduced?0:(1-Math.pow(1-age/1.1,3))*24;
        if(!reduced)bloom(p,x,y-lift,size*1.7,burst.good?CRT.green:CRT.amber,.3*(1-age/1.1));
        faded(p,reduced?1:Math.min(1,(1.1-age)*4),()=>p.text(burst.text,x,y-lift,size,color,'center'));
    }
}
export function pruneBursts(s) {s.bursts=s.bursts.filter(b=>s.time-b.at<1.1);}
/** Segmented bar, like a character-cell gauge. */
export function meter(p,x,y,width,fraction,color=CRT.green,height=14) {
    p.outline(x,y,width,height,CRT.dim,2);
    const filled=Math.max(0,Math.min(1,fraction))*(width-6);
    p.rect(x+3,y+3,filled,height-6,color);
    for(let cx=x+11;cx<x+3+filled;cx+=8)p.rect(cx,y+3,1.5,height-6,CRT.dark);
}
export function loseLife(s,env) {
    s.lives=Math.max(0,s.lives-1);env.sound?.({kind:'miss'});
    if(!s.lives){s.ended=true;env.finish('Game over');}
}

/** Draws a character-cell bitmap centred on x,y as one filled path (crisp, cheap). */
export function bitmap(p, rows, x, y, pixel, color) {
    const c = p.c, left = x - rows[0].length * pixel / 2, top = y - rows.length * pixel / 2;
    c.beginPath(); c.fillStyle = color;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') c.rect(left + i * pixel, top + j * pixel, pixel, pixel); });
    c.fill();
}
