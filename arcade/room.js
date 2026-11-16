import { engines } from './registry.js?v=pressure-19';
import { GameRunner } from './core/runner.js?v=pressure-19';
import { bindAlternativeControls } from './core/input.js?v=power-11';
import { WRISTS, DIRECTIONS, ARROWS, decodeGesture, commandLabel } from './core/commands.js';
import { Painter, readPalette, loadArtwork, loadTypography } from './core/painter.js?v=pressure-19';
import { MotionCamera, visiblePoint } from './mig/camera.js?v=directions-16';
import { arcadeProfile, popupProfile } from './mig/profile.js?v=targets-12';
import { ArcadeAudio } from './core/audio.js';
import { MotionNavigation } from './core/motion-navigation.js?v=greeting-18';
import { lessonFor } from './lessons.js?v=maze-13';
import { MarkerMotion } from './mig/marker-motion.js';
import { TriggerView } from './mig/trigger-view.js?v=targets-12';
import { FrameBudget } from './core/frame-budget.js';
import { WRIST_DIRECTION_COOLDOWN_MS } from './games/popup-panic.js?v=survival-17';

export class GameRoom {
    constructor(dialog, description, opener) {
        this.dialog = dialog; this.description = description; this.opener = opener;
        this.abort = new AbortController();
        this.navigation = new MotionNavigation();
        this.elements = new Map();
        this.$ = selector => {
            if (!this.elements.has(selector)) this.elements.set(selector, dialog.querySelector(selector));
            return this.elements.get(selector);
        };
        this.frameBudget = new FrameBudget(); this.needsPaint = true;
        this.canvas = this.$('#arcade-canvas');
        this.palette = readPalette();
        this.dialog.dataset.engine = description.engine;
        this.dialog.dataset.brief = 'start';
        this.$('#arcade-tutorial').removeAttribute('aria-labelledby');
        this.$('#arcade-tutorial').setAttribute('aria-label', 'Start game');
        this.sixDirections = description.inputScheme === 'wrist-directions';
        const profile = description.engine === 'popups' ? popupProfile : arcadeProfile;
        this.$('a[download]').href = `./arcade/profiles/${description.engine === 'popups' ? 'popup-directions' : 'wrist-raises'}.json?v=targets-12`;
        this.wristPulseUntil = {};
        this.markerMotion = Object.fromEntries(WRISTS.map(wrist => [wrist, new MarkerMotion()]));
        this.triggerView = new TriggerView(this.$('#arcade-trigger-zones'), this.sixDirections ? DIRECTIONS : ['up'], profile);
        this.$('.camera-positioning').textContent = this.sixDirections ? 'Arrow boxes · no home return' : 'Lift into ↑ · lower to repeat';
        this.inputMode = 'motion';
        this.sound = new ArcadeAudio(this.palette.theme);
        this.sound.unlock();
        this.painter = new Painter(this.canvas.getContext('2d'), this.palette);
        this.painter.controls = description.controls;
        this.canvas.width = 1440; this.canvas.height = 840;
        this.canvas.getContext('2d').setTransform(2, 0, 0, 2, 0, 0);
        this.canvas.setAttribute('aria-label', `${description.title}. ${description.goal}`);
        this.$('#arcade-game-title').textContent = description.title;
        this.$('#arcade-goal').textContent = description.goal;
        this.buildControls();
        this.runner = new GameRunner(description, engines[description.engine], {
            feedback: (kind, action) => this.feedback(kind, action),
            message: text => this.message(text), changed: state => this.updateUI(state),
            sound: event => this.sound.play(event), reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
        });
        this.instructions = lessonFor(description.engine);
        this.camera = new MotionCamera({
            profile,
            cooldownMs: description.engine === 'popups' ? WRIST_DIRECTION_COOLDOWN_MS : 0,
            onInput: (action, timestamp) => this.motionInput(action, timestamp),
            onTracking: frame => this.tracking(frame), onStatus: () => this.cameraStatus()
        });
        this.bindControls();
        this.cancelCountdown();
        this.showPlacement({ shoulders: false, left: null, right: null });
        this.dialog.dataset.camera = 'off';
        this.$('#arcade-feedback').textContent = this.sixDirections ? 'One wrist per stack.' : 'Lower and lift one wrist.';
        this.$('#arcade-sound').setAttribute('aria-pressed', 'true');
        this.fillControls();
        this.runner.publish();
        dialog.showModal();
        document.documentElement.dataset.arcadeOpen = 'true';
        this.resizeCanvas();
        this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
        this.resizeObserver.observe(this.canvas.parentElement);
        this.$('#arcade-begin').focus({ preventScroll: true });
        this.toggleCamera();
        this.request = requestAnimationFrame(time => this.frame(time));
        Promise.all([loadArtwork(this.palette.theme), loadTypography(this.palette)]).then(([images]) => {
            if (!this.closed) { this.painter.images = images; this.needsPaint = true; }
        });
    }

