import { engines } from './registry.js?v=tutorial-3';
import { GameRunner } from './core/runner.js';
import { bindAlternativeControls } from './core/input.js';
import { Painter, readPalette, loadArtwork } from './core/painter.js?v=tutorial-3';
import { MotionCamera, visiblePoint } from './mig/camera.js?v=camera-2';
import { MotionNavigation } from './core/motion-navigation.js?v=controls-5';
import { lessonFor } from './lessons.js';

export class GameRoom {
    constructor(dialog, description, opener) {
        this.dialog = dialog; this.description = description; this.opener = opener;
        this.abort = new AbortController();
        this.navigation = new MotionNavigation();
        this.$ = selector => dialog.querySelector(selector);
        this.canvas = this.$('#arcade-canvas');
        this.palette = readPalette();
        this.painter = new Painter(this.canvas.getContext('2d'), this.palette);
        this.painter.controls = description.controls;
        this.canvas.width = 1440; this.canvas.height = 840;
        this.canvas.getContext('2d').setTransform(2, 0, 0, 2, 0, 0);
        this.canvas.setAttribute('aria-label', `${description.title}. ${description.goal}`);
        this.$('#arcade-game-title').textContent = description.title;
        this.$('#arcade-goal').textContent = description.goal;
        for (const side of ['left', 'right']) {
            this.$(`[data-tutorial-action=${side}]`).textContent = description.controls[side];
            this.$(`[data-arcade-input=${side}] .action-name`).textContent = description.controls[side];
        }
        this.runner = new GameRunner(description, engines[description.engine], {
            feedback: (kind, action) => this.feedback(kind, action),
            message: text => this.message(text), changed: state => this.updateUI(state)
        });
        this.instructions = lessonFor(description.engine);
        this.camera = new MotionCamera({
            onInput: (action, timestamp) => this.motionInput(action, timestamp),
            onTracking: frame => this.tracking(frame), onStatus: text => this.cameraStatus(text)
        });
        this.bindControls();
        this.cancelCountdown();
        this.showPlacement({ shoulders: false, left: null, right: null });
        this.dialog.dataset.camera = 'off';
        this.$('#arcade-feedback').textContent = 'Two buttons, or lower and lift one wrist.';
        this.fillControls();
        this.runner.publish();
        dialog.showModal();
        this.$('#arcade-begin').focus({ preventScroll: true });
        this.toggleCamera();
        this.request = requestAnimationFrame(time => this.frame(time));
        loadArtwork(this.palette.theme).then(images => {
            if (!this.closed) this.painter.images = images;
        });
    }

    bindControls() {
        const signal = this.abort.signal;
        const on = (selector, handler) => this.$(selector).addEventListener('click', handler, { signal });
        bindAlternativeControls(this.dialog, { dispatch: (action, details) => this.input(action, details) }, signal);
        on('#arcade-close', () => this.dialog.close());
        on('#arcade-begin', () => { if (this.navigation.deadline) this.cancelCountdown(); else this.play(); });
        on('#arcade-resume', () => this.play());
        on('#arcade-no-camera', () => {
            this.stopCamera();
            this.play();
        });
        on('#arcade-cancel-countdown', () => this.cancelCountdown());
        on('#arcade-again', () => this.restart());
        on('#arcade-restart', () => this.restart());
        on('#arcade-help', () => {
            this.cancelCountdown(); this.clearFeedback(); this.runner.tutorial();
            this.$('#arcade-tutorial').scrollTop = 0;
            this.$('#arcade-begin').focus({ preventScroll: true });
        });
        on('#arcade-pause', () => {
            this.cancelCountdown();
            if (this.runner.phase === 'playing') this.runner.pause(); else if (this.runner.phase === 'paused') this.runner.play();
        });
        on('#arcade-camera', () => this.toggleCamera());
        on('#arcade-recalibrate', () => this.camera.recalibrate());
        this.dialog.addEventListener('close', () => this.dispose(), { signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { this.cancelCountdown(); this.runner.pause('Paused while the page is in the background.'); }
        }, { signal });
        window.addEventListener('pagehide', () => this.dispose(), { signal });
    }

    play() {
        this.cancelCountdown(); this.clearFeedback(); this.runner.play(); this.canvas.focus({ preventScroll: true });
    }

