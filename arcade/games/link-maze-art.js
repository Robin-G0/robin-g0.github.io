/** Original construction-era pixel art; GIF companions live beside these strips. */
export function drawLinkEffect(p, effect, x, y, size, time, reducedMotion = false) {
    const image = p.images?.get(`maze-${effect}`);
    if (!image) return false;
    const frames = image.naturalWidth / image.naturalHeight;
    const frame = reducedMotion ? 0 : Math.floor(time / .12) % frames;
    const c = p.c;
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(image, frame * image.naturalHeight, 0, image.naturalHeight, image.naturalHeight,
        x - size / 2, y - size / 2, size, size);
    c.restore();
    return true;
}
