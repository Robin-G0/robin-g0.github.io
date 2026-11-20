// First-visit welcome: tracking precision, then gallery or theme. Reopens for precision only.
import { presetsFor, resolvePreset, isMobileDevice, detectGraphics, recommendedPreset,
    readPrecision, savePrecision } from '../arcade/mig/precision.js?v=eras-2';
import { isPoseModelReady } from '../arcade/mig/pose-models.js?v=eras-2';

const RUNTIME = new URL('../vendor/motion-input-grid/runtime/', import.meta.url).href;
const $ = (root, selector) => root.querySelector(selector);

export function shortRenderer(renderer) {
    const inner = /ANGLE \((?:[^,]*,\s*)?([^,(]+)/.exec(renderer)?.[1] ?? renderer;
    return inner.replace(/\s+(Direct3D|OpenGL|Vulkan|Metal).*$/i, '').replace(/\(TM\)|\(R\)/g, '').trim().slice(0, 48);
}

export class Experience {
    constructor(dialog, { themes, previewFor, onTheme, onGames }) {
        Object.assign(this, { dialog, themes, previewFor, onTheme, onGames });
        this.mobile = isMobileDevice();
        this.graphics = null;
        this.steps = [];
        dialog.addEventListener('cancel', event => { event.preventDefault(); this.skip(); });
        dialog.addEventListener('click', event => this.click(event));
        document.addEventListener('click', event => {
            const opener = event.target.closest?.('[data-open-experience]');
            if (opener && !dialog.contains(opener)) this.open(['precision'], opener);
        });
    }

    get recommended() {
        this.graphics ??= this.mobile ? { gpu: true, renderer: '' } : detectGraphics();
        return recommendedPreset({ mobile: this.mobile, gpu: this.graphics.gpu });
    }

    current() { return readPrecision(undefined, this.mobile); }

    /** steps: ['precision'] to adjust tracking, or the full ['precision','start','theme'] welcome. */
    open(steps, opener = null) {
        this.steps = steps; this.opener = opener;
        this.selected = this.current() ?? this.recommended;
        this.renderPrecision();
        $(this.dialog, '[data-experience-next="precision"]').textContent = steps.length > 1 ? 'Continue' : 'Save';
        // A first visit (no opener) can always take the recommendation; settings just save.
        $(this.dialog, '[data-experience-skip]').hidden = Boolean(opener);
        this.dialog.dataset.flow = opener ? 'settings' : 'welcome';
        this.show('precision');
        if (!this.dialog.open) this.dialog.showModal();
        $(this.dialog, `[data-preset="${this.selected}"]`)?.focus({ preventScroll: true });
    }

    show(step) {
        for (const section of this.dialog.querySelectorAll('[data-step]')) section.hidden = section.dataset.step !== step;
        for (const dot of this.dialog.querySelectorAll('[data-step-dot]')) {
            dot.hidden = !this.steps.includes(dot.dataset.stepDot);
            dot.toggleAttribute('data-current', dot.dataset.stepDot === step);
        }
        this.dialog.dataset.step = step;
        if (step === 'theme') this.renderThemes();
    }

    async renderPrecision() {
        const recommended = this.recommended;
        const graphics = this.graphics;
        $(this.dialog, '#experience-device').textContent = this.mobile
            ? 'Phone or tablet detected: three precision levels.'
            : graphics.gpu ? `Graphics card detected${graphics.renderer ? `: ${shortRenderer(graphics.renderer)}` : ''}. “Fast” levels use it.`
                : 'No graphics card detected: “fast” levels will fall back to the processor.';
        const options = presetsFor(this.mobile).map(preset => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'precision-option'; button.dataset.preset = preset.id;
            button.setAttribute('role', 'radio');
            const head = document.createElement('span'); head.className = 'precision-head';
            const name = document.createElement('strong'); name.textContent = preset.label;
            head.append(name);
            if (preset.id === recommended) {
                const badge = document.createElement('span'); badge.className = 'precision-badge'; badge.textContent = 'Recommended';
                head.append(badge);
            }
            const detail = document.createElement('span'); detail.className = 'precision-detail'; detail.textContent = preset.detail;
            const meta = document.createElement('span'); meta.className = 'precision-meta';
            meta.textContent = `${preset.size} · ${preset.delegate === 'GPU' ? 'graphics card' : 'processor'}`;
            button.append(head, detail, meta);
            button.addEventListener('click', () => this.select(preset.id));
            button.addEventListener('keydown', event => this.arrow(event));
            return button;
        });
        $(this.dialog, '#precision-options').replaceChildren(...options);
        this.select(this.selected);
        for (const preset of presetsFor(this.mobile)) {
            if (await isPoseModelReady(preset.model, RUNTIME) && preset.model !== 'lite') {
                const meta = $(this.dialog, `[data-preset="${preset.id}"] .precision-meta`);
                if (meta && !meta.textContent.includes('downloaded')) meta.textContent += ' · downloaded';
            }
        }
    }

    select(id) {
        this.selected = id;
        for (const option of this.dialog.querySelectorAll('[data-preset]')) {
            const checked = option.dataset.preset === id;
            option.setAttribute('aria-checked', String(checked));
            option.tabIndex = checked ? 0 : -1;
        }
    }

    arrow(event) {
        const options = [...this.dialog.querySelectorAll('[data-preset]')];
        const index = options.indexOf(event.currentTarget);
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = options[(index + step + options.length) % options.length];
        this.select(next.dataset.preset); next.focus();
    }

    renderThemes() {
        const container = $(this.dialog, '#experience-themes');
        if (container.childElementCount) return;
        container.replaceChildren(...this.themes.map(theme => {
            const button = document.createElement('button'); button.type = 'button';
            button.className = 'experience-theme'; button.dataset.experienceTheme = theme.id;
            const image = document.createElement('img'); image.src = this.previewFor(theme.id); image.alt = '';
            image.width = 900; image.height = 130; image.loading = 'lazy';
            const name = document.createElement('strong'); name.textContent = theme.name;
            const era = document.createElement('span'); era.textContent = theme.era;
            button.append(image, name, era);
            return button;
        }));
    }

    commitPrecision() {
        const previous = this.current();
        savePrecision(this.selected, undefined, this.mobile);
        if (previous !== this.selected) window.dispatchEvent(new CustomEvent('precisionchange', { detail: resolvePreset(this.selected, this.mobile) }));
    }

    click(event) {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.dataset.experienceNext === 'precision') {
            this.commitPrecision();
            if (this.steps.includes('start')) this.show('start'); else this.close();
        } else if (target.dataset.experienceBack) this.show(target.dataset.experienceBack);
        else if (target.hasAttribute('data-experience-skip')) this.skip();
        else if (target.dataset.start === 'games') { this.close(); this.onGames(); }
        else if (target.dataset.start === 'theme') this.show('theme');
        else if (target.dataset.experienceTheme) { this.close(); this.onTheme(target.dataset.experienceTheme); }
    }

    /** Escape or "Use the recommendation": keep sensible defaults so the welcome does not return. */
    skip() {
        if (!this.current()) { this.selected = this.recommended; this.commitPrecision(); }
        this.close();
    }

    close() {
        if (this.dialog.open) this.dialog.close();
        this.opener?.focus?.({ preventScroll: true });
        this.opener = null;
    }
}