    clearFeedback() {
        this.recognisedUntil = 0; this.messageUntil = 0; this.pulseUntil = 0;
        this.$('#arcade-recognition').textContent = '';
        this.$('#arcade-feedback').textContent = 'Lower one wrist to waist level, then lift it for one action.';
    }

    restart() {
        this.cancelCountdown();
        this.clearFeedback();
        this.runner.restart();
        this.canvas.focus({ preventScroll: true });
    }

    fillControls() {
        this.$('#arcade-tutorial').scrollTop = 0;
        this.$('#arcade-lesson-goal').textContent = this.description.goal;
        this.$('#arcade-lesson-tip').textContent = this.instructions.tip;
        this.$('#arcade-controls-tips').open = false;
        for (const side of ['left', 'right']) {
            this.$(`[data-tutorial-explanation=${side}]`).textContent = this.instructions[side];
        }
    }

    input(action, details = {}) {
        if (this.runner.phase !== 'tutorial') return this.runner.router.dispatch(action, details);
        return false;
    }

    motionInput(action, timestamp) {
        if (this.closed || document.hidden || performance.now() - timestamp > 250) return;
        if (this.runner.phase === 'playing') {
            this.input(action, { source: 'motion', timestamp });
            return;
        }
        if (this.runner.phase === 'tutorial' && action !== 'right') {
            this.$('#arcade-controls-status').textContent = 'Left input detected. Lower and lift your RIGHT wrist to start.';
            return;
        }
        if (this.navigation.request(this.runner.phase, this.visible, performance.now())) {
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
        this.dialog.dataset.phase = state.phase;
        this.$('#arcade-score').textContent = state.score;
        this.$('#arcade-time').textContent = `${state.remaining}s`;
        this.$('#arcade-lives').textContent = state.lives;
        this.$('#arcade-tutorial').hidden = state.phase !== 'tutorial';
        this.$('#arcade-paused').hidden = state.phase !== 'paused';
        this.$('#arcade-result').hidden = state.phase !== 'finished';
        this.$('#arcade-final-score').textContent = state.score;
        this.$('#arcade-pause').textContent = state.phase === 'paused' ? 'Resume' : 'Pause';
        this.$('#arcade-pause').disabled = ['tutorial', 'finished'].includes(state.phase);
        this.$('#arcade-restart').textContent = 'Restart';
        this.$('#arcade-begin').textContent = this.navigation.deadline ? 'Cancel countdown' : this.runner?.started ? 'Resume' : 'Start';
        if (!this.navigation.deadline) {
            const instruction = `Lower and lift your RIGHT wrist to ${this.runner.started ? 'resume' : 'start'}, or press ${this.runner.started ? 'Resume' : 'Start'}.`;
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
            this.$('#arcade-feedback').textContent = text;
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
            this.$('#arcade-recognition').textContent = `${action === 'left' ? 'Left' : 'Right'} input recognised: ${label}`;
            const game = this.runner.game;
            const points = game.state.inputFeedback?.points || 0;
            if (points > 0) this.messageUntil = 0; // The target callout already shows the result.
            this.$('#arcade-playfield-input').textContent = `${label}${points > 0 ? ` +${points}` : ' · input received'}`;
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
        this.dialog.dataset.camera = 'loading';
        this.trackingAt = performance.now(); this.lostAt = null; this.visible = false;
        this.$('#arcade-camera').textContent = 'Stop camera';
        await this.camera.start(this.$('#arcade-video'), this.$('#arcade-mig-overlay'));
        if (this.closed || attempt !== this.cameraAttempt) return;
        this.cameraStarting = false;
        this.dialog.dataset.camera = this.camera.running ? 'live' : 'unavailable';
        if (!this.camera.running) this.$('#arcade-camera').textContent = 'Retry camera';
    }

    stopCamera() {
        this.cameraAttempt = (this.cameraAttempt || 0) + 1;
        this.cameraStarting = false; this.camera.stop(); this.cancelCountdown();
        this.visible = false; this.dialog.dataset.camera = 'off';
        this.$('#arcade-camera').textContent = 'Use camera';
        this.cameraStatus('Camera off. Keyboard and touch controls are ready.');
        this.showPlacement({ shoulders: false, left: null, right: null });
    }

    cameraStatus(text) {
        if (this.closed) return;
        if (text === 'Lift one wrist at a time.') this.message('Both wrists lifted together. Try one wrist at a time.');
        if (this.$('#arcade-camera-status').textContent !== text) this.$('#arcade-camera-status').textContent = text;
        if (this.dialog.dataset.camera === 'live' && !this.camera.running) {
            this.dialog.dataset.camera = 'unavailable';
            this.$('#arcade-camera').textContent = 'Retry camera';
            this.visible = false; this.cancelCountdown();
            this.showPlacement({ shoulders: false, left: null, right: null });
            this.runner.pause('Camera stopped. Retry the camera or use the buttons.');
        }
    }

    tracking(frame) {
        const video = this.$('#arcade-video');
        if (video.videoWidth && video.videoHeight) {
            this.$('.camera-view').style.aspectRatio = `${video.videoWidth}/${video.videoHeight}`;
        }
        this.visible = frame.visible;
        this.trackingAt = frame.timestamp;
        if (frame.visible) {
            this.lostAt = null;
            this.cameraStatus('Ready. Lower a wrist to waist level, then lift it toward your shoulder.');
        } else {
            this.lostAt ??= frame.timestamp;
            this.cameraStatus('Bring both shoulders and wrists back into view.');
        }
        this.showPlacement(frame);
    }

    showPlacement(frame) {
        for (const [part, visible] of [['shoulders', frame.shoulders], ['left', visiblePoint(frame.left)], ['right', visiblePoint(frame.right)]]) {
            const indicator = this.$(`[data-tracking=${part}]`);
            indicator.dataset.visible = String(Boolean(visible));
            indicator.querySelector('span').textContent = visible ? 'Detected' : 'Not in view';
        }
        for (const side of ['left', 'right']) {
            const marker = this.$(`[data-wrist=${side}]`), point = frame[side];
            marker.hidden = !visiblePoint(point);
            if (point) { marker.style.left = `${(1 - point.x) * 100}%`; marker.style.top = `${point.y * 100}%`; }
        }
    }

    frame(timestamp) {
        if (this.closed) return;
        if (this.camera.running) {
            const stale = this.trackingAt != null && timestamp - this.trackingAt > 1500;
            const lost = this.lostAt != null && timestamp - this.lostAt > 700;
            if (stale || lost) this.runner.pause('Tracking paused. Reposition, then lower and lift a wrist to resume.');
            if (stale) {
                this.visible = false;
                this.showPlacement({ shoulders: false, left: null, right: null });
                this.cameraStatus('Tracking interrupted. Keep shoulders and wrists inside the camera view.');
            }
        }
        const navigation = this.navigation.step({ visible: this.visible, lastSeen: this.trackingAt, lostSince: this.lostAt }, timestamp);
        if (navigation?.cancelled) { this.cancelCountdown(); this.cameraStatus('Reposition, then lower and lift a wrist to try again.'); }
        else if (navigation?.play) this.play();
        else if (navigation) {
            const text = `${this.runner.started ? 'Resuming' : 'Starting'} in ${navigation.remaining}… Lower your hands.`;
            this.$('#arcade-countdown').textContent = text;
            this.$('#arcade-controls-status').textContent = text;
        }
        if (timestamp > (this.recognisedUntil || 0)) this.$('#arcade-recognition').textContent = '';
        this.runner.step(timestamp);
        this.painter.background();
        this.runner.game.render(this.painter);
        this.$('#arcade-playfield-input').hidden = timestamp > (this.recognisedUntil || 0);
        this.$('#arcade-playfield-message').hidden = timestamp > (this.messageUntil || 0);
        if (timestamp > (this.nextHUD || 0)) { this.runner.publish(); this.nextHUD = timestamp + 150; }
        if (timestamp > (this.pulseUntil || 0)) {
            for (const button of this.dialog.querySelectorAll('[data-pulse]')) delete button.dataset.pulse;
        }
        this.request = requestAnimationFrame(time => this.frame(time));
    }

    dispose() {
        if (this.closed) return;
        this.closed = true;
        cancelAnimationFrame(this.request); this.abort.abort();
        this.camera.stop(); this.runner.dispose();
        if (this.dialog.open) this.dialog.close();
        if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    }
}
