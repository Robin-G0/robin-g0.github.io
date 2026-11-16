import { game } from '../core/game.js?v=motion-6';
import { renderJuggler } from './gif-juggler-view.js?v=arcade-28';
import { JUGGLER, CONTACT_Y } from './gif-juggler-config.js?v=arcade-28';
export { JUGGLER, CONTACT_Y } from './gif-juggler-config.js?v=arcade-28';

export function catchPoints(y, touching = false) {
    const risk = Math.max(0, Math.min(1, (y - JUGGLER.catchStart) / (CONTACT_Y - JUGGLER.catchStart)));
    return (10 + Math.round(40 * risk)) * (touching ? 2 : 1);
}

/** Each native wrist-Up pulse catches eligible descending GIFs in its own lane. */
export function juggle(env) {
    const state = { balls: [], serial: 0, arrival: 0, catches: 0, giftProgress: 0,
        giftSerial: 0, slowUntil: 0, net: false, pulses: [null, null], bursts: [], ended: false };

    function addBall(s, lane, y, velocity) {
        const id = s.serial++;
        s.balls.push({ id, lane, art: ['floppy', 'globe', 'mail', 'ball'][id % 4],
            y, velocity, contactAt: null, wakeAt: 0, power: null });
    }
    addBall(state, 0, 155, -110);
    addBall(state, 1, 105, 40);

    function burst(s, ball, text, kind, detail = '') {
        // Bound effects independently from play duration; decoration consumes no RNG.
        s.bursts.push({ lane: ball.lane, y: ball.y, text, kind, detail, at: s.time });
        s.bursts = s.bursts.slice(-8);
    }
    function launch(ball) {
        ball.velocity = JUGGLER.launch;
        ball.contactAt = null;
    }
    function collectPower(s, ball) {
        if (!ball.power) return null;
        const power = ball.power;
        if (ball.power === 'slow') s.slowUntil = s.time + JUGGLER.slowSeconds;
        else s.net = true;
        env.sound?.({ kind: 'powerup' });
        ball.power = null;
        return power;
    }

    return game(state, {
        feedback() { return { hideAll: true }; },
        input(s, event) {
            if (s.ended || !['left', 'right'].includes(event.action)) return;
            const lane = event.action === 'left' ? 0 : 1;
            const caught = s.balls.filter(ball => ball.lane === lane && s.time >= ball.wakeAt &&
                ball.y >= JUGGLER.catchStart && (ball.velocity > 0 || ball.contactAt !== null));
            s.pulses[lane] = { at: s.time, hit: caught.length > 0 };
            if (!caught.length) return; // Early/empty lifts have no penalty or error popup.
            let points = 0, contact = false, power = null;
            for (const ball of caught) {
                const touching = ball.contactAt !== null;
                const value = catchPoints(ball.y, touching);
                points += value; contact ||= touching;
                power = collectPower(s, ball) || power;
                launch(ball);
            }
            points += (caught.length - 1) * 25;
            s.score += points;
            const detail = contact ? 'EDGE x2' : power ? (power === 'slow' ? 'SLOW 5s' : 'NET +1') : caught.length > 1 ? 'DOUBLE' : '';
            burst(s, caught[0], `+${points}`, contact ? 'edge' : 'catch', detail);
            s.catches += caught.length;
            s.giftProgress += caught.length;
            if (s.giftProgress >= JUGGLER.giftEvery) {
                const carrier = caught.find(ball => !ball.power);
                carrier.power = s.giftSerial++ % 2 ? 'net' : 'slow';
                s.giftProgress -= JUGGLER.giftEvery;
            }
            env.sound?.({ kind: 'bounce', perfect: contact, count: caught.length, action: event.action });
        },
        update(s, dt) {
            if (s.ended) return;
            const next = JUGGLER.arrivals[s.arrival];
            if (next && s.time >= next.at) {
                addBall(s, next.lane, 60, 0);
                s.arrival++;
            }
            const worldDt = dt * env.pace * (s.time < s.slowUntil ? JUGGLER.slowFactor : 1);
            for (const ball of s.balls) {
                if (s.time < ball.wakeAt) continue;
                if (ball.contactAt !== null) {
                    if (s.time - ball.contactAt <= JUGGLER.contactGrace) continue;
                    if (s.net) {
                        s.net = false;
                        burst(s, ball, 'SAVED', 'gift');
                        launch(ball); // An automatic rescue never awards timing points.
                        env.sound?.({ kind: 'rescue' });
                    } else {
                        burst(s, ball, 'DROPPED', 'miss');
                        s.lives--;
                        ball.y = 60; ball.velocity = 0; ball.contactAt = null;
                        ball.power = null; ball.wakeAt = s.time + JUGGLER.recovery;
                        env.sound?.({ kind: 'miss' });
                        if (s.lives <= 0) { s.ended = true; env.finish('Game over'); break; }
                    }
                    continue;
                }
                ball.velocity += JUGGLER.gravity * worldDt;
                ball.y += ball.velocity * worldDt;
                if (ball.y >= CONTACT_Y && ball.velocity > 0) {
                    ball.y = CONTACT_Y;
                    ball.contactAt = s.time;
                }
                if (ball.y < 55) { ball.y = 55; ball.velocity = Math.max(0, ball.velocity); }
            }
            s.bursts = s.bursts.filter(item => s.time - item.at < 1);
        },
        render(s, p) { renderJuggler(s, p, env.reducedMotion); }
    });
}
