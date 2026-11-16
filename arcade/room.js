import { engines } from './registry.js?v=phosphor-33';
import { GameRunner } from './core/runner.js?v=arcade-28';
import { bindAlternativeControls } from './core/input.js?v=phosphor-33';
import { WRISTS, DIRECTIONS, ARROWS, decodeGesture, commandLabel } from './core/commands.js';
import { Painter, readPalette, loadArtwork, loadTypography } from './core/painter.js?v=arcade-28';
import { MotionCamera, visiblePoint } from './mig/camera.js?v=phosphor-33';
import { ArcadeAudio } from './core/audio.js?v=phosphor-33';
import { MotionNavigation } from './core/motion-navigation.js?v=ready-21';
import { lessonFor } from './lessons.js?v=phosphor-33';
import { MarkerMotion } from './mig/marker-motion.js';
import { TriggerView } from './mig/trigger-view.js?v=bindings-29';
import { FrameBudget } from './core/frame-budget.js';
import { gameConfig } from './core/game-config.js?v=phosphor-33';
import { ArcadeResults } from './core/results.js?v=phosphor-33';
import { localScores } from './core/scores.js?v=phosphor-33';
import { GameGuide, wavingHand } from './core/guide.js?v=phosphor-33';
import { seededRandom } from './core/random.js';
import { localBindings, compileBindings, bindingName, controlLabels } from './mig/bindings.js?v=phosphor-33';

