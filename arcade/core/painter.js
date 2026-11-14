const photoFiles = {
    aero: 'aero-aquarium-v3.jpg', glass: 'glass-abyss-depths-v1.jpg',
    chrome: 'y2k-chrome-orbit-v1.png', fish: 'aero-fish-orange-v3.png',
    jelly: 'glass-abyss-jellyfish-v1.png', earth: 'glass-space-earth-v1.png'
};
const imageCache = new Map();

export async function loadArtwork(theme) {
    if (typeof Image === 'undefined') return new Map();
    const needed = theme === 'aero' ? ['aero', 'fish'] : theme === 'glass' ? ['glass', 'jelly', 'earth']
        : theme === 'y2k' ? ['chrome'] : [];
    await Promise.all(needed.map(async name => {
        if (imageCache.has(name)) return;
        const image = new Image();
        image.src = new URL(`../../assets/art/${photoFiles[name]}`, import.meta.url).href;
        try { await image.decode(); imageCache.set(name, image); } catch { /* Vector fallback stays playable. */ }
    }));
    return imageCache;
}

export function readPalette() {
    const style = getComputedStyle(document.body);
    const result = { font: style.fontFamily, theme: document.documentElement.dataset.theme };
    for (const key of ['bg', 'ink', 'muted', 'accent', 'soft', 'border', 'gold']) {
        result[key] = style.getPropertyValue(`--${key}`).trim();
    }
    return result;
}

/** Logical canvas coordinates remain 720×420, independently of screen density. */
export class Painter {
    constructor(context, palette, images = new Map()) {
        this.c = context; this.colors = palette; this.images = images;
        this.w = 720; this.h = 420;
    }
    color(value) { return this.colors[value] || value; }
    background() {
        const { c, w, h } = this;
        c.clearRect(0, 0, w, h);
        c.fillStyle = this.colors.bg; c.fillRect(0, 0, w, h);
        const image = this.images.get(this.colors.theme);
        if (image) {
            c.save(); c.globalAlpha = this.colors.theme === 'glass' ? .5 : .55;
            c.drawImage(image, 0, 0, w, h); c.restore();
        }
        if (['phosphor', 'matrix'].includes(this.colors.theme)) {
            c.save(); c.globalAlpha = .1;
            for (let y = 0; y < h; y += 5) this.line([[0, y], [w, y]], 'ink', 1);
            c.restore();
        }
        if (this.colors.theme === 'field-notes') {
            c.save(); c.globalAlpha = .3;
            for (let x = 0; x < w; x += 30) this.line([[x, 0], [x, h]], 'border', .5);
            for (let y = 0; y < h; y += 30) this.line([[0, y], [w, y]], 'border', .5);
            c.restore();
        }
    }
    rect(x, y, width, height, color = 'accent', radius = 0) {
        const c = this.c; c.fillStyle = this.color(color); c.beginPath();
        c.roundRect(x, y, Math.max(0, width), Math.max(0, height), radius); c.fill();
    }
    outline(x, y, width, height, color = 'accent', lineWidth = 2) {
        const c = this.c; c.strokeStyle = this.color(color); c.lineWidth = lineWidth;
        c.strokeRect(x, y, width, height);
    }
    circle(x, y, radius, color = 'accent', filled = true) {
        const c = this.c; c.beginPath(); c.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
        c.fillStyle = c.strokeStyle = this.color(color); c.lineWidth = 2;
        if (filled) c.fill(); else c.stroke();
    }
    line(points, color = 'accent', width = 2, dash = []) {
        const c = this.c; c.beginPath(); c.strokeStyle = this.color(color); c.lineWidth = width;
        c.setLineDash(dash); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.stroke(); c.setLineDash([]);
    }
    text(text, x, y, size = 22, color = 'ink', align = 'left') {
        const c = this.c; c.fillStyle = this.color(color);
        c.font = `${size}px ${this.colors.font || 'Arial'}`;
        c.textAlign = align; c.textBaseline = 'middle'; c.fillText(String(text), x, y);
    }
    sprite(name, x, y, width, height) {
        const image = this.images.get(name);
        if (image) {
            const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
            const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
            this.c.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
            return true;
        }
        return false;
    }
    ball(x, y, radius, color = 'accent') {
        if (['aqua', 'y2k', 'glass', 'aero'].includes(this.colors.theme)) {
            const gradient = this.c.createRadialGradient(x - radius * .35, y - radius * .4, 1, x, y, radius);
            gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.3, this.color(color));
            gradient.addColorStop(1, this.color('soft'));
            this.circle(x, y, radius, gradient);
        } else this.circle(x, y, radius, color);
    }
    arrow(x, y, side, color = 'accent') {
        const direction = side === 'left' ? -1 : 1;
        this.line([[x - direction * 16, y - 14], [x + direction * 2, y], [x - direction * 16, y + 14]], color, 4);
    }
}
