/** Matching original GIFs are provided alongside the simulation-clock PNG strips. */
export function drawJugglerSprite(p, name, x, y, size, time, reducedMotion = false) {
    const image = p.images?.get(`juggler-${name}`);
    if (!image) {
        p.rect(x - size * .34, y - size * .34, size * .68, size * .68, '#67ffff', 2);
        p.text({ slow: 'S', net: '+', globe: '@', mail: 'M', ball: '*', floppy: 'GIF' }[name],
            x, y, size * .32, '#100d35', 'center');
        return;
    }
    const frames = image.naturalWidth / image.naturalHeight;
    const frame = reducedMotion ? 0 : Math.floor(time / .12) % frames;
    p.c.save(); p.c.imageSmoothingEnabled = false;
    p.c.drawImage(image, frame * image.naturalHeight, 0, image.naturalHeight, image.naturalHeight,
        x - size / 2, y - size / 2, size, size);
    p.c.restore();
}