export class GameRoom {
    constructor(dialog, description, opener, {challenge = null} = {}) {
        this.dialog = dialog; this.description = description; this.opener = opener;
        dialog.querySelector('#arcade-binding-panel').hidden = true;
        for (const button of dialog.querySelectorAll('#arcade-binding-panel button')) button.disabled = false;
        this.scores = localScores;
        this.guideOpen = false;
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
        const config = gameConfig(description);
        this.gameConfig = config;
        this.sixDirections = config.directional;
        this.defaultProfile = config.profile;
        this.bindingPlan = compileBindings(description,this.defaultProfile,localBindings.profile,localBindings.assignments(description));
        const profile = this.bindingPlan.profile;
        this.$('a[download]').href = `./arcade/profiles/${config.profileFile}.json?v=targets-25`;
        this.defaultProfileURL = this.$('a[download]').href;
        this.wristPulseUntil = {};
        this.markerMotion = Object.fromEntries(WRISTS.map(wrist => [wrist, new MarkerMotion()]));
        this.triggerView = new TriggerView(this.$('#arcade-trigger-zones'), this.sixDirections ? DIRECTIONS : ['up'], profile,
            {mapped:this.bindingPlan.mapped,labels:this.guideLabels()});
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
        this.guide = new GameGuide(this.$('#arcade-walkthrough'), description, {
            getBindings: () => this.bindingPlan.mapped ? Object.fromEntries(Object.entries(this.bindingPlan.labels)
                .map(([control,name])=>[controlLabels(description)[control],name])) : null,
            signal: this.abort.signal, onDone: () => this.closeGuide(),
            drawPreview: element => {
                const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 420;
                const painter = new Painter(canvas.getContext('2d'), this.palette, this.painter.images);
                const sample = engines[description.engine]({ random: seededRandom(description.seed ?? 123), pace: .8,
                    message() {}, finish() {} });
                painter.background(); sample.render(painter); sample.dispose(); element.append(canvas);
            }
        });
        this.$('#arcade-start-icon').innerHTML = wavingHand;
        this.camera = new MotionCamera({
            profile, mapped:this.bindingPlan.mapped,
            cooldownMs: config.cooldownMs,
            onInput: (action, timestamp, details) => details?.mapped ? this.mappedInput(action,timestamp) : this.motionInput(action, timestamp),
            onTracking: frame => this.tracking(frame), onStatus: () => this.cameraStatus()
        });
        this.bindControls();
        this.cancelCountdown();
        this.showPlacement({ shoulders: false, left: null, right: null });
        this.dialog.dataset.camera = 'off';
        this.$('#arcade-feedback').textContent = description.engine==='lander'?'Lift L or R. Both together fire the center engine.':this.sixDirections ? 'One wrist per stack.' : 'Lower and lift one wrist.';
        this.$('#arcade-sound').setAttribute('aria-pressed', 'true');
        this.fillControls();
        this.results = new ArcadeResults(dialog,description,this.scores,challenge,{
            signal:this.abort.signal,onScoresChanged:()=>this.runner.publish()
        });
        this.updateBindingDisplay();
        this.runner.publish();
        dialog.showModal();
        document.documentElement.dataset.arcadeOpen = 'true';
        this.resizeCanvas();
        this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
        this.resizeObserver.observe(this.canvas.parentElement);
        this.$('#arcade-begin').focus({ preventScroll: true });
        this.toggleCamera();
        if (!this.scores.hasScore(description)) this.openGuide();
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
            if(this.bindingPanelOpen)return;
            this.dialog.dataset.brief = 'controls';
            this.$('#arcade-tutorial').removeAttribute('aria-label');
            this.$('#arcade-tutorial').setAttribute('aria-labelledby', 'arcade-lesson-title');
            this.cancelCountdown(); this.clearFeedback(); this.runner.tutorial();
            this.$('#arcade-tutorial').scrollTop = 0;
            this.$('#arcade-begin').focus({ preventScroll: true });
        });
        on('#arcade-guide', () => this.openGuide());
        on('#arcade-bindings', () => this.openBindings());
        on('#arcade-binding-import', () => this.$('#arcade-binding-file').click());
        on('#arcade-binding-cancel', () => this.closeBindings());
        on('#arcade-binding-defaults', () => {
            for(const select of this.dialog.querySelectorAll('[data-bind-control]'))select.value='';
        });
        on('#arcade-binding-apply', () => this.applyBindings());
        this.$('#arcade-binding-file').addEventListener('change', async event => {
            const file=event.target.files[0];if(!file)return;
            const button=this.$('#arcade-binding-import');button.disabled=true;
            this.$('#arcade-binding-apply').disabled=true;
            try {
                await localBindings.importFile(file);
                if(!this.closed){this.renderBindings();this.text('#arcade-binding-status','Choose a binding for each control, then Apply.');}
            } catch(error) {if(!this.closed)this.text('#arcade-binding-status',error.message);}
            finally {if(!this.closed){button.disabled=false;this.$('#arcade-binding-apply').disabled=false;event.target.value='';}}
        },{signal});
        on('#arcade-pause', () => {
            if(this.bindingPanelOpen || this.guideOpen)return;
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
            if (document.hidden) {
                this.resumeCameraOnVisibility = this.camera.running || this.cameraStarting;
                this.cancelCountdown(); this.runner.pause('Paused while the page is in the background.');
                if (this.resumeCameraOnVisibility) this.stopCamera();
            } else if (this.resumeCameraOnVisibility) {
                this.resumeCameraOnVisibility = false;
                this.toggleCamera();
            }
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
                    button.append(arrow);
                    button.append(key); buttons.append(button);
                });
                group.append(title, buttons); area.append(group);
            } else {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'arcade-action';
                button.dataset.arcadeInput = wrist;
                const arrow = document.createElement('span'); arrow.className = 'action-key';
                arrow.textContent = ['maze', 'juggle', 'lander'].includes(this.description.engine) ? (wrist === 'left' ? 'L' : 'R') : ARROWS[wrist];
                const label = document.createElement('span'); label.className = 'action-name'; label.textContent = this.bindingPlan.mapped ? controlLabels(this.description)[wrist] : this.description.controls[wrist];
                button.append(arrow, label); area.append(button);
            }
        }
    }

    resizeCanvas() {
        if (this.closed) return;
        const box = this.canvas.parentElement.getBoundingClientRect();
        // The rising-stack board grows vertically on narrow screens; UI text and
        // arrows keep their proportions instead of stretching a landscape image.
        const height = this.gameConfig.portraitBoard && box.width
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
        if (this.guideOpen || this.bindingPanelOpen) return;
        this.cancelCountdown(); this.clearFeedback(); this.runner.play(); this.canvas.focus({ preventScroll: true });
    }

    clearFeedback() {
        this.recognisedUntil = 0; this.messageUntil = 0; this.pulseUntil = 0;
        this.$('#arcade-recognition').textContent = '';
        this.$('#arcade-feedback').textContent = '';
    }

    restart() {
        if(this.bindingPanelOpen)return;
        this.cancelCountdown();
        this.clearFeedback();
        if (this.runner.phase === 'finished' && this.cameraForReplay) {
            this.cameraForReplay = false;
            this.dialog.dataset.brief = 'start';
            this.runner.create(); this.runner.publish(); this.toggleCamera();
        } else this.runner.restart();
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
        if (this.guideOpen || this.bindingPanelOpen) return false;
        if (this.runner.phase !== 'tutorial') {
            this.inputMode = details.source || 'keyboard';
            return this.runner.router.dispatch(action, details);
        }
        return false;
    }

    motionInput(action, timestamp) {
        if (this.closed || this.guideOpen || this.bindingPanelOpen || document.hidden || performance.now() - timestamp > 250) return;
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
        if (this.guideOpen || this.bindingPanelOpen) return;
        const initialStart = this.runner.phase === 'tutorial' && this.dialog.dataset.brief === 'start';
        if (this.navigation.request(this.runner.phase, visible, now, initialStart)) {
            this.inputMode = 'motion';
            this.$('#arcade-cancel-countdown').hidden = false;
        }
    }

    mappedInput(action,timestamp) {
        if(this.closed || this.bindingPanelOpen || this.guideOpen || document.hidden || performance.now()-timestamp>250)return;
        if(this.runner.phase==='playing')this.input(action,{source:'motion',timestamp});
        else this.requestCountdown(true,performance.now());
    }

    guideLabels() {
        return Object.fromEntries(Object.keys(this.description.controls).map(control=>
            [control,this.sixDirections ? commandLabel(control) : control==='left'?'L':'R']));
    }

    openBindings() {
        if(this.bindingPanelOpen)return;
        this.bindingsResume = this.runner.phase==='playing';
        this.bindingsReturnGuide = this.guideOpen;
        if(this.guideOpen){this.guide.hide();this.guideOpen=false;}
        this.bindingPanelOpen=true;this.cancelCountdown();
        if(this.bindingsResume)this.runner.pause('');
        this.renderBindings();this.$('#arcade-binding-panel').hidden=false;
        this.runner.publish();this.$('#arcade-binding-import').focus({preventScroll:true});
    }

    renderBindings() {
        this.text('#arcade-binding-source',localBindings.profile?localBindings.name:'Game defaults');
        this.text('#arcade-binding-status','');
        const assignments=localBindings.assignments(this.description),labels=controlLabels(this.description);
        this.$('#arcade-binding-rows').replaceChildren(...Object.keys(this.description.controls).map(control=>{
            const row=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select');
            title.textContent=labels[control];select.dataset.bindControl=control;
            select.setAttribute('aria-label',`${labels[control]} binding`);
            select.add(new Option('Game default',''));
            for(const input of localBindings.profile?.inputs||[])select.add(new Option(bindingName(input),input.id));
            select.value=assignments[control];select.disabled=!localBindings.profile;
            row.append(title,select);return row;
        }));
    }

    async applyBindings() {
        const button=this.$('#arcade-binding-apply');button.disabled=true;
        this.$('#arcade-binding-cancel').disabled=true;this.$('#arcade-binding-import').disabled=true;
        this.text('#arcade-binding-status','Applying bindings…');
        const assignments=Object.fromEntries([...this.dialog.querySelectorAll('[data-bind-control]')].map(select=>
            [select.dataset.bindControl,select.value]));
        try {
            const plan=compileBindings(this.description,this.defaultProfile,localBindings.profile,assignments);
            if(!await this.camera.configure(plan.profile,plan.mapped) || this.closed)return;
            localBindings.setAssignments(this.description,assignments);
            this.bindingPlan=plan;
            this.triggerView=new TriggerView(this.$('#arcade-trigger-zones'),this.sixDirections?DIRECTIONS:['up'],plan.profile,
                {mapped:plan.mapped,labels:this.guideLabels()});
            this.fillControls();this.updateBindingDisplay();this.closeBindings();
        } catch(error) {if(!this.closed)this.text('#arcade-binding-status',`Bindings were not applied: ${error.message}`);}
        finally {if(!this.closed){button.disabled=false;this.$('#arcade-binding-cancel').disabled=false;this.$('#arcade-binding-import').disabled=false;}}
    }

    closeBindings() {
        this.bindingPanelOpen=false;this.$('#arcade-binding-panel').hidden=true;
        this.startWristVisible=false;
        if(this.bindingsReturnGuide){this.guideOpen=true;this.guide.element.hidden=false;this.guide.render();}
        if(this.bindingsResume && this.runner.phase==='paused' && !document.hidden)this.play();
        else this.runner.publish();
        this.bindingsReturnGuide=false;this.bindingsResume=false;
        (this.guideOpen?this.guide.element.querySelector('[data-guide-next]'):this.$('#arcade-canvas')).focus({preventScroll:true});
    }

    updateBindingDisplay() {
        this.dialog.dataset.bindings=this.bindingPlan.mapped?'custom':'default';
        if(this.bindingDownloadURL){URL.revokeObjectURL(this.bindingDownloadURL);this.bindingDownloadURL=null;}
        if(this.bindingPlan.mapped){
            this.bindingDownloadURL=URL.createObjectURL(new Blob([JSON.stringify(this.bindingPlan.profile,null,2)],{type:'application/json'}));
            this.$('a[download]').href=this.bindingDownloadURL;
            this.$('a[download]').download=`${this.description.engine}-bindings.json`;
        } else {this.$('a[download]').href=this.defaultProfileURL;this.$('a[download]').download='';}
        this.painter.controls=this.bindingPlan.mapped?controlLabels(this.description):this.description.controls;
        this.$('.gesture-lesson').hidden=this.bindingPlan.mapped;
        const list=this.$('#arcade-controls-bindings');list.hidden=!this.bindingPlan.mapped;list.replaceChildren();
        for(const [control,name]of Object.entries(this.bindingPlan.labels)){
            const term=document.createElement('dt'),value=document.createElement('dd');
            term.textContent=controlLabels(this.description)[control];value.textContent=name;list.append(term,value);
            const actionLabel=this.dialog.querySelector(`[data-arcade-input="${control}"] .action-name`);
            if(actionLabel)actionLabel.textContent=controlLabels(this.description)[control];
        }
        if(!this.bindingPlan.mapped)for(const control of ['left','right']){
            const label=this.dialog.querySelector(`[data-arcade-input="${control}"] .action-name`);
            if(label)label.textContent=this.description.controls[control];
        }
        this.$('.camera-positioning').textContent=this.bindingPlan.mapped?
            (this.triggerView.unsupported?'Imported bindings · some regions have no body preview':'Imported bindings'):
            this.sixDirections?'Arrow boxes · no home return':'Lift into ↑ · lower to repeat';
        for(const side of ['left','right'])if(this.bindingPlan.mapped && this.bindingPlan.labels[side])
            this.$(`[data-tutorial-explanation=${side}]`).textContent=`${controlLabels(this.description)[side]}: ${this.bindingPlan.labels[side]}`;
    }

    cancelCountdown() {
        this.navigation.cancel();
        this.$('#arcade-cancel-countdown').hidden = true;
        this.$('#arcade-countdown').textContent = '';
        this.runner.publish();
    }

    updateUI(state) {
        if (this.closed) return;
        const justFinished = state.phase === 'finished' && this.dialog.dataset.phase !== 'finished';
        if (this.dialog.dataset.phase !== state.phase) this.needsPaint = true;
        const active = state.phase === 'playing' && !(this.description.engine === 'maze' && this.runner.game.state.stage === 'preview');
        this.camera?.setInferenceFps(active ? 20 : 10);
        this.dialog.dataset.phase = state.phase;
        this.text('#arcade-score', state.score);
        this.text('#arcade-time', `${state.remaining == null ? state.elapsed : state.remaining}s`);
        this.text('.arcade-hud > div:nth-child(2) dt', state.clockLabel || (state.remaining == null ? 'Survived' : 'Time'));
        this.text('#arcade-lives', state.lives);
        const editor = this.guideOpen || this.bindingPanelOpen;
        this.$('#arcade-tutorial').hidden = editor || state.phase !== 'tutorial';
        this.$('#arcade-paused').hidden = editor || state.phase !== 'paused';
        this.$('#arcade-result').hidden = editor || state.phase !== 'finished';
        this.text('#arcade-final-score', state.score);
        this.text('#arcade-result h3', state.result || 'Done');
        this.text('#arcade-pause', state.phase === 'paused' ? 'Resume' : 'Pause');
        this.$('#arcade-pause').disabled = ['tutorial', 'finished'].includes(state.phase);
        this.text('#arcade-restart', 'Restart');
        this.text('#arcade-begin', this.runner?.started ? 'Resume' : 'Start');
        if (!this.navigation.deadline) {
            const greeting = this.dialog.dataset.brief === 'start' && this.cameraReady && !this.bindingPlan.mapped;
            const instruction = this.dialog.dataset.brief === 'start' ? (greeting ? 'Say hi' : this.dialog.dataset.camera === 'unavailable' ? 'Press Start to play' : 'Loading') : this.runner.started ? 'Lift to resume' : 'Lift to start';
            this.startPrompt(instruction, greeting);
            if(this.bindingPlan.mapped && this.cameraReady)this.startPrompt(this.dialog.dataset.brief==='start'?'Use a binding to start':'Use a binding to resume');
        }
        this.updateCameraLayout();
        if (justFinished) {
            this.results.finish(state.score);
            this.cameraForReplay = Boolean(this.camera?.running || this.cameraStarting);
            if (this.cameraForReplay) this.stopCamera();
        }
        this.text('#arcade-best', String(this.scores.list(this.description)[0]?.score ?? 0).padStart(5,'0'));
    }

    openGuide() {
        if (this.guideOpen || this.bindingPanelOpen) return;
        this.resumeAfterGuide = this.runner.phase === 'playing';
        this.guideOpen = true;
        this.cancelCountdown();
        if (this.resumeAfterGuide) this.runner.pause('');
        this.guide.open(this.scores.hasScore(this.description));
        this.runner.publish();
    }

    closeGuide() {
        this.guideOpen = false;
        this.startWristVisible = false;
        if (this.resumeAfterGuide && this.runner.phase === 'paused' && !document.hidden) this.play();
        else {
            this.runner.publish();
            this.$(this.runner.phase === 'tutorial' ? '#arcade-begin' : this.runner.phase === 'finished' ? '#arcade-again' : '#arcade-canvas').focus({preventScroll:true});
        }
        this.resumeAfterGuide = false;
    }

    startPrompt(text, greeting = false) {
        this.text('#arcade-start-text', text);
        this.text('#arcade-start-suffix', greeting ? ' to start' : '');
        this.$('#arcade-start-icon').hidden = !greeting;
        this.$('#arcade-start-suffix').hidden = !greeting;
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
            this.$('#arcade-recognition').textContent = this.bindingPlan.mapped ?
                `${this.bindingPlan.labels[action]} → ${controlLabels(this.description)[action]}` : decodeGesture(action) ? commandLabel(action) : `${action === 'left' ? 'L' : 'R'} ↑`;
            if (!this.gameConfig.outcomeFeedback && !['popups', 'maze', 'juggle'].includes(this.description.engine)) this.sound.play({ action });
            const game = this.runner.game;
            const points = game.state.inputFeedback?.points || 0;
            if (points > 0) this.messageUntil = 0; // The target callout already shows the result.
            this.$('#arcade-playfield-input').textContent = this.gameConfig.outcomeFeedback || this.description.engine === 'juggle' ? '' : `${label}${points > 0 ? ` +${points}` : ''}`;
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
        this.cameraReady = false;
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
        this.cameraReady = false;
        this.startWristVisible = false; this.startLostAt = null;
        this.$('#arcade-camera').textContent = 'Use camera';
        this.cameraStatus();
        this.showPlacement({ shoulders: false, left: null, right: null });
    }

    cameraStatus() {
        if (this.closed) return;
        const short = this.camera.running ? (this.visible ? 'Ready' : 'Camera on')
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
        this.cameraReady = true;
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
        if (!this.bindingPlan.mapped && wristEntered && this.runner.phase === 'tutorial' && this.dialog.dataset.brief === 'start' && !document.hidden) {
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
        const initialStart = this.runner.phase === 'tutorial' && this.dialog.dataset.brief === 'start';
        const navigation = this.navigation.step({ visible: initialStart ? this.startWristVisible : this.visible,
            lastSeen: this.trackingAt, lostSince: initialStart ? this.startLostAt : this.lostAt }, timestamp);
        if (navigation?.cancelled) { this.cancelCountdown(); }
        else if (navigation?.play) this.play();
        else if (navigation) {
            const text = String(navigation.remaining);
            this.$('#arcade-countdown').textContent = text;
            this.startPrompt(text);
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
        this.$('#arcade-playfield-input').hidden = this.gameConfig.outcomeFeedback || this.description.engine === 'juggle' || timestamp > (this.recognisedUntil || 0);
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
        this.guide.dispose(); this.results.dispose();
        if(this.bindingDownloadURL)URL.revokeObjectURL(this.bindingDownloadURL);
        this.canvas.width = this.canvas.height = 1;
        this.painter = null; this.elements.clear();
        if (this.dialog.open) this.dialog.close();
        if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    }
}
