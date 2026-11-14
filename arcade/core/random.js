export function seededRandom(seed = 1) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let mixed = Math.imul(value ^ value >>> 15, value | 1);
        mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
        return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
}

export function integer(random, minimum, maximum) {
    return minimum + Math.floor(random() * (maximum - minimum + 1));
}

export const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
