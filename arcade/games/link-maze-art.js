/** Original construction-era pixel art; GIF companions live beside these strips. */
export function drawLinkEffect(p, effect, x, y, size, time, reducedMotion = false) {
    if (effect === 'fatal') {
        const pixel = size / 10, top = y - size / 2 + (reducedMotion ? 0 : Math.sin(time * 3) * pixel * .3);
        p.rect(x - size / 2, top, size, size, '#8b153a');
        const skull = ['01111110','11111111','11011011','11111111','01100110','00111100','01011010','10100101'];
        skull.forEach((row, j) => [...row].forEach((on, i) => {
            if (on === '1') p.rect(x - pixel * 4 + i * pixel, top + pixel + j * pixel, pixel, pixel, '#fff2db');
        }));
        return true;
    }
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