    bindControls() {
        const signal = this.abort.signal;
        const on = (selector, handler) => this.$(selector).addEventListener('click', handler, { signal });
        bindAlternativeControls(this.dialog, { dispatch: (action, details) => this.input(action, details) }, signal, this.description.inputScheme);
        on('#arcade-close', () => this.dialog.close());
        on('#arcade-begin', () => this.play());
        on('#arcade-resume', () => this.play());
        on('#arcade-no-camera', () => {
            this.stopCamera();
            this.play();
        });
        on('#arcade-cancel-countdown', () => this.cancelCountdown());
        on('#arcade-again', () => this.restart());
        on('#arcade-restart', () => this.restart());
        on('#arcade-help', () => {
            this.dialog.dataset.brief = 'controls';
            this.$('#arcade-tutorial').removeAttribute('aria-label');
            this.$('#arcade-tutorial').setAttribute('aria-labelledby', 'arcade-lesson-title');
            this.cancelCountdown(); this.clearFeedback(); this.runner.tutorial();
            this.$('#arcade-tutorial').scrollTop = 0;
            this.$('#arcade-begin').focus({ preventScroll: true });
        });
        on('#arcade-pause', () => {
            this.cancelCountdown();
            if (this.runner.phase === 'playing') this.runner.pause(); else if (this.runner.phase === 'paused') this.runner.play();
        });
        on('#arcade-camera', () => this.toggleCamera());
        on('#arcade-sound', () => {
            const enabled = this.sound.toggle();
            this.$('#arcade-sound').setAttribute('aria-pressed', String(enabled));
            this.$('#arcade-sound').setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
            if (enabled) this.sound.play({ kind: 'input' });
        });
        on('#arcade-recalibrate', () => this.camera.recalibrate());
        this.dialog.addEventListener('close', () => this.dispose(), { signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { this.cancelCountdown(); this.runner.pause('Paused while the page is in the background.'); }
        }, { signal });
        window.addEventListener('pagehide', () => this.dispose(), { signal });
    }

    buildControls() {
        const area = this.$('.arcade-inputs');
        area.replaceChildren();
        for (const wrist of WRISTS) {
            this.$(`[data-tutorial-action=${wrist}]`).textContent = this.sixDirections ? '← ↑ →' : this.description.controls[wrist];
            if (this.sixDirections) {
                const group = document.createElement('div'); group.className = 'wrist-controls';
                group.dataset.wristControls = wrist; group.setAttribute('role', 'group');
                group.setAttribute('aria-label', `${wrist} wrist controls`);
                const title = document.createElement('strong'); title.className = 'wrist-title'; title.textContent = wrist === 'left' ? 'L' : 'R';
                const buttons = document.createElement('div'); buttons.className = 'wrist-buttons';
                DIRECTIONS.forEach((direction, index) => {
                    const button = document.createElement('button'); button.type = 'button'; button.className = 'arcade-action';
                    button.dataset.arcadeInput = `${wrist}_${direction}`;
                    button.setAttribute('aria-label', `${wrist} wrist ${direction}`);
                    const arrow = document.createElement('span'); arrow.className = 'action-key'; arrow.textContent = ARROWS[direction];
                    const key = document.createElement('kbd'); key.textContent = (wrist === 'left' ? ['A', 'W', 'D'] : ['J', 'I', 'L'])[index];
                    button.append(arrow, key); buttons.append(button);
                });
                group.append(title, buttons); area.append(group);
            } else {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'arcade-action';
                button.dataset.arcadeInput = wrist;
                const arrow = document.createElement('span'); arrow.className = 'action-key';
                arrow.textContent = this.description.engine === 'maze' ? (wrist === 'left' ? 'L' : 'R') : ARROWS[wrist];
                const label = document.createElement('span'); label.className = 'action-name'; label.textContent = this.description.controls[wrist];
                button.append(arrow, label); area.append(button);
            }
        }
    }

