import { engines } from './registry.js';
import { GameRunner } from './core/runner.js';
import { bindAlternativeControls } from './core/input.js';
import { Painter, readPalette, loadArtwork } from './core/painter.js';
import { MotionCamera } from './mig/camera.js';

export class GameRoom {
    constructor(dialog, description, opener) {
        this.dialog = dialog; this.description = description; this.opener = opener;
        this.abort = new AbortController();
        this.$ = selector => dialog.querySelector(selector);
        this.canvas = this.$('#arcade-canvas');
        this.palette = readPalette();
        this.painter = new Painter(this.canvas.getContext('2d'), this.palette);
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
        this.camera = new MotionCamera({
            onInput: (action, timestamp) => this.runner.router.dispatch(action, { source: 'motion', timestamp }),
            onTracking: frame => this.tracking(frame), onStatus: text => this.cameraStatus(text)
        });
        this.bindControls();
        this.$('#arcade-camera-dock').hidden = true;
        this.$('#arcade-camera').textContent = 'Use camera';
        this.$('#arcade-feedback').textContent = 'Two buttons, or lower and lift one wrist.';
        this.$('#arcade-practice').textContent = 'You can try a gesture before starting.';
        this.runner.publish();
        dialog.showModal();
        this.request = requestAnimationFrame(time => this.frame(time));
        loadArtwork(this.palette.theme).then(images => {
            if (!this.closed) this.painter.images = images;
        });
    }

    bindControls() {
        const signal = this.abort.signal;
        const on = (selector, handler) => this.$(selector).addEventListener('click', handler, { signal });
        bindAlternativeControls(this.dialog, this.runner.router, signal);
        on('#arcade-close', () => this.dialog.close());
        on('#arcade-begin', () => { this.runner.play(); this.canvas.focus(); });
        on('#arcade-resume', () => { this.runner.play(); this.canvas.focus(); });
        on('#arcade-again', () => { this.runner.restart(); this.canvas.focus(); });
        on('#arcade-restart', () => { this.runner.restart(); this.canvas.focus(); });
        on('#arcade-help', () => this.runner.tutorial());
        on('#arcade-pause', () => {
            if (this.runner.phase === 'playing') this.runner.pause(); else if (this.runner.phase === 'paused') this.runner.play();
        });
        on('#arcade-camera', () => this.toggleCamera());
        on('#arcade-recalibrate', () => this.camera.recalibrate());
        this.dialog.addEventListener('close', () => this.dispose(), { signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.runner.pause('Paused while the page is in the background.');
        }, { signal });
        window.addEventListener('pagehide', () => this.dispose(), { signal });
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
        this.$('#arcade-begin').textContent = this.runner?.started ? 'Continue' : 'Start playing';
    }

    message(text) {
        if (!this.closed) this.$('#arcade-feedback').textContent = text;
    }

    feedback(kind, action) {
        if (this.closed) return;
        const label = this.description.controls[action];
        if (kind === 'accepted' || kind === 'practice') {
            this.$(`[data-arcade-input=${action}]`).dataset.pulse = 'true';
            this.pulseUntil = performance.now() + 180;
            if (kind === 'practice') this.$('#arcade-practice').textContent = `${label} recognised ✓ Lower your wrist to try again.`;
        } else if (kind === 'duplicate') this.message('Recognised. Lower your wrist before the next lift.');
        else if (kind === 'late') this.message('That input arrived too late. Try the next one.');
    }

    async toggleCamera() {
        const attempt = this.cameraAttempt = (this.cameraAttempt || 0) + 1;
        if (this.camera.session || this.cameraStarting) {
            this.cameraStarting = false; this.camera.stop();
            this.$('#arcade-camera').textContent = 'Use camera';
            this.$('#arcade-camera-dock').hidden = true;
            this.message('Keyboard and touch controls are ready.');
            return;
        }
        this.cameraStarting = true;
        this.trackingAt = performance.now(); this.lostAt = null; this.visible = false;
        this.$('#arcade-camera').textContent = 'Stop camera';
        this.$('#arcade-camera-dock').hidden = false;
        await this.camera.start(this.$('#arcade-video'), this.$('#arcade-mig-overlay'));
        if (this.closed || attempt !== this.cameraAttempt) return;
        this.cameraStarting = false;
        if (!this.camera.running) this.$('#arcade-camera').textContent = 'Use camera';
    }

    cameraStatus(text) {
        if (!this.closed) this.$('#arcade-camera-status').textContent = text;
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
            this.$('#arcade-camera-status').textContent = 'Wrists visible. Lower, lift, lower.';
        } else {
            this.lostAt ??= frame.timestamp;
            this.cameraStatus('Bring both shoulders and wrists back into view.');
        }
        for (const side of ['left', 'right']) {
            const marker = this.$(`[data-wrist=${side}]`), point = frame[side];
            marker.hidden = !point || point.confidence < .5;
            if (point) { marker.style.left = `${point.x * 100}%`; marker.style.top = `${point.y * 100}%`; }
        }
    }

    frame(timestamp) {
        if (this.closed) return;
        if (this.camera.running) {
            const stale = this.trackingAt != null && timestamp - this.trackingAt > 400;
            const lost = this.lostAt != null && timestamp - this.lostAt > 400;
            if (stale || lost) this.runner.pause('Tracking paused. Reposition, then choose Resume.');
        }
        this.runner.step(timestamp);
        this.painter.background(); this.runner.game.render(this.painter);
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
