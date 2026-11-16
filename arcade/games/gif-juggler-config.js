// World coordinates stay fixed across desktop and portrait rendering.
export const JUGGLER = Object.freeze({
    line: 330, radius: 24, catchStart: 165, contactGrace: .28,
    gravity: 160, launch: -235, recovery: .9, slowSeconds: 5, slowFactor: .65, giftEvery: 4,
    arrivals: Object.freeze([{ at: 25, lane: 0 }, { at: 55, lane: 1 }])
});
export const CONTACT_Y = JUGGLER.line - JUGGLER.radius;