    resizeCanvas() {
        if (this.closed) return;
        const box = this.canvas.parentElement.getBoundingClientRect();
        // The rising-stack board grows vertically on narrow screens; UI text and
        // arrows keep their proportions instead of stretching a landscape image.
        const height = ['popups', 'maze'].includes(this.description.engine) && box.width
            ? Math.max(420, Math.round(720 * box.height / box.width)) : 420;
        if (this.canvas.height !== height * 2) {
            this.canvas.height = height * 2;
            this.canvas.getContext('2d').setTransform(2, 0, 0, 2, 0, 0);
        }
        this.painter.h = height;
        this.painter.compact = box.width < 480;
        this.needsPaint = true;
    }

    text(selector, value) {
        const element = this.$(selector), content = String(value);
        if (element.textContent !== content) element.textContent = content;
    }

    play() {
        this.cancelCountdown(); this.clearFeedback(); this.runner.play(); this.canvas.focus({ preventScroll: true });
    }

    clearFeedback() {
        this.recognisedUntil = 0; this.messageUntil = 0; this.pulseUntil = 0;
        this.$('#arcade-recognition').textContent = '';
        this.$('#arcade-feedback').textContent = '';
    }

    restart() {
        this.cancelCountdown();
        this.clearFeedback();
        this.runner.restart();
        this.canvas.focus({ preventScroll: true });
    }

    fillControls() {
        this.$('#arcade-tutorial').scrollTop = 0;
        this.$('#arcade-neutral-cue').hidden = !this.sixDirections;
        this.$('#arcade-lesson-goal').textContent = this.description.goal;
        this.$('#arcade-lesson-tip').textContent = this.runner.roundPressure
            ? `Score before the clock runs out. Each timeout costs a life. ${this.instructions.tip}` : this.instructions.tip;
        this.$('#arcade-controls-tips').open = false;
        for (const side of ['left', 'right']) {
            this.$(`[data-tutorial-explanation=${side}]`).textContent = this.instructions[side];
        }
    }

    input(action, details = {}) {
        if (this.runner.phase !== 'tutorial') {
            this.inputMode = details.source || 'keyboard';
            return this.runner.router.dispatch(action, details);
        }
        return false;
    }

    motionInput(action, timestamp) {
        if (this.closed || document.hidden || performance.now() - timestamp > 250) return;
        const gesture = decodeGesture(action);
        if (!gesture || gesture.direction === 'neutral') return;
        this.$('#arcade-recognition').textContent = commandLabel(action);
        this.recognisedUntil = performance.now() + 1500;
        this.wristPulseUntil[gesture.wrist] = performance.now() + 240;
        this.$(`.camera-wrist[data-wrist=${gesture.wrist}]`).textContent = commandLabel(action);
        if (this.runner.phase === 'playing') {
            if (this.sixDirections) this.input(action, { source: 'motion', timestamp });
            else if (gesture.direction === 'up') this.input(gesture.wrist, { source: 'motion', timestamp });
            return;
        }
        if (gesture.direction !== 'up') return;
        this.requestCountdown(this.visible, performance.now());
    }

    requestCountdown(visible, now) {
        if (this.navigation.request(this.runner.phase, visible, now)) {
            this.inputMode = 'motion';
            this.$('#arcade-cancel-countdown').hidden = false;
        }
    }

    cancelCountdown() {
        this.navigation.cancel();
        this.$('#arcade-cancel-countdown').hidden = true;
        this.$('#arcade-countdown').textContent = '';
        this.runner.publish();
    }

    updateUI(state) {
        if (this.closed) return;
        if (this.dialog.dataset.phase !== state.phase) this.needsPaint = true;
        const active = state.phase === 'playing' && !(this.description.engine === 'maze' && this.runner.game.state.stage === 'preview');
        this.camera?.setInferenceFps(active ? 20 : 10);
        this.dialog.dataset.phase = state.phase;
        this.text('#arcade-score', state.score);
        this.text('#arcade-time', `${state.remaining == null ? state.elapsed : state.remaining}s`);
        this.text('.arcade-hud > div:nth-child(2) dt', state.clockLabel || (state.remaining == null ? 'Survived' : 'Time'));
        this.text('#arcade-lives', state.lives);
        this.$('#arcade-tutorial').hidden = state.phase !== 'tutorial';
        this.$('#arcade-paused').hidden = state.phase !== 'paused';
        this.$('#arcade-result').hidden = state.phase !== 'finished';
        this.text('#arcade-final-score', state.score);
        this.text('#arcade-pause', state.phase === 'paused' ? 'Resume' : 'Pause');
        this.$('#arcade-pause').disabled = ['tutorial', 'finished'].includes(state.phase);
        this.text('#arcade-restart', 'Restart');
        this.text('#arcade-begin', this.runner?.started ? 'Resume' : 'Start');
        if (!this.navigation.deadline) {
            const instruction = this.dialog.dataset.brief === 'start' ? 'Say hi (with hand) to start' : this.runner.started ? 'Lift to resume' : 'Lift to start';
            if (this.$('#arcade-controls-status').textContent !== instruction) this.$('#arcade-controls-status').textContent = instruction;
        }
        this.updateCameraLayout();
    }

    updateCameraLayout() {
        const compact = ['playing', 'paused'].includes(this.runner.phase);
        this.$('#arcade-camera-dock').classList.toggle('compact', compact);
    }

    message(text) {
        if (!this.closed) {
            this.$('#arcade-feedback').textContent = ''; // Outcomes belong beside the game objects.
            this.$('#arcade-playfield-message').textContent = text;
            this.messageUntil = performance.now() + 2200;
        }
    }

    feedback(kind, action) {
        if (this.closed) return;
        const label = this.description.controls[action];
        if (kind === 'accepted') {
            this.$(`[data-arcade-input=${action}]`).dataset.pulse = 'true';
            this.pulseUntil = performance.now() + 180;
            this.recognisedUntil = performance.now() + 1800;
            this.$('#arcade-recognition').textContent = decodeGesture(action) ? commandLabel(action) : `${action === 'left' ? 'L' : 'R'} ↑`;
            if (!['popups', 'maze'].includes(this.description.engine)) this.sound.play({ action });
            const game = this.runner.game;
            const points = game.state.inputFeedback?.points || 0;
            if (points > 0) this.messageUntil = 0; // The target callout already shows the result.
            this.$('#arcade-playfield-input').textContent = `${label}${points > 0 ? ` +${points}` : ''}`;
            this.$('#arcade-playfield-input').dataset.action = action;
        } else if (kind === 'duplicate') this.message('Recognised. Lower your wrist before the next lift.');
        else if (kind === 'late') this.message('That input arrived too late. Try the next one.');
    }

    async toggleCamera() {
        if (this.camera.running || this.cameraStarting) {
            this.stopCamera();
            return;
        }
        if (this.camera.session) this.camera.stop();
        const attempt = this.cameraAttempt = (this.cameraAttempt || 0) + 1;
        this.cameraStarting = true;
        this.inputMode = 'motion';
        this.dialog.dataset.camera = 'loading';
        this.trackingAt = performance.now(); this.lostAt = null; this.visible = false;
        this.$('#arcade-camera').textContent = 'Stop camera';
        await this.camera.start(this.$('#arcade-video'), this.$('#arcade-mig-overlay'));
        if (this.closed || attempt !== this.cameraAttempt) return;
        this.cameraStarting = false;
        this.dialog.dataset.camera = this.camera.running ? 'live' : 'unavailable';
        if (!this.camera.running) { this.$('#arcade-camera').textContent = 'Retry camera'; this.inputMode = 'keyboard'; }
        this.cameraStatus();
    }

    stopCamera() {
        this.cameraAttempt = (this.cameraAttempt || 0) + 1;
        this.cameraStarting = false; this.camera.stop(); this.cancelCountdown();
        this.inputMode = 'keyboard';
        this.visible = false; this.dialog.dataset.camera = 'off';
        this.startWristVisible = false; this.startLostAt = null;
        this.$('#arcade-camera').textContent = 'Use camera';
        this.cameraStatus();
        this.showPlacement({ shoulders: false, left: null, right: null });
    }

    cameraStatus() {
        if (this.closed) return;
        const short = this.camera.running ? (this.visible ? 'Ready' : 'Show a wrist')
            : this.cameraStarting ? 'Starting…' : this.dialog.dataset.camera === 'off' ? 'Camera off' : 'Camera unavailable';
        if (this.$('#arcade-camera-status').textContent !== short) this.$('#arcade-camera-status').textContent = short;
        if (this.dialog.dataset.camera === 'live' && !this.camera.running) {
            this.dialog.dataset.camera = 'unavailable';
            this.$('#arcade-camera').textContent = 'Retry camera';
            this.visible = false; this.cancelCountdown();
            this.startWristVisible = false; this.startLostAt = null;
            this.showPlacement({ shoulders: false, left: null, right: null });
            this.inputMode = 'keyboard';
        }
    }

    tracking(frame) {
        const video = this.$('#arcade-video');
        if (video.videoWidth && video.videoHeight) {
            this.$('.camera-view').style.aspectRatio = `${video.videoWidth}/${video.videoHeight}`;
        }
        this.visible = frame.visible;
        this.trackingAt = frame.timestamp;
        const wristVisible = visiblePoint(frame.left) || visiblePoint(frame.right);
        const wristEntered = wristVisible && !this.startWristVisible;
        this.startWristVisible = wristVisible;
        if (wristVisible) this.startLostAt = null;
        else this.startLostAt ??= frame.timestamp;
        if (wristEntered && this.runner.phase === 'tutorial' && this.dialog.dataset.brief === 'start' && !document.hidden) {
            this.requestCountdown(true, frame.timestamp);
        }
        if (frame.visible) {
            this.lostAt = null;
            this.cameraStatus();
        } else {
            this.lostAt ??= frame.timestamp;
            this.cameraStatus();
        }
        this.showPlacement(frame);
    }

    showPlacement(frame) {
        this.triggerView.update(frame);
        for (const [part, visible] of [['shoulders', frame.shoulders], ['left', visiblePoint(frame.left)], ['right', visiblePoint(frame.right)]]) {
            const indicator = this.$(`[data-tracking=${part}]`);
            const flag = String(Boolean(visible));
            if (indicator.dataset.visible !== flag) {
                indicator.dataset.visible = flag;
                indicator.querySelector('span').textContent = visible ? '✓' : '—';
            }
        }
        for (const side of ['left', 'right']) {
            const marker = this.$(`.camera-wrist[data-wrist=${side}]`), point = frame[side];
            marker.hidden = !visiblePoint(point);
            this.markerMotion[side].observe(visiblePoint(point) ? point : null);
        }
    }

    frame(timestamp) {
        if (this.closed) return;
        if (!this.frameBudget.due(timestamp)) {
            this.request = requestAnimationFrame(time => this.frame(time));
            return;
        }
        let trackingMissing = false;
        if (this.camera.running) {
            const stale = this.trackingAt != null && timestamp - this.trackingAt > 1500;
            trackingMissing = this.inputMode === 'motion' && (!this.visible || stale);
            if (stale) {
                this.visible = false;
                this.startWristVisible = false;
                this.showPlacement({ shoulders: false, left: null, right: null });
                this.cameraStatus();
            }
        }
        if (this.cameraStarting && this.inputMode === 'motion') trackingMissing = true;
        this.dialog.dataset.tracking = trackingMissing ? 'missing' : 'ready';
        this.text('#arcade-tracking-hint', this.cameraStarting ? 'Camera…' : 'Show a wrist');
        this.$('#arcade-tracking-hint').hidden = true; // Missing hands are reported beside the camera, without covering play.
        const initialStart = this.runner.phase === 'tutorial' && this.dialog.dataset.brief === 'start';
        const navigation = this.navigation.step({ visible: initialStart ? this.startWristVisible : this.visible,
            lastSeen: this.trackingAt, lostSince: initialStart ? this.startLostAt : this.lostAt }, timestamp);
        if (navigation?.cancelled) { this.cancelCountdown(); }
        else if (navigation?.play) this.play();
        else if (navigation) {
            const text = String(navigation.remaining);
            this.$('#arcade-countdown').textContent = text;
            this.$('#arcade-controls-status').textContent = text;
        }
        if (timestamp > (this.recognisedUntil || 0)) this.text('#arcade-recognition', '');
        for (const wrist of WRISTS) if (timestamp > (this.wristPulseUntil[wrist] || 0)) {
            this.text(`.camera-wrist[data-wrist=${wrist}]`, wrist === 'left' ? 'L' : 'R');
        }
        for (const wrist of WRISTS) {
            const marker = this.$(`.camera-wrist[data-wrist=${wrist}]`), point = this.markerMotion[wrist].step(timestamp);
            if (point) {
                const left = `${(1 - point.x) * 100}%`, top = `${point.y * 100}%`;
                if (marker.style.left !== left) marker.style.left = left;
                if (marker.style.top !== top) marker.style.top = top;
            }
            const pulse = timestamp < (this.wristPulseUntil[wrist] || 0);
            if (marker.dataset.pulse !== String(pulse)) marker.dataset.pulse = String(pulse);
            const group = this.$(`[data-wrist-controls=${wrist}]`);
            if (group && group.dataset.pulse !== String(pulse)) group.dataset.pulse = String(pulse);
        }
        this.runner.step(timestamp);
        // A paused/tutorial canvas is static. Camera feedback and navigation stay live.
        if (this.runner.phase === 'playing' || this.needsPaint) {
            this.painter.background();
            this.runner.game.render(this.painter);
            this.needsPaint = false;
        }
        if (this.description.engine === 'maze') {
            this.dialog.dataset.mazeStage = this.runner.game.state.stage;
            this.dialog.dataset.mazeLevel = this.runner.game.state.level;
        }
        this.$('#arcade-playfield-input').hidden = timestamp > (this.recognisedUntil || 0);
        this.$('#arcade-playfield-message').hidden = timestamp > (this.messageUntil || 0);
        if (timestamp > (this.nextHUD || 0)) { this.runner.publish(); this.nextHUD = timestamp + 150; }
        if (timestamp > (this.pulseUntil || 0)) {
            for (const button of this.dialog.querySelectorAll('[data-arcade-input][data-pulse]')) delete button.dataset.pulse;
        }
        this.request = requestAnimationFrame(time => this.frame(time));
    }

    dispose() {
        if (this.closed) return;
        this.closed = true;
        delete document.documentElement.dataset.arcadeOpen;
        cancelAnimationFrame(this.request); this.abort.abort();
        this.resizeObserver?.disconnect();
        this.camera.stop(); this.runner.dispose(); this.sound.dispose();
        this.painter = null; this.elements.clear();
        if (this.dialog.open) this.dialog.close();
        if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    }
}
